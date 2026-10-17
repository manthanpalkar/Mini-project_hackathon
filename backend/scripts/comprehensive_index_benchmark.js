/**
 * LOOP — Comprehensive Multi-Run MongoDB Index Optimization Benchmark
 * 
 * Target: Isolated Local Database (mongodb://127.0.0.1:27018/loop_staging)
 * Evaluates candidate index redundancy and ESR compound coverage:
 * 1. resources.folderId_1
 * 2. resources.folderId_1_status_1
 * 3. folders.parentId_1
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const TARGET_URI = 'mongodb://127.0.0.1:27018/loop_staging';
const ITERATIONS = 5;

async function runBenchmark() {
  console.log('========================================================================');
  console.log('  LOOP — Multi-Run MongoDB Index Benchmark (127.0.0.1:27018/loop_staging)');
  console.log('========================================================================');

  await mongoose.connect(TARGET_URI, { serverSelectionTimeoutMS: 4000 });
  const db = mongoose.connection.db;

  // Strict isolation assertion
  if (mongoose.connection.port !== 27018 || mongoose.connection.name !== 'loop_staging') {
    throw new Error(`SAFETY HALT: Attempted to connect to invalid target: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
  }

  const resColl = db.collection('resources');
  const folderColl = db.collection('folders');

  // Step 1: Catalog initial index definitions
  const resIndexesOrig = await resColl.indexes();
  const folderIndexesOrig = await folderColl.indexes();

  console.log('\n[1/6] Original Index Catalog Preserved:');
  console.log(`Resources: ${resIndexesOrig.length} indexes`);
  resIndexesOrig.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));
  console.log(`Folders: ${folderIndexesOrig.length} indexes`);
  folderIndexesOrig.forEach(idx => console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`));

  const initialStats = {
    resources: await db.command({ collStats: 'resources' }),
    folders: await db.command({ collStats: 'folders' })
  };

  // Helper to extract plan metrics
  function parsePlan(explain) {
    const stats = explain.executionStats;
    const winning = explain.queryPlanner.winningPlan;
    let indexUsed = 'COLLSCAN';
    let inMemorySort = false;

    function walk(node) {
      if (!node) return;
      if (node.indexName) indexUsed = node.indexName;
      if (node.stage === 'SORT') inMemorySort = true;
      if (node.inputStage) walk(node.inputStage);
      if (node.inputStages) node.inputStages.forEach(walk);
    }
    walk(winning);

    return {
      timeMs: stats.executionTimeMillis,
      keysExamined: stats.totalKeysExamined,
      docsExamined: stats.totalDocsExamined,
      returned: stats.nReturned,
      stage: winning.stage,
      indexUsed,
      inMemorySort
    };
  }

  // Workload query definitions
  const workloads = {
    // Q1: Standard folder listing with sort (Page 1)
    q1_resources_sorted_p1: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved'
    }).sort({ createdAt: -1 }).limit(20).explain('executionStats'),

    // Q2: Deep pagination folder listing (Page 10, skip 180)
    q2_resources_sorted_deep: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved'
    }).sort({ createdAt: -1 }).skip(180).limit(20).explain('executionStats'),

    // Q3: Type filter + sort
    q3_resources_type_sorted: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved',
      type: 'PDF'
    }).sort({ createdAt: -1 }).limit(20).explain('executionStats'),

    // Q4: Status count query
    q4_resources_status_count: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved'
    }).explain('executionStats'),

    // Q5: Small batch $in lookup (4 folders) with projection
    q5_resources_batch_small: () => resColl.find({
      folderId: { $in: ['system-placement-material', 'system-dsa', 'syn-folder-0001', 'syn-folder-0002'] }
    }).project({ storageKey: 1, storageProvider: 1 }).explain('executionStats'),

    // Q6: Large batch $in lookup (25 folders)
    q6_resources_batch_large: () => {
      const folderList = Array.from({ length: 25 }, (_, i) => `syn-folder-${String(i + 1).padStart(4, '0')}`);
      return resColl.find({ folderId: { $in: folderList } }).project({ storageKey: 1 }).explain('executionStats');
    },

    // Q7: Parent folders hierarchy sorted
    q7_folders_hierarchy_sorted: () => folderColl.find({
      parentId: 'syn-folder-0001'
    }).sort({ isSystemFolder: -1, createdAt: 1 }).explain('executionStats'),

    // Q8: Recursive unsorted child folder discovery with projection
    q8_folders_children_unsorted: () => folderColl.find({
      parentId: 'syn-folder-0001'
    }).project({ id: 1 }).explain('executionStats')
  };

  async function benchmarkWorkload(name, queryFn, iterations = ITERATIONS) {
    const times = [];
    let lastStats = null;
    for (let i = 0; i < iterations; i++) {
      const explain = await queryFn();
      const stats = parsePlan(explain);
      times.push(stats.timeMs);
      lastStats = stats;
    }
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    return {
      ...lastStats,
      times,
      avgTime: parseFloat(avgTime.toFixed(2)),
      minTime,
      maxTime
    };
  }

  // Step 2: Measure Baseline
  console.log('\n[2/6] Measuring Baseline Performance (All 11 + 9 Indexes Active, 5 Iterations)...');
  const baselineResults = {};
  for (const [key, fn] of Object.entries(workloads)) {
    baselineResults[key] = await benchmarkWorkload(key, fn);
    console.log(`  ${key}: avg=${baselineResults[key].avgTime}ms (min=${baselineResults[key].minTime}ms, max=${baselineResults[key].maxTime}ms) | idx=${baselineResults[key].indexUsed} | keys=${baselineResults[key].keysExamined} | docs=${baselineResults[key].docsExamined}`);
  }

  // Step 3: Experiment A - Drop resources.folderId_1
  console.log('\n[3/6] Experiment A: Dropping resources.folderId_1...');
  await resColl.dropIndex('folderId_1');
  const expA_Results = {
    q5: await benchmarkWorkload('q5', workloads.q5_resources_batch_small),
    q6: await benchmarkWorkload('q6', workloads.q6_resources_batch_large)
  };
  console.log(`  Q5 (Batch 4 folders): avg=${expA_Results.q5.avgTime}ms | idx=${expA_Results.q5.indexUsed} | keys=${expA_Results.q5.keysExamined}`);
  console.log(`  Q6 (Batch 25 folders): avg=${expA_Results.q6.avgTime}ms | idx=${expA_Results.q6.indexUsed} | keys=${expA_Results.q6.keysExamined}`);

  // Step 4: Experiment B - Drop resources.folderId_1_status_1
  console.log('\n[4/6] Experiment B: Dropping resources.folderId_1_status_1...');
  await resColl.dropIndex('folderId_1_status_1');
  const expB_Results = {
    q1: await benchmarkWorkload('q1', workloads.q1_resources_sorted_p1),
    q2: await benchmarkWorkload('q2', workloads.q2_resources_sorted_deep),
    q3: await benchmarkWorkload('q3', workloads.q3_resources_type_sorted),
    q4: await benchmarkWorkload('q4', workloads.q4_resources_status_count)
  };
  console.log(`  Q1 (Sorted Page 1): avg=${expB_Results.q1.avgTime}ms | idx=${expB_Results.q1.indexUsed} | inMemSort=${expB_Results.q1.inMemorySort}`);
  console.log(`  Q2 (Deep Page 10): avg=${expB_Results.q2.avgTime}ms | idx=${expB_Results.q2.indexUsed} | inMemSort=${expB_Results.q2.inMemorySort}`);
  console.log(`  Q3 (Type filtered): avg=${expB_Results.q3.avgTime}ms | idx=${expB_Results.q3.indexUsed} | inMemSort=${expB_Results.q3.inMemorySort}`);
  console.log(`  Q4 (Status count): avg=${expB_Results.q4.avgTime}ms | idx=${expB_Results.q4.indexUsed} | keys=${expB_Results.q4.keysExamined}`);

  // Step 5: Experiment C - Drop folders.parentId_1
  console.log('\n[5/6] Experiment C: Dropping folders.parentId_1...');
  await folderColl.dropIndex('parentId_1');
  const expC_Results = {
    q7: await benchmarkWorkload('q7', workloads.q7_folders_hierarchy_sorted),
    q8: await benchmarkWorkload('q8', workloads.q8_folders_children_unsorted)
  };
  console.log(`  Q7 (Hierarchy sorted): avg=${expC_Results.q7.avgTime}ms | idx=${expC_Results.q7.indexUsed} | inMemSort=${expC_Results.q7.inMemorySort}`);
  console.log(`  Q8 (Children unsorted): avg=${expC_Results.q8.avgTime}ms | idx=${expC_Results.q8.indexUsed} | keys=${expC_Results.q8.keysExamined}`);

  // Measure Storage Reclaimed
  const postDropStats = {
    resources: await db.command({ collStats: 'resources' }),
    folders: await db.command({ collStats: 'folders' })
  };
  const resReclaimed = initialStats.resources.totalIndexSize - postDropStats.resources.totalIndexSize;
  const folderReclaimed = initialStats.folders.totalIndexSize - postDropStats.folders.totalIndexSize;
  const totalReclaimed = resReclaimed + folderReclaimed;

  console.log('\nStorage Space Analysis:');
  console.log(`  Resources totalIndexSize: ${initialStats.resources.totalIndexSize} -> ${postDropStats.resources.totalIndexSize} (Reclaimed: ${resReclaimed} bytes)`);
  console.log(`  Folders totalIndexSize:   ${initialStats.folders.totalIndexSize} -> ${postDropStats.folders.totalIndexSize} (Reclaimed: ${folderReclaimed} bytes)`);
  console.log(`  Combined Reclaimed RAM/Storage: ${totalReclaimed} bytes (~${(totalReclaimed / 1024).toFixed(1)} KB)`);

  // Step 6: Rollback and Parity Verification
  console.log('\n[6/6] Restoring Original Index Definitions (Rollback Verification)...');
  await resColl.createIndex({ folderId: 1 });
  await resColl.createIndex({ folderId: 1, status: 1 });
  await folderColl.createIndex({ parentId: 1 });

  const resIndexesRestored = await resColl.indexes();
  const folderIndexesRestored = await folderColl.indexes();

  const resParity = resIndexesOrig.length === resIndexesRestored.length &&
    resIndexesOrig.every(orig => resIndexesRestored.some(r => r.name === orig.name));
  const folderParity = folderIndexesOrig.length === folderIndexesRestored.length &&
    folderIndexesOrig.every(orig => folderIndexesRestored.some(r => r.name === orig.name));

  if (!resParity || !folderParity) {
    throw new Error('ROLLBACK PARITY ERROR: Staging index counts or definitions do not match baseline!');
  }
  console.log('✔ ROLLBACK SUCCESSFUL: All candidate indexes restored with 100% parity.');

  await mongoose.disconnect();

  return {
    initialStats,
    postDropStats,
    reclaimedBytes: totalReclaimed,
    baselineResults,
    expA_Results,
    expB_Results,
    expC_Results,
    parityConfirmed: true
  };
}

runBenchmark().then(res => {
  console.log('\n========================================================================');
  console.log('  BENCHMARK FINISHED SUCCESSFULLY WITH PARITY RESTORATION CONFIRMED     ');
  console.log('========================================================================');
}).catch(err => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
