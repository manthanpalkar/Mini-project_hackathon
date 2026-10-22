const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const STORIES_FILE = path.join(__dirname, '../../reports/extracted_placement_2026_stories.json');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`\n======================================================`);
  console.log(`LOOP 2026 Verified Placement Stories Ingestion Engine`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE DATABASE POPULATION'}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(STORIES_FILE)) {
    console.error(`Error: Extracted stories file not found at ${STORIES_FILE}`);
    process.exit(1);
  }

  const storiesData = JSON.parse(fs.readFileSync(STORIES_FILE, 'utf-8'));
  console.log(`Loaded ${storiesData.length} extracted student experiences for validation.`);

  // Connect to MongoDB
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI missing from backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas cluster...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Successfully connected to MongoDB.\n');

  let validatedCount = 0;
  let insertedCount = 0;
  let skippedExistingCount = 0;
  let errors = [];

  const existingStories = await Story.find({}, 'id name company passoutYear').lean();
  const existingSet = new Set(existingStories.map(s => `${(s.name || '').toLowerCase()}_${(s.company || '').toLowerCase()}`));

  for (const s of storiesData) {
    const key = `${s.name.toLowerCase()}_${s.company.toLowerCase()}`;
    if (existingSet.has(key)) {
      skippedExistingCount++;
      continue;
    }

    const storyDoc = new Story({
      id: s.id,
      name: s.name,
      company: s.company,
      role: s.role,
      branch: s.branch,
      passoutYear: s.passoutYear || '2026',
      journey: {
        firstYear: s.journey.firstYear || undefined,
        secondYear: s.journey.secondYear || undefined,
        thirdYear: s.journey.thirdYear || undefined,
        fourthYear: s.journey.fourthYear || undefined,
        prep: s.journey.prep,
        projects: s.journey.projects,
        howSecured: s.journey.howSecured
      },
      customSections: s.customSections || [],
      uploadedByEmail: 'tpo.verified@spit.ac.in'
    });

    // Validate schema
    const valErr = storyDoc.validateSync();
    if (valErr) {
      errors.push({ file: s.source_file, error: valErr.message });
      continue;
    }
    validatedCount++;

    if (!isDryRun) {
      await storyDoc.save();
      insertedCount++;
    }
  }

  if (!isDryRun && insertedCount > 0) {
    try {
      await cacheService.invalidateStories();
      console.log('Invalidated Redis story cache keys successfully.');
    } catch (e) {
      console.warn('Cache invalidation warning:', e.message);
    }
  }

  await mongoose.disconnect();

  console.log('\n--- Execution Summary ---');
  console.log(`Total Extracted Records:   ${storiesData.length}`);
  console.log(`Schema Validated:          ${validatedCount}`);
  console.log(`Skipped Existing (Dupes):  ${skippedExistingCount}`);
  console.log(`Validation Errors:         ${errors.length}`);
  if (!isDryRun) {
    console.log(`Successfully Populated:    ${insertedCount} stories`);
  } else {
    console.log(`DRY-RUN COMPLETE: 0 writes executed. Ready for live population upon user confirmation.`);
  }

  if (errors.length > 0) {
    console.error('\nValidation Errors:');
    errors.forEach(e => console.error(`  - ${e.file}: ${e.error}`));
  }
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
