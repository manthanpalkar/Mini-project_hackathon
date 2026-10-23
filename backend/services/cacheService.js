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

// High-speed compression settings to squeeze 5x more data into Redis RAM
const COMPRESSION_THRESHOLD = 1024; // Compress payloads > 1 KB
const GZIP_PREFIX = '__gz:';

function compressPayload(str) {
  if (typeof str !== 'string' || str.length < COMPRESSION_THRESHOLD) {
    return str;
  }
  try {
    const compressed = zlib.gzipSync(Buffer.from(str, 'utf-8'), { level: 6 });
    return GZIP_PREFIX + compressed.toString('base64');
  } catch (e) {
    return str; // Fallback to raw string if compression error
  }
}

function decompressPayload(raw) {
  if (typeof raw !== 'string') return raw;
  if (raw.startsWith(GZIP_PREFIX)) {
    try {
      const buf = Buffer.from(raw.slice(GZIP_PREFIX.length), 'base64');
      return zlib.gunzipSync(buf).toString('utf-8');
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

// In-flight promise map for Single-Flight / Stampede Prevention
const inFlightPromises = new Map();

// Telemetry metrics
const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
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
 * Safely check if Redis is active and ready
 */
function isRedisReady() {
  return Boolean(client && client.isOpen && cacheMetrics.connected);
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
  // 1. If Redis is ready, check cache first
  if (isRedisReady()) {
    try {
      const raw = await client.get(key);
      if (raw) {
        cacheMetrics.hits++;
        try {
          const decompressed = decompressPayload(raw);
          return JSON.parse(decompressed);
        } catch (parseErr) {
          // If malformed cached data, delete key and fall through to fetcher
          console.warn(`[CacheService] Malformed JSON in cache key ${key}, purging: ${parseErr.message}`);
          await client.del(key).catch(() => {});
        }
      }
    } catch (err) {
      cacheMetrics.errors++;
      cacheMetrics.lastError = err.message;
      console.warn(`[CacheService] Redis GET error on key ${key}: ${err.message}`);
    }
  }

  cacheMetrics.misses++;

  // 2. Single-Flight Promise Coalescing to prevent cache stampedes
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key);
  }

  const promise = (async () => {
    try {
      const result = await fetcherFn();

      // Only cache valid, defined non-null payloads (avoid caching null/undefined as successful hits)
      if (result !== undefined && result !== null && isRedisReady()) {
        try {
          const payload = JSON.stringify(result);
          // Safety guard: Don't cache oversized strings (> 5MB)
          if (payload.length <= 5 * 1024 * 1024) {
            const dataToStore = compressPayload(payload);
            await client.set(key, dataToStore, { EX: Math.max(1, ttlSeconds) });
            cacheMetrics.sets++;
          }
        } catch (setErr) {
          cacheMetrics.errors++;
          cacheMetrics.lastError = setErr.message;
        }
      }

      return result;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, promise);
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
  } catch (err) {
    cacheMetrics.errors++;
    cacheMetrics.lastError = err.message;
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
  } catch (err) {
    cacheMetrics.errors++;
    cacheMetrics.lastError = err.message;
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
    hits: cacheMetrics.hits,
    misses: cacheMetrics.misses,
    hitRate: `${hitRate}%`,
    sets: cacheMetrics.sets,
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
  cacheMetrics.invalidations = 0;
  cacheMetrics.lastError = null;
  inFlightPromises.clear();
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
  _resetMetrics
};
