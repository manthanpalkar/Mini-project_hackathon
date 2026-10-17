/**
 * LOOP — Synthetic Staging Dataset Generator
 * 
 * Generates ~500 synthetic folders and ~15,000 synthetic resources
 * strictly in the isolated local staging database (loop_staging).
 * 
 * Safety:
 * - Fails immediately if not connected to 127.0.0.1:27018/loop_staging.
 * - Idempotent: purges prior synthetic test data before seeding.
 * - Zero production data, user records, or real files used.
 */

const path = require('path');
process.env.ENV_FILE = '.env.local.test';
require('dotenv').config({ path: path.join(__dirname, '../.env.local.test') });
const mongoose = require('mongoose');
const { Folder, Resource } = require('../models');

const BENCHMARK_TAG = 'synthetic_benchmark_2026';
const BENCHMARK_EMAIL = 'synthetic_benchmark@spit.ac.in';

async function seedSyntheticData() {
  console.log('========================================================');
  console.log('   LOOP — Synthetic Staging Data Seeder (loop_staging)  ');
  console.log('========================================================');

  const uri = process.env.MONGODB_URI;
  if (!uri || !uri.includes('27018') || !uri.includes('loop_staging')) {
    console.error('FATAL: Refusing to seed. URI does not target 127.0.0.1:27018/loop_staging.');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  console.log(`Connected to: ${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name}`);

  if (mongoose.connection.name !== 'loop_staging' || mongoose.connection.port !== 27018) {
    console.error('FATAL ISOLATION BREACH: Not connected to loop_staging on port 27018!');
    process.exit(1);
  }

  console.log('\n[Phase 1] Purging prior synthetic benchmark data...');
  const delRes = await Resource.deleteMany({ uploadedByEmail: BENCHMARK_EMAIL });
  const delFolders = await Folder.deleteMany({ ownerEmail: BENCHMARK_EMAIL });
  console.log(`Purged prior synthetic resources: ${delRes.deletedCount}`);
  console.log(`Purged prior synthetic folders:   ${delFolders.deletedCount}`);

  console.log('\n[Phase 2] Generating 500 synthetic folders with multi-level hierarchy...');
  const folderDocs = [];
  const TOTAL_FOLDERS = 500;
  const rootCount = 50;
  const midCount = 200;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  for (let i = 1; i <= TOTAL_FOLDERS; i++) {
    const id = `syn-folder-${String(i).padStart(4, '0')}`;
    let parentId = null;

    if (i > rootCount && i <= rootCount + midCount) {
      // Level 1: assign parent from root folders
      const parentNum = ((i - rootCount - 1) % rootCount) + 1;
      parentId = `syn-folder-${String(parentNum).padStart(4, '0')}`;
    } else if (i > rootCount + midCount) {
      // Level 2: assign parent from level 1 folders
      const parentNum = rootCount + (((i - rootCount - midCount - 1) % midCount) + 1);
      parentId = `syn-folder-${String(parentNum).padStart(4, '0')}`;
    }

    const createdOffset = Math.floor(Math.random() * 365) * ONE_DAY;
    const createdAt = new Date(now - createdOffset);

    folderDocs.push({
      id,
      name: `Synthetic Folder ${i} (${parentId ? 'Subfolder' : 'Root'})`,
      description: `Benchmark hierarchy node ${i}`,
      ownerEmail: BENCHMARK_EMAIL,
      ownerName: 'Synthetic Benchmarker',
      folderType: 'user',
      visibility: 'public',
      allowContributions: true,
      parentId,
      isSystemFolder: false,
      createdAt,
      updatedAt: createdAt
    });
  }

  await Folder.insertMany(folderDocs, { ordered: false });
  console.log(`✔ Created ${folderDocs.length} synthetic folders.`);

  console.log('\n[Phase 3] Generating 15,000 synthetic resources...');
  const TOTAL_RESOURCES = 15000;
  const resourceDocs = [];
  const categories = ['System Design', 'DSA', 'Core Subjects', 'Aptitude', 'Interview Prep'];
  const types = ['PDF', 'PDF', 'PDF', 'Doc', 'Code', 'Video']; // weighted towards PDF
  const statuses = ['approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'pending', 'pending', 'rejected']; // ~75% approved, ~20% pending, ~5% rejected

  // Dense test folders for realistic hotspot distribution
  const targetHotspotFolders = [
    'system-placement-material',
    'system-dsa',
    'system-core-cs',
    'syn-folder-0001',
    'syn-folder-0002',
    'syn-folder-0003'
  ];

  for (let i = 1; i <= TOTAL_RESOURCES; i++) {
    const id = `syn-res-${String(i).padStart(6, '0')}`;
    let folderId;

    if (i <= 3000) {
      // Put 3,000 resources into hotspot folders to test high-density folder listing performance
      folderId = targetHotspotFolders[i % targetHotspotFolders.length];
    } else {
      // Distribute the remaining 12,000 across the 500 synthetic folders
      const folderIdx = ((i - 3001) % TOTAL_FOLDERS) + 1;
      folderId = `syn-folder-${String(folderIdx).padStart(4, '0')}`;
    }

    const status = statuses[i % statuses.length];
    const type = types[i % types.length];
    const category = categories[i % categories.length];
    const createdOffset = Math.floor(Math.random() * 365) * ONE_DAY + (i % 86400000);
    const createdAt = new Date(now - createdOffset);

    resourceDocs.push({
      id,
      title: `Synthetic ${category} Resource ${i}`,
      description: `Benchmark resource for load and index testing (${type})`,
      category,
      type,
      link: `https://loop.local/mock/resource_${i}.${type.toLowerCase()}`,
      originalFileName: `synthetic_doc_${i}.${type.toLowerCase()}`,
      mimeType: type === 'PDF' ? 'application/pdf' : 'application/octet-stream',
      size: 1024 * 100 + (i * 37) % (1024 * 1024 * 15),
      storageProvider: 'gridfs',
      storageKey: `mock_gridfs_key_${i}`,
      url: `https://loop.local/api/storage/stream/mock_${i}`,
      folderId,
      uploadedBy: 'Synthetic Benchmarker',
      uploadedByEmail: BENCHMARK_EMAIL,
      date: createdAt.toISOString().split('T')[0],
      visibility: 'public',
      status,
      semester: `Sem ${(i % 8) + 1}`,
      year: `202${(i % 5) + 2}`,
      tags: [BENCHMARK_TAG, category.toLowerCase()],
      createdAt,
      updatedAt: createdAt
    });

    // Batch insert every 2,500 docs to keep memory overhead small
    if (resourceDocs.length === 2500) {
      await Resource.insertMany(resourceDocs, { ordered: false });
      process.stdout.write(`  Inserted ${i} / ${TOTAL_RESOURCES} resources...\r`);
      resourceDocs.length = 0;
    }
  }

  if (resourceDocs.length > 0) {
    await Resource.insertMany(resourceDocs, { ordered: false });
  }
  console.log(`\n✔ Created ${TOTAL_RESOURCES} synthetic resources.`);

  // Validation
  const finalFoldersCount = await Folder.countDocuments({});
  const finalResourcesCount = await Resource.countDocuments({});
  const syntheticResCount = await Resource.countDocuments({ uploadedByEmail: BENCHMARK_EMAIL });
  const approvedResCount = await Resource.countDocuments({ status: 'approved' });

  console.log('\n========================================================');
  console.log('   Final loop_staging Database Counts:');
  console.log(`   - Total Folders:            ${finalFoldersCount}`);
  console.log(`   - Total Resources:          ${finalResourcesCount}`);
  console.log(`   - Synthetic Resources:      ${syntheticResCount}`);
  console.log(`   - Approved Resources:       ${approvedResCount}`);
  console.log('========================================================');

  await mongoose.disconnect();
  console.log('Seeding finished successfully.');
}

seedSyntheticData().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
