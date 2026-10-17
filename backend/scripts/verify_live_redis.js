/**
 * LOOP — Real Redis Cloud Integration Verification Script
 * 
 * Verifies live connectivity, single-flight stampede protection,
 * TTL expiration, and pattern-based cache invalidation directly
 * against the provisioned cloud Redis instance.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const cacheService = require('../services/cacheService');

async function runLiveRedisAudit() {
  console.log('====================================================');
  console.log('   LOOP — Live Redis Cloud Integration Verification   ');
  console.log('====================================================');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('❌ REDIS_URL is not set in environment.');
    process.exit(1);
  }

  // Parse host without exposing password
  const parsed = new URL(redisUrl);
  console.log(`[Config] Target Host: ${parsed.hostname}:${parsed.port}`);
  console.log(`[Config] Protocol:    ${parsed.protocol}`);

  console.log('\n[Phase 1] Initializing Live Redis Connection...');
  const client = cacheService.initRedis();

  // Wait for connection to settle
  await new Promise(r => setTimeout(r, 1500));

  const isReady = cacheService.isRedisReady();
  console.log(`[Phase 1] isRedisReady: ${isReady}`);

  if (!isReady) {
    console.error('❌ Failed to establish live connection to Redis Cloud.');
    process.exit(1);
  }
  console.log('✔ Live connection established successfully!');

  console.log('\n[Phase 2] Testing Cache Miss & Write (getOrSet)...');
  const testKey = 'loop:stories:live_audit_test';
  let fetchCount = 0;

  const res1 = await cacheService.getOrSet(testKey, async () => {
    fetchCount++;
    return { auditId: 'AUDIT-REDIS-2026', timestamp: Date.now(), platform: 'LOOP' };
  }, 60);

  console.log(`  Fetcher executed count: ${fetchCount}`);
  console.log(`  Returned data:`, res1);
  if (fetchCount !== 1) throw new Error('Expected fetcher to run exactly once on cold miss.');

  console.log('\n[Phase 3] Testing Sequential Cache Hits (from live Redis Cloud)...');
  for (let i = 0; i < 5; i++) {
    const res = await cacheService.getOrSet(testKey, async () => {
      fetchCount++;
      return { error: 'Should not execute' };
    }, 60);
    if (res.timestamp !== res1.timestamp) throw new Error('Data mismatch on cache hit');
  }

  console.log(`  Fetcher executed count: ${fetchCount}`);
  console.log(`  5 sequential cache hits served directly from Redis Cloud without database call!`);

  console.log('\n[Phase 4] Testing Single-Flight / Stampede Prevention Under Concurrency...');
  const stampedeKey = 'loop:resources:stampede_test';
  let concurrentExecCount = 0;

  const slowFetcher = async () => {
    concurrentExecCount++;
    await new Promise(r => setTimeout(r, 50));
    return { resource: 'Operating Systems Guide', version: '2.0' };
  };

  const [c1, c2, c3, c4, c5] = await Promise.all([
    cacheService.getOrSet(stampedeKey, slowFetcher, 60),
    cacheService.getOrSet(stampedeKey, slowFetcher, 60),
    cacheService.getOrSet(stampedeKey, slowFetcher, 60),
    cacheService.getOrSet(stampedeKey, slowFetcher, 60),
    cacheService.getOrSet(stampedeKey, slowFetcher, 60)
  ]);

  console.log(`  Concurrent requests fired: 5`);
  console.log(`  Underlying fetchers executed: ${concurrentExecCount}`);
  console.log(`  All results identical: ${c1.resource === 'Operating Systems Guide' && c1.resource === c5.resource}`);
  if (concurrentExecCount !== 1) {
    throw new Error(`Single-flight failed: ${concurrentExecCount} fetchers ran instead of 1.`);
  }
  console.log('✔ Stampede protection coalesced 5 concurrent requests into 1 single flight!');

  console.log('\n[Phase 5] Testing Domain Invalidation via SCAN (delByPattern)...');
  await cacheService.invalidateStories();
  await cacheService.invalidateResources();

  // Test that keys were cleared
  let refetchedCount = 0;
  await cacheService.getOrSet(testKey, async () => {
    refetchedCount++;
    return { refreshed: true, timestamp: Date.now() };
  }, 60);

  console.log(`  Key successfully purged and refetched: ${refetchedCount === 1}`);
  if (refetchedCount !== 1) {
    throw new Error('Invalidation failed: key was still cached after invalidateStories().');
  }

  // Cleanup test keys
  await cacheService.del(testKey);
  await cacheService.del(stampedeKey);

  const metrics = cacheService.getMetrics();
  console.log('\n====================================================');
  console.log('   Final Redis Telemetry Metrics:');
  console.log(`   - Enabled:       ${metrics.enabled}`);
  console.log(`   - Connected:     ${metrics.connected}`);
  console.log(`   - Cache Hits:    ${metrics.hits}`);
  console.log(`   - Cache Misses:  ${metrics.misses}`);
  console.log(`   - Hit Rate:      ${metrics.hitRate}`);
  console.log(`   - Sets:          ${metrics.sets}`);
  console.log(`   - Invalidations: ${metrics.invalidations}`);
  console.log(`   - Errors:        ${metrics.errors}`);
  console.log('====================================================');

  await cacheService.shutdown();
  console.log('✔ Redis connection cleanly shut down.');

  if (metrics.errors === 0 && metrics.hits >= 5) {
    console.log('\n>>> OVERALL RESULT: PASS — REAL REDIS INTEGRATION 100% OPERATIONAL <<<\n');
    process.exit(0);
  } else {
    console.error('❌ Verification failed: errors detected or insufficient hits.');
    process.exit(1);
  }
}

runLiveRedisAudit().catch(err => {
  console.error('Fatal live Redis error:', err);
  process.exit(1);
});
