/**
 * LOOP — Automated MongoDB Staging Index Optimization Benchmark Suite
 * 
 * Executes an empirical, before-and-after query optimization audit
 * on the isolated local staging database (127.0.0.1:27018/loop_staging).
 * 
 * Evaluates candidate index removals:
 * 1. resources.folderId_1
 * 2. resources.folderId_1_status_1
 * 3. folders.parentId_1
 * 
 * Compares:
 * - executionTimeMillis
 * - totalKeysExamined vs totalDocsExamined
 * - winningPlan stages (IXSCAN vs SORT/COLLSCAN)
 * - Index storage space reclamation
 * - Rollback verification
 */

const path = require('path');
process.env.ENV_FILE = '.env.local.test';
require('dotenv').config({ path: path.join(__dirname, '../.env.local.test') });
const mongoose = require('mongoose');

async function runIndexBenchmarkSuite() {
  console.log('======================================================================');
  console.log('  LOOP — MongoDB Index Optimization Benchmark (loop_staging:27018)    ');
  console.log('======================================================================');

  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.includes('27018') || !uri.includes('loop_staging')) {
    console.error('FATAL: Refusing to benchmark. URI is not strictly 127.0.0.1:27018/loop_staging.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  const db = mongoose.connection.db;

  console.log(`Connected to: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);
  if (mongoose.connection.port !== 27018 || mongoose.connection.name !== 'loop_staging') {
    console.error('FATAL ISOLATION FAILURE: Connected to non-staging database!');
    process.exit(1);
  }

  // --- TASK 3: AUDIT EXISTING INDEXES ---
  console.log('\n--- TASK 3: INITIAL INDEX CATALOG & SIZES ---');
  const resColl = db.collection('resources');
  const folderColl = db.collection('folders');

  const resIndexesBefore = await resColl.indexes();
  const folderIndexesBefore = await folderColl.indexes();
  const resStatsBefore = await db.command({ collStats: 'resources' });
  const folderStatsBefore = await db.command({ collStats: 'folders' });

  console.log(`Resources Collection: ${resStatsBefore.count} documents, Storage: ${resStatsBefore.storageSize} bytes`);
  console.log(`Resources Total Index Size: ${resStatsBefore.totalIndexSize} bytes across ${resIndexesBefore.length} indexes`);
  console.log(`Folders Collection:   ${folderStatsBefore.count} documents, Storage: ${folderStatsBefore.storageSize} bytes`);
  console.log(`Folders Total Index Size:   ${folderStatsBefore.totalIndexSize} bytes across ${folderIndexesBefore.length} indexes`);

  // Define representative queries matching application server.js
  const queries = {
    // Q1: Folder listing approved resources with sort (Primary read path, server.js:2461)
    q1_resources_folder_sorted: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved'
    }).sort({ createdAt: -1 }).limit(20).explain('executionStats'),

    // Q2: Folder listing with category filter + sort (server.js:2431)
    q2_resources_type_sorted: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved',
      type: 'PDF'
    }).sort({ createdAt: -1 }).limit(20).explain('executionStats'),

    // Q3: Unsorted batch lookup by folderIds ($in) (Cascade delete, server.js:869)
    q3_resources_folder_batch: () => resColl.find({
      folderId: { $in: ['system-placement-material', 'system-dsa', 'syn-folder-0001', 'syn-folder-0002'] }
    }).project({ storageKey: 1, storageProvider: 1 }).explain('executionStats'),

    // Q4: Status count query (server.js:2458)
    q4_resources_status_count: () => resColl.find({
      folderId: 'system-placement-material',
      status: 'approved'
    }).explain('executionStats'),

    // Q5: Folder hierarchy listing with system sort (Primary folders read path, server.js:714)
    q5_folders_parent_sorted: () => folderColl.find({
      parentId: 'syn-folder-0001'
    }).sort({ isSystemFolder: -1, createdAt: 1 }).explain('executionStats'),

    // Q6: Unsorted recursive folder child discovery (server.js:860)
    q6_folders_parent_unsorted: () => folderColl.find({
      parentId: 'syn-folder-0001'
    }).project({ id: 1 }).explain('executionStats')
  };

  function extractStats(explainOutput) {
    const stats = explainOutput.executionStats;
    const winningPlan = explainOutput.queryPlanner.winningPlan;
    
    // Find index name if present in stages
    let indexName = 'NONE';
    let hasSortStage = false;

    function walkPlan(plan) {
      if (!plan) return;
      if (plan.indexName) indexName = plan.indexName;
      if (plan.stage === 'SORT') hasSortStage = true;
      if (plan.inputStage) walkPlan(plan.inputStage);
      if (plan.inputStages) plan.inputStages.forEach(walkPlan);
    }
    walkPlan(winningPlan);

    return {
      nReturned: stats.nReturned,
      totalKeysExamined: stats.totalKeysExamined,
      totalDocsExamined: stats.totalDocsExamined,
      executionTimeMillis: stats.executionTimeMillis,
      stage: winningPlan.stage,
      indexUsed: indexName,
      inMemorySort: hasSortStage
    };
  }

  // --- TASK 4: MEASURE BASELINE ---
  console.log('\n--- TASK 4: BASELINE MEASUREMENTS (ALL 11 + 9 INDEXES ACTIVE) ---');
  const baselineResults = {};
  for (const [name, qFn] of Object.entries(queries)) {
    const explain = await qFn();
    baselineResults[name] = extractStats(explain);
    console.log(`[Baseline] ${name}:`);
    console.log(`  Stage: ${baselineResults[name].stage} | Index: ${baselineResults[name].indexUsed} | In-Memory Sort: ${baselineResults[name].inMemorySort}`);
    console.log(`  Keys: ${baselineResults[name].totalKeysExamined} | Docs: ${baselineResults[name].totalDocsExamined} | Time: ${baselineResults[name].executionTimeMillis}ms | Returned: ${baselineResults[name].nReturned}`);
  }

  // --- EXPERIMENT 1: DROP resources.folderId_1 ---
  console.log('\n--- EXPERIMENT 1: DROPPING resources.folderId_1 ---');
  await resColl.dropIndex('folderId_1');
  console.log('✔ Dropped index: resources.folderId_1');

  const exp1_q3 = extractStats(await queries.q3_resources_folder_batch());
  console.log(`[Post-Drop folderId_1] Q3 (Batch $in folderId):`);
  console.log(`  Stage: ${exp1_q3.stage} | Index: ${exp1_q3.indexUsed} | In-Memory Sort: ${exp1_q3.inMemorySort}`);
  console.log(`  Keys: ${exp1_q3.totalKeysExamined} | Docs: ${exp1_q3.totalDocsExamined} | Time: ${exp1_q3.executionTimeMillis}ms`);

  // --- EXPERIMENT 2: DROP resources.folderId_1_status_1 ---
  console.log('\n--- EXPERIMENT 2: DROPPING resources.folderId_1_status_1 ---');
  await resColl.dropIndex('folderId_1_status_1');
  console.log('✔ Dropped index: resources.folderId_1_status_1');

  const exp2_q1 = extractStats(await queries.q1_resources_folder_sorted());
  const exp2_q4 = extractStats(await queries.q4_resources_status_count());
  console.log(`[Post-Drop folderId_1_status_1] Q1 (Folder approved sorted):`);
  console.log(`  Stage: ${exp2_q1.stage} | Index: ${exp2_q1.indexUsed} | In-Memory Sort: ${exp2_q1.inMemorySort}`);
  console.log(`  Keys: ${exp2_q1.totalKeysExamined} | Docs: ${exp2_q1.totalDocsExamined} | Time: ${exp2_q1.executionTimeMillis}ms`);
  console.log(`[Post-Drop folderId_1_status_1] Q4 (Status count):`);
  console.log(`  Stage: ${exp2_q4.stage} | Index: ${exp2_q4.indexUsed} | In-Memory Sort: ${exp2_q4.inMemorySort}`);
  console.log(`  Keys: ${exp2_q4.totalKeysExamined} | Docs: ${exp2_q4.totalDocsExamined} | Time: ${exp2_q4.executionTimeMillis}ms`);

  // --- EXPERIMENT 3: DROP folders.parentId_1 ---
  console.log('\n--- EXPERIMENT 3: DROPPING folders.parentId_1 ---');
  await folderColl.dropIndex('parentId_1');
  console.log('✔ Dropped index: folders.parentId_1');

  const exp3_q5 = extractStats(await queries.q5_folders_parent_sorted());
  const exp3_q6 = extractStats(await queries.q6_folders_parent_unsorted());
  console.log(`[Post-Drop parentId_1] Q5 (Parent sorted hierarchy):`);
  console.log(`  Stage: ${exp3_q5.stage} | Index: ${exp3_q5.indexUsed} | In-Memory Sort: ${exp3_q5.inMemorySort}`);
  console.log(`  Keys: ${exp3_q5.totalKeysExamined} | Docs: ${exp3_q5.totalDocsExamined} | Time: ${exp3_q5.executionTimeMillis}ms`);
  console.log(`[Post-Drop parentId_1] Q6 (Parent unsorted child scan):`);
  console.log(`  Stage: ${exp3_q6.stage} | Index: ${exp3_q6.indexUsed} | In-Memory Sort: ${exp3_q6.inMemorySort}`);
  console.log(`  Keys: ${exp3_q6.totalKeysExamined} | Docs: ${exp3_q6.totalDocsExamined} | Time: ${exp3_q6.executionTimeMillis}ms`);

  // Measure storage after drops
  const resStatsAfter = await db.command({ collStats: 'resources' });
  const folderStatsAfter = await db.command({ collStats: 'folders' });
  const resIndexSaved = resStatsBefore.totalIndexSize - resStatsAfter.totalIndexSize;
  const folderIndexSaved = folderStatsBefore.totalIndexSize - folderStatsAfter.totalIndexSize;

  console.log('\n--- STORAGE RECLAMATION ON STAGING ---');
  console.log(`Resources Index Size: Before=${resStatsBefore.totalIndexSize} bytes | After=${resStatsAfter.totalIndexSize} bytes | Saved=${resIndexSaved} bytes`);
  console.log(`Folders Index Size:   Before=${folderStatsBefore.totalIndexSize} bytes | After=${folderStatsAfter.totalIndexSize} bytes | Saved=${folderIndexSaved} bytes`);
  console.log(`Total RAM/Storage Reclaimed: ${resIndexSaved + folderIndexSaved} bytes (~${((resIndexSaved + folderIndexSaved) / 1024).toFixed(1)} KB)`);

  // --- ROLLBACK VERIFICATION ---
  console.log('\n--- VERIFYING COMPLETE ROLLBACK CAPABILITY ---');
  console.log('Re-creating candidate indexes on loop_staging...');
  await resColl.createIndex({ folderId: 1 });
  await resColl.createIndex({ folderId: 1, status: 1 });
  await folderColl.createIndex({ parentId: 1 });

  const resIndexesAfterRollback = await resColl.indexes();
  const folderIndexesAfterRollback = await folderColl.indexes();

  console.log(`Resources indexes count after rollback: ${resIndexesAfterRollback.length} (Expected: ${resIndexesBefore.length})`);
  console.log(`Folders indexes count after rollback:   ${folderIndexesAfterRollback.length} (Expected: ${folderIndexesBefore.length})`);

  const hasAllResIndexes = resIndexesBefore.every(b => resIndexesAfterRollback.some(a => a.name === b.name));
  const hasAllFolderIndexes = folderIndexesBefore.every(b => folderIndexesAfterRollback.some(a => a.name === b.name));

  if (hasAllResIndexes && hasAllFolderIndexes) {
    console.log('✔ ROLLBACK 100% VERIFIED: All original indexes successfully restored to loop_staging.');
  } else {
    console.error('❌ ROLLBACK MISMATCH: Some indexes were not restored correctly.');
  }

  await mongoose.disconnect();
  console.log('\n======================================================================');
  console.log('  BENCHMARK SUITE COMPLETED SUCCESSFULLY ON ISOLATED DATABASE!        ');
  console.log('======================================================================');
}

runIndexBenchmarkSuite().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
