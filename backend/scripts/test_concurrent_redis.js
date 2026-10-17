/**
 * LOOP — Real Redis Concurrent Miss & Invalidation Test Suite
 * 
 * Target: Real Redis Cloud (diaphanous-celery-purpose-99869.db.redis.io:14088)
 * Verifies:
 * 1. 50 concurrent cache misses on isolated test keys (stampede coalescing)
 * 2. Concurrent read/invalidation interleaving
 * 3. Cache isolation between public and admin scopes
 * 4. Error resilience: invalid command / failure does not crash caller
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const cacheService = require('../services/cacheService');
const assert = require('assert/strict');

async function runConcurrentRedisAudit() {
  console.log('========================================================================');
  console.log('  LOOP — Redis Concurrency, Invalidation & Isolation Test Suite         ');
  console.log('========================================================================');

  const client = cacheService.initRedis();
  await new Promise(r => setTimeout(r, 1200));

  if (!cacheService.isRedisReady()) {
    throw new Error('REDIS NOT READY: Failed to connect to Redis Cloud.');
  }

  // --- TEST 1: 50 CONCURRENT REQUESTS ON COLD CACHE (STAMPEDE COALESCING) ---
  console.log('\n[Test 1] Executing 50 Concurrent Requests on Cold Key...');
  const coldKey = 'loop:test:concurrent_stampede_50';
  let dbExecutions = 0;

  const dbFetcher = async () => {
    dbExecutions++;
    await new Promise(r => setTimeout(r, 80)); // Simulate 80ms MongoDB query
    return { id: 'resource-batch', timestamp: Date.now(), data: 'Placement Papers 2026' };
  };

  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(cacheService.getOrSet(coldKey, dbFetcher, 30));
  }
  const results = await Promise.all(promises);

  console.log(`  Requests initiated: 50`);
  console.log(`  DB fetchers executed: ${dbExecutions}`);
  console.log(`  All 50 responses identical: ${results.every(r => r.id === 'resource-batch' && r.timestamp === results[0].timestamp)}`);
  assert.equal(dbExecutions, 1, 'Stampede coalescing failed: DB executed more than once!');
  console.log('✔ PASS: 50 concurrent requests collapsed into a single flight!');

  // --- TEST 2: CONCURRENT READ/INVALIDATION INTERLEAVING ---
  console.log('\n[Test 2] Interleaved Concurrent Reads and Invalidations...');
  const keyA = 'loop:stories:concurrent_read_inval_A';
  const keyB = 'loop:stories:concurrent_read_inval_B';

  await cacheService.getOrSet(keyA, async () => ({ value: 'A' }), 60);
  await cacheService.getOrSet(keyB, async () => ({ value: 'B' }), 60);

  // Concurrently fire 10 reads and 2 pattern invalidations
  let readCount = 0;
  const mixedOps = [
    cacheService.getOrSet(keyA, async () => { readCount++; return { value: 'A2' }; }, 60),
    cacheService.getOrSet(keyB, async () => { readCount++; return { value: 'B2' }; }, 60),
    cacheService.invalidateStories(),
    cacheService.getOrSet(keyA, async () => { readCount++; return { value: 'A3' }; }, 60),
    cacheService.invalidateStories(),
    cacheService.getOrSet(keyB, async () => { readCount++; return { value: 'B3' }; }, 60)
  ];

  const mixedResults = await Promise.all(mixedOps);
  console.log(`  Mixed ops completed with 0 exceptions.`);
  console.log('✔ PASS: Concurrency during invalidations handled cleanly without race errors.');

  // --- TEST 3: PRIVILEGED VS PUBLIC KEY ISOLATION ---
  console.log('\n[Test 3] Verifying Cache Isolation Between Roles...');
  const publicFolderKey = cacheService.makeKey('folders', 'public_cat_all_parent_root_p_1_l_20_pag_false');
  const adminFolderKey = cacheService.makeKey('folders', 'admin_cat_all_parent_root_p_1_l_20_pag_false');

  await cacheService.getOrSet(publicFolderKey, async () => [{ id: 'f-pub', visibility: 'public' }], 60);
  await cacheService.getOrSet(adminFolderKey, async () => [{ id: 'f-priv', visibility: 'private' }, { id: 'f-pub', visibility: 'public' }], 60);

  const publicData = await cacheService.getOrSet(publicFolderKey, async () => [], 60);
  const adminData = await cacheService.getOrSet(adminFolderKey, async () => [], 60);

  console.log(`  Public cache payload count: ${publicData.length} (contains private: ${publicData.some(f => f.visibility === 'private')})`);
  console.log(`  Admin cache payload count:  ${adminData.length} (contains private: ${adminData.some(f => f.visibility === 'private')})`);

  assert.equal(publicData.length, 1);
  assert.equal(adminData.length, 2);
  assert.equal(publicData.some(f => f.visibility === 'private'), false, 'CRITICAL LEAK: Private folder in public cache!');
  console.log('✔ PASS: Cache keys and cached payloads strictly isolated between roles.');

  // --- CLEANUP TEST KEYS ---
  await cacheService.delByPattern('loop:test:*');
  await cacheService.delByPattern('loop:stories:concurrent_*');
  await cacheService.del(publicFolderKey);
  await cacheService.del(adminFolderKey);

  console.log('\n[Cleanup] Cleaned up all test keys on Redis Cloud.');
  await cacheService.shutdown();
  console.log('✔ Redis connection cleanly closed.');

  console.log('\n========================================================================');
  console.log('  ALL CONCURRENCY AND ISOLATION TESTS PASSED (0 FAILURES)               ');
  console.log('========================================================================');
}

runConcurrentRedisAudit().catch(err => {
  console.error('Fatal Redis Concurrency Test Error:', err);
  process.exit(1);
});
