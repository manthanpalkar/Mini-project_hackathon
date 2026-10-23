const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const AUDIT_JSON = path.join(__dirname, '../reports/source_to_db_audit_report.json');

async function applyRepairs() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  console.log('Reading audit report:', AUDIT_JSON);
  const auditData = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));

  let updatedCount = 0;
  const updateSummary = [];

  for (const item of auditData) {
    const proposed = item.proposed_updates || {};
    if (Object.keys(proposed).length === 0) continue;

    const story = await Story.findOne({ id: item.id });
    if (!story) {
      console.warn(`Story not found in DB: ${item.id}`);
      continue;
    }

    let modified = false;

    // Apply branch correction
    if (proposed.branch && story.branch !== proposed.branch) {
      console.log(`[${item.name} (${item.company})] Branch: "${story.branch}" -> "${proposed.branch}"`);
      story.branch = proposed.branch;
      modified = true;
    }

    if (proposed.subBranch && story.subBranch !== proposed.subBranch) {
      console.log(`[${item.name} (${item.company})] SubBranch: "${story.subBranch}" -> "${proposed.subBranch}"`);
      story.subBranch = proposed.subBranch;
      modified = true;
    }

    // Apply name correction
    if (proposed.name && story.name !== proposed.name) {
      console.log(`[${item.id}] Name: "${story.name}" -> "${proposed.name}"`);
      story.name = proposed.name;
      modified = true;
    }

    // Apply package correction if present
    if (proposed.package && story.package !== proposed.package) {
      console.log(`[${item.name}] Package: "${story.package}" -> "${proposed.package}"`);
      story.package = proposed.package;
      modified = true;
    }

    if (proposed.ctc && story.ctc !== proposed.ctc) {
      story.ctc = proposed.ctc;
      modified = true;
    }

    if (modified) {
      await story.save();
      updatedCount++;
      updateSummary.push({
        id: item.id,
        name: story.name,
        company: story.company,
        changes: proposed
      });
    }
  }

  console.log(`\nSuccessfully applied source-verified repairs to ${updatedCount} stories in MongoDB Atlas.`);

  // Verify Krishika Jalali
  const krishika = await Story.findOne({ name: { $regex: /Krishika/i } });
  console.log('\n--- VERIFICATION: Krishika Jalali in MongoDB ---');
  console.log(`Name: ${krishika.name}`);
  console.log(`Company: ${krishika.company}`);
  console.log(`Branch: ${krishika.branch}`);
  console.log(`SubBranch: ${krishika.subBranch}`);
  console.log(`Package: ${krishika.package}`);
  console.log(`Stipend: ${krishika.stipend}`);

  // Invalidate Redis cache
  console.log('\nInvalidating Redis cache for stories...');
  try {
    await cacheService.invalidateStories();
    console.log('Stories cache invalidated successfully.');
  } catch (err) {
    console.warn('Cache invalidation warning:', err.message);
  }

  process.exit(0);
}

applyRepairs().catch(err => {
  console.error('Fatal error applying repairs:', err);
  process.exit(1);
});
