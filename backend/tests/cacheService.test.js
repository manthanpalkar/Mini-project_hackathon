const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const cacheService = require('../services/cacheService');

describe('Redis Cache Service & Resilient Fallback', () => {

  beforeEach(() => {
    cacheService._resetMetrics();
  });

  test('Fallback Mode: Transparently queries fallback fetcher when Redis is disabled/offline', async () => {
    // With no Redis connected, getOrSet must execute fetcher directly without error
    cacheService._setMockClient(null);

    let dbCallCount = 0;
    const fetcher = async () => {
      dbCallCount++;
      return [{ id: 'story-1', title: 'Google SWE Placement' }];
    };

    const result = await cacheService.getOrSet('loop:stories:list', fetcher, 60);

    assert.equal(dbCallCount, 1);
    assert.deepEqual(result, [{ id: 'story-1', title: 'Google SWE Placement' }]);
    
    const metrics = cacheService.getMetrics();
    assert.equal(metrics.connected, false);
    assert.equal(metrics.misses, 1);
    assert.equal(metrics.hits, 0);
  });

  test('Cache Hit: Serves data directly from Redis when key exists', async () => {
    const store = new Map();
    store.set('loop:stories:list', JSON.stringify([{ id: 'story-1', title: 'Cached Story' }]));

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (k) => store.delete(k)
    };

    cacheService._setMockClient(mockClient);

    let dbCallCount = 0;
    const fetcher = async () => {
      dbCallCount++;
      return [{ id: 'story-db', title: 'DB Story' }];
    };

    const result = await cacheService.getOrSet('loop:stories:list', fetcher, 60);

    // Database should NOT be called on a hit
    assert.equal(dbCallCount, 0);
    assert.deepEqual(result, [{ id: 'story-1', title: 'Cached Story' }]);

    const metrics = cacheService.getMetrics();
    assert.equal(metrics.hits, 1);
    assert.equal(metrics.misses, 0);
    assert.equal(metrics.hitRate, '100.0%');
  });

  test('Cache Miss & Populate: Fetches from DB and populates Redis with correct TTL', async () => {
    const store = new Map();
    const setOptions = {};

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v, opts) => {
        store.set(k, v);
        setOptions[k] = opts;
      },
      del: async (k) => store.delete(k)
    };

    cacheService._setMockClient(mockClient);

    let dbCallCount = 0;
    const fetcher = async () => {
      dbCallCount++;
      return { id: 'ach-1', title: 'Smart India Hackathon Winner' };
    };

    const key = cacheService.makeKey('achievements:detail', 'ach-1');
    const result = await cacheService.getOrSet(key, fetcher, 300);

    assert.equal(dbCallCount, 1);
    assert.deepEqual(result, { id: 'ach-1', title: 'Smart India Hackathon Winner' });
    assert.equal(store.has(key), true);
    assert.equal(setOptions[key]?.EX, 300);

    // Second call should hit the cache!
    const cachedResult = await cacheService.getOrSet(key, fetcher, 300);
    assert.equal(dbCallCount, 1); // dbCallCount still 1!
    assert.deepEqual(cachedResult, { id: 'ach-1', title: 'Smart India Hackathon Winner' });

    const metrics = cacheService.getMetrics();
    assert.equal(metrics.hits, 1);
    assert.equal(metrics.misses, 1);
    assert.equal(metrics.hitRate, '50.0%');
  });

  test('Single-Flight / Stampede Prevention: Coalesces concurrent misses into single DB query', async () => {
    const store = new Map();

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (k) => store.delete(k)
    };

    cacheService._setMockClient(mockClient);

    let dbCallCount = 0;
    const slowFetcher = async () => {
      dbCallCount++;
      // Simulate 50ms async DB aggregation
      await new Promise(r => setTimeout(r, 50));
      return [{ id: 'res-1', title: 'Operating Systems Notes' }];
    };

    const key = 'loop:resources:list:system';

    // Fire 5 concurrent requests simultaneously for the same cold cache key
    const [r1, r2, r3, r4, r5] = await Promise.all([
      cacheService.getOrSet(key, slowFetcher, 120),
      cacheService.getOrSet(key, slowFetcher, 120),
      cacheService.getOrSet(key, slowFetcher, 120),
      cacheService.getOrSet(key, slowFetcher, 120),
      cacheService.getOrSet(key, slowFetcher, 120)
    ]);

    // Stampede prevention MUST coalesce these so dbCallCount is strictly 1
    assert.equal(dbCallCount, 1);
    assert.deepEqual(r1, r2);
    assert.deepEqual(r3, r4);
    assert.equal(r1[0].title, 'Operating Systems Notes');
  });

  test('Malformed Cache Data Recovery: Purges corrupt entry and recovers from DB', async () => {
    const store = new Map();
    const key = 'loop:stories:corrupt';
    store.set(key, 'INVALID_NON_JSON_CORRUPTED_STRING{{{');

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (k) => store.delete(k)
    };

    cacheService._setMockClient(mockClient);

    const fetcher = async () => ({ id: 'recovered', status: 'valid' });
    const result = await cacheService.getOrSet(key, fetcher, 60);

    assert.deepEqual(result, { id: 'recovered', status: 'valid' });
    // Corrupt key was purged and replaced with valid data
    assert.equal(JSON.parse(store.get(key)).id, 'recovered');
  });

  test('Redis Client Failure Resiliency: Does not throw when Redis get/set fails', async () => {
    const mockClient = {
      isOpen: true,
      get: async () => { throw new Error('ECONNRESET connection terminated'); },
      set: async () => { throw new Error('OOM command not allowed'); },
      del: async () => {}
    };

    cacheService._setMockClient(mockClient);

    const fetcher = async () => ({ status: 'success from mongo' });
    const result = await cacheService.getOrSet('loop:test:error', fetcher, 60);

    // Must return mongo result smoothly without throwing
    assert.deepEqual(result, { status: 'success from mongo' });
    const metrics = cacheService.getMetrics();
    assert.ok(metrics.errors > 0);
  });

  test('Domain Invalidation: invalidateStories removes list and detail keys', async () => {
    const store = new Map();
    store.set('loop:stories:list', '["story1"]');
    store.set('loop:stories:list:page1', '["story1"]');
    store.set('loop:stories:detail:story-123', '{"id":"story-123"}');
    store.set('loop:resources:list', '["res1"]'); // Unrelated key must NOT be touched

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => store.delete(k));
      },
      scan: async (cursor, opts) => {
        const pattern = opts.MATCH.replace('*', '');
        const matching = Array.from(store.keys()).filter(k => k.startsWith(pattern));
        return { cursor: 0, keys: matching };
      }
    };

    cacheService._setMockClient(mockClient);

    await cacheService.invalidateStories('story-123');

    assert.equal(store.has('loop:stories:list'), false);
    assert.equal(store.has('loop:stories:list:page1'), false);
    assert.equal(store.has('loop:stories:detail:story-123'), false);
    // Resources key was preserved!
    assert.equal(store.has('loop:resources:list'), true);
  });

  test('Domain Invalidation: invalidateResources, invalidateAchievements, and invalidateFolders work accurately', async () => {
    const store = new Map();
    store.set('loop:resources:list:root', '["res1"]');
    store.set('loop:resources:detail:res-10', '{"id":"res-10"}');
    store.set('loop:achievements:list', '["ach1"]');
    store.set('loop:folders:system:root', '["f1"]');

    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => store.delete(k));
      },
      scan: async (cursor, opts) => {
        const pattern = opts.MATCH.replace('*', '');
        const matching = Array.from(store.keys()).filter(k => k.startsWith(pattern));
        return { cursor: 0, keys: matching };
      }
    };

    cacheService._setMockClient(mockClient);

    await cacheService.invalidateResources('res-10');
    assert.equal(store.has('loop:resources:list:root'), false);
    assert.equal(store.has('loop:resources:detail:res-10'), false);
    assert.equal(store.has('loop:achievements:list'), true);

    await cacheService.invalidateAchievements();
    assert.equal(store.has('loop:achievements:list'), false);

    await cacheService.invalidateFolders();
    assert.equal(store.has('loop:folders:system:root'), false);
  });

  test('Configured Default TTLs are positive integers', () => {
    assert.ok(cacheService.DEFAULT_TTLS.stories > 0);
    assert.ok(cacheService.DEFAULT_TTLS.storyDetail > 0);
    assert.ok(cacheService.DEFAULT_TTLS.resources > 0);
    assert.ok(cacheService.DEFAULT_TTLS.folders > 0);
    assert.ok(cacheService.DEFAULT_TTLS.achievements > 0);
  });

  test('Disconnection and Reconnection Lifecycle: Degrades gracefully on disconnect and recovers when reconnected', async () => {
    let isConnected = true;
    const store = new Map();
    store.set('loop:test:reconnect', JSON.stringify({ source: 'redis' }));

    const mockClient = {
      get isOpen() { return isConnected; },
      get: async (k) => {
        if (!isConnected) throw new Error('ClientClosedError: The client is closed');
        return store.get(k) || null;
      },
      set: async (k, v) => {
        if (!isConnected) throw new Error('ClientClosedError: The client is closed');
        store.set(k, v);
      },
      del: async (k) => {
        if (!isConnected) throw new Error('ClientClosedError: The client is closed');
        store.delete(k);
      }
    };

    cacheService._setMockClient(mockClient);

    // 1. Initial hit when connected
    let dbCount = 0;
    const fetcher = async () => { dbCount++; return { source: 'mongodb' }; };
    const res1 = await cacheService.getOrSet('loop:test:reconnect', fetcher, 60);
    assert.equal(res1.source, 'redis');
    assert.equal(dbCount, 0);

    // 2. Disconnect Redis
    isConnected = false;
    cacheService._setMockClient(null); // Simulated end / offline
    const res2 = await cacheService.getOrSet('loop:test:reconnect', fetcher, 60);
    assert.equal(res2.source, 'mongodb');
    assert.equal(dbCount, 1);

    // 3. Reconnect Redis
    isConnected = true;
    cacheService._setMockClient(mockClient);
    const res3 = await cacheService.getOrSet('loop:test:reconnect', fetcher, 60);
    assert.equal(res3.source, 'redis');
    assert.equal(dbCount, 1); // Not incremented, served from Redis
  });

  test('Cache Isolation: Keys for admin-only views never collide with public views', () => {
    const publicKey = cacheService.makeKey('folders', 'public_cat_all_parent_root_p_1_l_20_pag_false');
    const adminKey = cacheService.makeKey('folders', 'admin_cat_all_parent_root_p_1_l_20_pag_false');

    assert.notEqual(publicKey, adminKey);
    assert.ok(publicKey.includes('public'));
    assert.ok(adminKey.includes('admin'));
  });

  test('Single-Flight Error Resilience: Cleans in-flight promise on error so subsequent requests can retry', async () => {
    cacheService._setMockClient(null);

    let attempts = 0;
    const failingFetcher = async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Temporary MongoDB Network Error');
      }
      return [{ id: 'recovered-item' }];
    };

    const key = 'loop:test:failing_key';

    // First attempt should reject
    await assert.rejects(
      async () => await cacheService.getOrSet(key, failingFetcher, 60),
      { message: 'Temporary MongoDB Network Error' }
    );

    // In-flight map must be empty for this key
    const metrics = cacheService.getMetrics();
    assert.equal(metrics.inFlightCount, 0);

    // Second attempt should succeed and execute fetcher again (retry)
    const retryResult = await cacheService.getOrSet(key, failingFetcher, 60);
    assert.equal(attempts, 2);
    assert.deepEqual(retryResult, [{ id: 'recovered-item' }]);
  });

  test('Payload Compression: Compresses large JSON payloads (>1KB) and restores them transparently', async () => {
    const store = new Map();
    const mockClient = {
      isOpen: true,
      get: async (k) => store.get(k) || null,
      set: async (k, v) => store.set(k, v),
      del: async (k) => store.delete(k)
    };
    cacheService._setMockClient(mockClient);

    // Create payload larger than 1 KB
    const largeArray = Array.from({ length: 50 }, (_, i) => ({
      id: `story-${i}`,
      title: `Interview Debrief at Tech Firm ${i}`,
      company: `Company ${i}`,
      description: 'Extensive interview debrief detailing round-by-round selection criteria, coding challenges, system design, and managerial behavioral interview questions.'
    }));

    // Cache miss and populate
    const result1 = await cacheService.getOrSet('loop:test:large_payload', async () => largeArray, 60);
    assert.deepEqual(result1, largeArray);

    // Verify stored payload in mock Redis starts with compression prefix '__gz:'
    const rawStored = store.get('loop:test:large_payload');
    assert.ok(rawStored.startsWith('__gz:'), 'Payload must be compressed with __gz: prefix');
    assert.ok(rawStored.length < JSON.stringify(largeArray).length, 'Compressed payload must be smaller than raw JSON');

    // Cache hit should transparently decompress
    const result2 = await cacheService.getOrSet('loop:test:large_payload', async () => [], 60);
    assert.deepEqual(result2, largeArray);
  });
});
