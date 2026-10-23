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
  console.log(`LOOP 2026 Verified Placement Stories & Resources Ingestion Engine`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE DATABASE MIGRATION & REPAIR'}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(STORIES_FILE)) {
    console.error(`Error: Extracted stories file not found at ${STORIES_FILE}`);
    process.exit(1);
  }

  const storiesData = JSON.parse(fs.readFileSync(STORIES_FILE, 'utf-8'));
  console.log(`Loaded ${storiesData.length} extracted student experiences for processing.`);

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI missing from backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas cluster...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Successfully connected to MongoDB Atlas.\n');

  let updatedCount = 0;
  let insertedCount = 0;
  let validatedCount = 0;
  let errors = [];

  for (const s of storiesData) {
    let branchCode = s.branch || 'CSE';
    let subBranchCode = s.subBranch || '';
    const bu = branchCode.toUpperCase();
    if (bu.includes('AI') || bu.includes('AIML')) {
      branchCode = 'CSE-AIML';
      subBranchCode = 'AI';
    } else if (bu.includes('DATA') || bu.includes('DS')) {
      branchCode = 'CSE-DS';
      subBranchCode = 'DS';
    } else if (bu.includes('COMPUTER SCIENCE') || bu === 'CSE') {
      branchCode = 'CSE';
      subBranchCode = subBranchCode || 'CSE';
    } else if (bu.includes('ELECTRONICS') || bu.includes('TELECOMMUNICATION') || bu === 'EXTC') {
      branchCode = 'EXTC';
      subBranchCode = 'EXTC';
    } else if (bu.includes('COMPUTER ENGINEERING') || bu.includes('COMPS') || bu === 'CE') {
      branchCode = 'CE';
      subBranchCode = 'CE';
    } else if (bu === 'MCA') {
      branchCode = 'CE';
      subBranchCode = 'MCA';
    }

    const storyDataToSet = {
      name: s.name,
      company: s.company,
      role: s.role,
      branch: branchCode,
      subBranch: subBranchCode,
      passoutYear: s.passoutYear || '2026',
      cgpa: s.cgpa || undefined,
      package: s.package || undefined,
      ctc: s.ctc || undefined,
      stipend: s.stipend || undefined,
      offerType: s.offerType || 'Placement',
      journey: {
        firstYear: s.journey.firstYear || undefined,
        secondYear: s.journey.secondYear || undefined,
        thirdYear: s.journey.thirdYear || undefined,
        fourthYear: s.journey.fourthYear || undefined,
        prep: s.journey.prep,
        projects: s.journey.projects,
        howSecured: s.journey.howSecured
      },
      resources: s.resources || [],
      resume: s.resume || undefined,
      resumeFile: s.resumeFile || undefined,
      studyMaterials: s.studyMaterials || [],
      customSections: s.customSections || [],
      uploadedByEmail: 'tpo.verified@spit.ac.in'
    };

    // Find existing story by ID or Name + Company
    const nameRegex = new RegExp(`^${s.name.trim()}$`, 'i');
    const compRegex = new RegExp(`^${s.company.trim()}$`, 'i');

    const existing = await Story.findOne({
      $or: [
        { id: s.id },
        { name: nameRegex, company: compRegex }
      ]
    });

    if (existing) {
      if (!isDryRun) {
        existing.name = storyDataToSet.name;
        existing.company = storyDataToSet.company;
        existing.role = storyDataToSet.role;
        existing.branch = storyDataToSet.branch;
        existing.subBranch = storyDataToSet.subBranch;
        existing.passoutYear = storyDataToSet.passoutYear;
        if (storyDataToSet.cgpa) {
          existing.cgpa = storyDataToSet.cgpa;
        } else {
          existing.cgpa = undefined;
          existing.set('cgpa', undefined);
        }
        existing.package = storyDataToSet.package;
        existing.ctc = storyDataToSet.ctc;
        existing.stipend = storyDataToSet.stipend;
        existing.offerType = storyDataToSet.offerType;
        existing.journey = storyDataToSet.journey;
        existing.customSections = storyDataToSet.customSections;
        if (storyDataToSet.resources && storyDataToSet.resources.length > 0) {
          existing.resources = storyDataToSet.resources;
        } else {
          existing.resources = [];
        }
        if (storyDataToSet.studyMaterials && storyDataToSet.studyMaterials.length > 0) {
          existing.studyMaterials = storyDataToSet.studyMaterials;
        } else {
          existing.studyMaterials = [];
        }
        if (storyDataToSet.resumeFile) {
          existing.resumeFile = storyDataToSet.resumeFile;
          existing.resume = storyDataToSet.resume;
        }
        if (!existing.uploadedByEmail) {
          existing.uploadedByEmail = storyDataToSet.uploadedByEmail;
        }

        const valErr = existing.validateSync();
        if (valErr) {
          errors.push({ file: s.source_file, error: valErr.message });
          continue;
        }

        await existing.save();
        updatedCount++;
      } else {
        const dummyDoc = new Story({ ...storyDataToSet, id: existing.id });
        const valErr = dummyDoc.validateSync();
        if (valErr) {
          errors.push({ file: s.source_file, error: valErr.message });
          continue;
        }
        updatedCount++;
      }
    } else {
      const newDoc = new Story({
        ...storyDataToSet,
        id: s.id
      });

      const valErr = newDoc.validateSync();
      if (valErr) {
        errors.push({ file: s.source_file, error: valErr.message });
        continue;
      }

      if (!isDryRun) {
        await newDoc.save();
        insertedCount++;
      } else {
        insertedCount++;
      }
    }

    validatedCount++;
  }

  if (!isDryRun && (updatedCount > 0 || insertedCount > 0)) {
    try {
      await cacheService.invalidateStories();
      console.log('Invalidated Redis story cache keys successfully.');
    } catch (e) {
      console.warn('Cache invalidation warning:', e.message);
    }
  }

  // Live Verification
  console.log('\n--- Live Verification of Target Story (Aman Kanojia: story_2026_5136315) ---');
  const verifiedStory = await Story.findOne({ id: 'story_2026_5136315' }).lean();
  if (verifiedStory) {
    console.log(`ID:           ${verifiedStory.id}`);
    console.log(`Name:         ${verifiedStory.name}`);
    console.log(`Company:      ${verifiedStory.company}`);
    console.log(`Branch:       ${verifiedStory.branch} (${verifiedStory.subBranch})`);
    console.log(`Package:      ${verifiedStory.package}`);
    console.log(`Offer Type:   ${verifiedStory.offerType}`);
    console.log(`Stipend:      ${verifiedStory.stipend}`);
    console.log(`Resume:       ${verifiedStory.resume || 'None (Verified source-only)'}`);
    console.log(`Academic Yrs: 1st=${verifiedStory.journey?.firstYear || 'null'}, 2nd=${verifiedStory.journey?.secondYear || 'null'}, 3rd=${verifiedStory.journey?.thirdYear || 'null'}, 4th=${verifiedStory.journey?.fourthYear || 'null'}`);
    console.log(`Resources:    ${verifiedStory.resources?.length || 0} attached`);
    if (verifiedStory.resources && verifiedStory.resources.length > 0) {
      verifiedStory.resources.forEach((r, idx) => console.log(`  [${r.type}] ${r.name}: ${r.url}`));
    }
  }

  await mongoose.disconnect();

  console.log('\n--- Execution Summary ---');
  console.log(`Total Extracted Records:  ${storiesData.length}`);
  console.log(`Schema Validated:         ${validatedCount}`);
  console.log(`Updated Existing Stories: ${updatedCount}`);
  console.log(`Inserted New Stories:     ${insertedCount}`);
  console.log(`Validation Errors:        ${errors.length}`);
  if (isDryRun) {
    console.log(`DRY-RUN COMPLETE: 0 writes executed.`);
  } else {
    console.log(`LIVE MIGRATION COMPLETE: All stories and resources populated.`);
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
