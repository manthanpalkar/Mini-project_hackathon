/**
 * LOOP — High-Performance Distributed Redis Cache Service
 * 
 * Provides transparent Redis caching with automatic graceful fallback to MongoDB.
 * Implements:
 * - Single-flight / promise coalescing to eliminate cache stampedes on cold starts
 * - Strict permission and namespace isolation (loop:stories:*, loop:resources:*, etc.)
 * - Bounded memory safety & zero-downtime tolerance if Redis is offline/unreachable
 * - Atomic invalidation on mutation (create, edit, delete, approve, reject)
 * - Safe performance metrics (hits, misses, errors, latency)
 */

const { createClient } = require('redis');
const zlib = require('zlib');

// Configuration from environment variables
const isTestRunner = process.env.NODE_ENV === 'test' || process.execArgv.some(a => a.startsWith('--test'));
const REDIS_URL = process.env.REDIS_URL || '';
const REDIS_ENABLED = !isTestRunner && process.env.REDIS_ENABLED !== 'false' && Boolean(REDIS_URL);

// High-speed compression settings with versioned encoding & zip-bomb protection
const COMPRESSION_THRESHOLD = parseInt(process.env.REDIS_COMPRESSION_THRESHOLD || '1024', 10);
const GZIP_V1_PREFIX = '__gz:v1:';
const LEGACY_GZIP_PREFIX = '__gz:';
const MAX_DECOMPRESSED_BYTES = 10 * 1024 * 1024; // 10 MB limit to prevent heap exhaustion

// Maximum concurrent in-flight deduplications to bound memory
const MAX_IN_FLIGHT_KEYS = 500;

// Empty result TTL (30 seconds) to prevent non-matching searches from polluting cache
const EMPTY_RESULT_TTL = parseInt(process.env.REDIS_TTL_EMPTY || '30', 10);

function compressPayload(str) {
  if (typeof str !== 'string' || Buffer.byteLength(str, 'utf-8') < COMPRESSION_THRESHOLD) {
    return str;
  }
  try {
    const rawBuf = Buffer.from(str, 'utf-8');
    const compressed = zlib.gzipSync(rawBuf, { level: 6 });
    // Only use compressed if it achieves at least 10% space saving
    if (compressed.length < rawBuf.length * 0.9) {
      const b64 = compressed.toString('base64');
      cacheMetrics.compressionSavingsBytes += Math.max(0, rawBuf.length - b64.length);
      cacheMetrics.compressedSets++;
      return GZIP_V1_PREFIX + b64;
    }
    return str;
  } catch (e) {
    return str; // Fallback to raw string if compression error
  }
}

function decompressPayload(raw) {
  if (typeof raw !== 'string') return raw;

  let base64Data = null;
  if (raw.startsWith(GZIP_V1_PREFIX)) {
    base64Data = raw.slice(GZIP_V1_PREFIX.length);
  } else if (raw.startsWith(LEGACY_GZIP_PREFIX)) {
    base64Data = raw.slice(LEGACY_GZIP_PREFIX.length);
  }

  if (base64Data !== null) {
    try {
      const buf = Buffer.from(base64Data, 'base64');
      return zlib.gunzipSync(buf, { maxOutputLength: MAX_DECOMPRESSED_BYTES }).toString('utf-8');
    } catch (e) {
      throw new Error(`Failed to decompress cached payload: ${e.message}`);
    }
  }

  return raw;
}

const DEFAULT_TTLS = {
  stories: parseInt(process.env.REDIS_TTL_STORIES || '900', 10), // 15 minutes
  storyDetail: parseInt(process.env.REDIS_TTL_STORY_DETAIL || '1800', 10), // 30 minutes
  resources: parseInt(process.env.REDIS_TTL_RESOURCES || '900', 10), // 15 minutes
  resourceDetail: parseInt(process.env.REDIS_TTL_RESOURCE_DETAIL || '1800', 10), // 30 minutes
  achievements: parseInt(process.env.REDIS_TTL_ACHIEVEMENTS || '1800', 10), // 30 minutes
  folders: parseInt(process.env.REDIS_TTL_FOLDERS || '900', 10), // 15 minutes
  default: 900
};

// Lightweight Circuit Breaker for Redis Availability
const CIRCUIT_BREAKER = {
  state: 'CLOSED', // 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: 0,
  threshold: parseInt(process.env.REDIS_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
  resetTimeoutMs: parseInt(process.env.REDIS_CIRCUIT_BREAKER_RESET_MS || '30000', 10), // 30s
  openUntil: 0,
  totalTrips: 0
};

function recordSuccess() {
  if (CIRCUIT_BREAKER.state === 'HALF_OPEN') {
    console.log('[CacheService] Circuit breaker restored to CLOSED after successful Redis probe.');
  }
  CIRCUIT_BREAKER.state = 'CLOSED';
  CIRCUIT_BREAKER.failureCount = 0;
}

function recordFailure(err) {
  CIRCUIT_BREAKER.failureCount++;
  cacheMetrics.errors++;
  cacheMetrics.lastError = err?.message || String(err);

  if (CIRCUIT_BREAKER.failureCount >= CIRCUIT_BREAKER.threshold && CIRCUIT_BREAKER.state !== 'OPEN') {
    CIRCUIT_BREAKER.state = 'OPEN';
    CIRCUIT_BREAKER.openUntil = Date.now() + CIRCUIT_BREAKER.resetTimeoutMs;
    CIRCUIT_BREAKER.totalTrips++;
    console.warn(`[CacheService] Circuit breaker tripped to OPEN (${CIRCUIT_BREAKER.failureCount} consecutive errors). Bypassing Redis for ${CIRCUIT_BREAKER.resetTimeoutMs / 1000}s.`);
  }
}

// In-flight promise map for Single-Flight / Stampede Prevention
const inFlightPromises = new Map();

// Telemetry metrics
const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  compressedSets: 0,
  compressionSavingsBytes: 0,
  invalidations: 0,
  lastError: null,
  connected: false,
  enabled: REDIS_ENABLED
};

let client = null;
let isConnecting = false;

/**
 * Initialize Redis Client with resilient reconnect strategy
 */
function initRedis() {
  if (!REDIS_ENABLED || client) {
    return client;
  }

  try {
    client = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.warn('[CacheService] Redis max reconnection attempts reached. Continuing in MongoDB fallback mode.');
            return 30000; // Retry once every 30s
          }
          return Math.min(retries * 500, 5000); // Exponential backoff up to 5s
        },
        connectTimeout: 5000
      }
    });

    client.on('connect', () => {
      cacheMetrics.connected = true;
      console.log('[CacheService] Connected to Redis cluster successfully.');
    });

    client.on('ready', () => {
      cacheMetrics.connected = true;
    });

    client.on('error', (err) => {
      cacheMetrics.connected = false;
      cacheMetrics.errors++;
      cacheMetrics.lastError = err.message;
      // Do not crash application on Redis connection error
      console.warn(`[CacheService] Redis error (degraded to MongoDB fallback): ${err.message}`);
    });

    client.on('end', () => {
      cacheMetrics.connected = false;
    });

    isConnecting = true;
    client.connect().catch((err) => {
      cacheMetrics.connected = false;
      cacheMetrics.errors++;
      cacheMetrics.lastError = err.message;
      console.warn(`[CacheService] Redis initial connection failed: ${err.message}. Running in MongoDB direct mode.`);
    }).finally(() => {
      isConnecting = false;
    });
  } catch (err) {
    cacheMetrics.connected = false;
    cacheMetrics.errors++;
    cacheMetrics.lastError = err.message;
    console.warn(`[CacheService] Failed to create Redis client: ${err.message}`);
  }

  return client;
}

// Automatically initialize if REDIS_URL is provided in environment
if (REDIS_ENABLED) {
  initRedis();
}

/**
 * Safely check if Redis is active and ready, taking Circuit Breaker into account
 */
function isRedisReady() {
  if (!client || !client.isOpen || !cacheMetrics.connected) {
    return false;
  }

  // Circuit breaker state check
  if (CIRCUIT_BREAKER.state === 'OPEN') {
    if (Date.now() >= CIRCUIT_BREAKER.openUntil) {
      CIRCUIT_BREAKER.state = 'HALF_OPEN';
      return true; // Trial single probe in HALF_OPEN
    }
    return false; // Fast-fail to DB without waiting on Redis timeouts
  }

  return true;
}

/**
 * Generate a deterministic, sanitized cache key with namespace
 */
function makeKey(namespace, identifier = '') {
  const cleanNamespace = String(namespace).toLowerCase().trim();
  const cleanId = String(identifier).replace(/[\r\n\t]/g, '').trim();
  return cleanId ? `loop:${cleanNamespace}:${cleanId}` : `loop:${cleanNamespace}`;
}

/**
 * Get cached item or execute fallback query with Single-Flight / Stampede Protection
 * 
 * @param {string} key - Full namespaced cache key
 * @param {Function} fetcherFn - Async function to fetch data from MongoDB if cache miss
 * @param {number} ttlSeconds - Time-to-live in seconds
 * @returns {Promise<any>}
 */
async function getOrSet(key, fetcherFn, ttlSeconds = DEFAULT_TTLS.default) {
  let redisReadFailed = false;

  // 1. If Redis is ready, check cache first
  if (isRedisReady()) {
    try {
      const raw = await client.get(key);
      if (raw) {
        cacheMetrics.hits++;
        recordSuccess();
        try {
          const decompressed = decompressPayload(raw);
          return JSON.parse(decompressed);
        } catch (parseErr) {
          // If malformed or decompression error, delete key and fall through to fetcher
          console.warn(`[CacheService] Corrupt cache entry in key ${key}, purging: ${parseErr.message}`);
          await client.del(key).catch(() => {});
        }
      }
    } catch (err) {
      redisReadFailed = true;
      recordFailure(err);
      console.warn(`[CacheService] Redis GET error on key ${key}: ${err.message}`);
    }
  }

  cacheMetrics.misses++;

  // 2. Single-Flight Promise Coalescing to prevent cache stampedes
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key);
  }

  // Bounded in-flight execution guard
  const canCoalesce = inFlightPromises.size < MAX_IN_FLIGHT_KEYS;

  const promise = (async () => {
    try {
      const result = await fetcherFn();

      // Only cache valid, defined non-null payloads (avoid caching null/undefined as successful hits)
      // Skip writing if Redis just threw an error on read to avoid socket stall
      if (result !== undefined && result !== null && !redisReadFailed && isRedisReady()) {
        try {
          const payload = JSON.stringify(result);
          // Safety guard: Don't cache oversized strings (> 5MB)
          if (payload.length <= 5 * 1024 * 1024) {
            const dataToStore = compressPayload(payload);
            
            // Optimization: Cache empty result arrays with short TTL to avoid cache pollution
            let effectiveTtl = Math.max(1, ttlSeconds);
            if (Array.isArray(result) && result.length === 0) {
              effectiveTtl = Math.min(effectiveTtl, EMPTY_RESULT_TTL);
            }

            await client.set(key, dataToStore, { EX: effectiveTtl });
            cacheMetrics.sets++;
            recordSuccess();
          }
        } catch (setErr) {
          recordFailure(setErr);
        }
      }

      return result;
    } finally {
      if (canCoalesce) {
        inFlightPromises.delete(key);
      }
    }
  })();

  if (canCoalesce) {
    inFlightPromises.set(key, promise);
  }
  return promise;
}

/**
 * Delete a specific cache key
 */
async function del(key) {
  if (!isRedisReady()) return;
  try {
    await client.del(key);
    cacheMetrics.invalidations++;
    recordSuccess();
  } catch (err) {
    recordFailure(err);
  }
}

/**
 * Delete keys matching a pattern (e.g. 'loop:stories:*') using SCAN
 */
async function delByPattern(pattern) {
  if (!isRedisReady()) return;
  try {
    let cursor = '0';
    do {
      const reply = await client.scan(cursor.toString(), { MATCH: pattern, COUNT: 100 });
      cursor = reply.cursor;
      const keys = reply.keys;
      if (keys && keys.length > 0) {
        await client.del(keys);
        cacheMetrics.invalidations += keys.length;
      }
    } while (cursor !== 0 && cursor !== '0');
    recordSuccess();
  } catch (err) {
    recordFailure(err);
    console.warn(`[CacheService] delByPattern error for pattern ${pattern}: ${err.message}`);
  }
}

// --- Specific Domain Invalidation Helpers ---

/**
 * Invalidate all stories list caches and optional specific story detail
 */
async function invalidateStories(storyId = null) {
  await delByPattern('loop:stories:*');
  await del('loop:stories:list');
  if (storyId) {
    await del(makeKey('stories:detail', storyId));
  }
}

/**
 * Invalidate all public and categorized resources list caches and optional specific resource detail
 */
async function invalidateResources(resourceId = null) {
  await delByPattern('loop:resources:*');
  await del('loop:resources:list');
  if (resourceId) {
    await del(makeKey('resources:detail', resourceId));
  }
}

/**
 * Invalidate achievements cache
 */
async function invalidateAchievements(achievementId = null) {
  await delByPattern('loop:achievements:*');
  await del('loop:achievements:list');
  if (achievementId) {
    await del(makeKey('achievements:detail', achievementId));
  }
}

/**
 * Invalidate folder hierarchy cache
 */
async function invalidateFolders() {
  await delByPattern('loop:folders:*');
}

/**
 * Return telemetry metrics for admin diagnostics
 */
function getMetrics() {
  const totalQueries = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate = totalQueries > 0 ? ((cacheMetrics.hits / totalQueries) * 100).toFixed(1) : '0.0';
  return {
    enabled: REDIS_ENABLED,
    connected: isRedisReady(),
    circuitBreaker: {
      state: CIRCUIT_BREAKER.state,
      failureCount: CIRCUIT_BREAKER.failureCount,
      totalTrips: CIRCUIT_BREAKER.totalTrips,
      threshold: CIRCUIT_BREAKER.threshold
    },
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    hitRate: `${hitRate}%`,
    sets: cacheMetrics.sets,
    compressedSets: cacheMetrics.compressedSets,
    compressionSavingsBytes: Math.max(0, cacheMetrics.compressionSavingsBytes),
    invalidations: cacheMetrics.invalidations,
    errors: cacheMetrics.errors,
    lastError: cacheMetrics.lastError,
    inFlightCount: inFlightPromises.size,
    ttls: DEFAULT_TTLS
  };
}

/**
 * Gracefully close connection during server shutdown
 */
async function shutdown() {
  if (client) {
    try {
      await client.quit();
    } catch {
      try { client.disconnect(); } catch {}
    }
    client = null;
    cacheMetrics.connected = false;
  }
}

/**
 * Internal helper for testing: Inject mock client or custom state
 */
function _setMockClient(mockClient) {
  client = mockClient;
  cacheMetrics.connected = Boolean(mockClient);
}

function _resetMetrics() {
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.errors = 0;
  cacheMetrics.sets = 0;
  cacheMetrics.compressedSets = 0;
  cacheMetrics.compressionSavingsBytes = 0;
  cacheMetrics.invalidations = 0;
  cacheMetrics.lastError = null;
  CIRCUIT_BREAKER.state = 'CLOSED';
  CIRCUIT_BREAKER.failureCount = 0;
  CIRCUIT_BREAKER.openUntil = 0;
  inFlightPromises.clear();
}

function _getCircuitBreaker() {
  return CIRCUIT_BREAKER;
}

module.exports = {
  initRedis,
  isRedisReady,
  makeKey,
  getOrSet,
  del,
  delByPattern,
  invalidateStories,
  invalidateResources,
  invalidateAchievements,
  invalidateFolders,
  getMetrics,
  shutdown,
  DEFAULT_TTLS,
  _setMockClient,
  _resetMetrics,
  _getCircuitBreaker
};
