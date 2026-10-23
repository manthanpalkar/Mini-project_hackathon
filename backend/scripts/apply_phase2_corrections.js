const mongoose = require('mongoose');
const path = require('path');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TARGET_CORRECTIONS = [
  {
    id: 'story_2026_22149823',
    expectedName: 'Kanishka Anand Amritkar',
    updates: {
      branch: 'CE',
      subBranch: 'CE'
    },
    reason: "Source header states COMPS designation (kanishka_mahindra_finance_experience.pdf)"
  },
  {
    id: 'story_2027_d1bb7dd4',
    expectedName: 'Dhruv Mukesh Tiwari and',
    updates: {
      name: 'Dhruv Mukesh Tiwari',
      branch: 'CSE',
      subBranch: 'CSE'
    },
    reason: "Source header states Dhruv Mukesh Tiwari / Computer Science and Engineering (ISS-STOXX_SDE_Dhruv_Mukesh_Tiwari.pdf)"
  },
  {
    id: 'story_2025_7ec35412',
    expectedName: 'Bhavesh Chaudhari CS',
    updates: {
      name: 'Bhavesh Chaudhari',
      branch: 'CSE',
      subBranch: 'CSE'
    },
    reason: "Source header states Bhavesh Chaudhari / CS (Barclays-SDE-Bhavesh Chaudhari.pdf)"
  },
  {
    id: 'story_2026_26830791',
    expectedName: 'Shubham Karampure',
    updates: {
      branch: 'CSE-DS',
      subBranch: 'DS'
    },
    reason: "Source header states C.S.E Data Science (MSCI_Technology&DataOperationIntern_Shubham_Karampure.pdf)"
  },
  {
    id: 'story_2026_10137144',
    expectedName: 'Prashant Tiwari',
    updates: {
      branch: 'MCA',
      subBranch: 'MCA'
    },
    reason: "Source header specifies Prashant Tiwari (MCA) (Oracle_Associate_consultant_Prashant_Tiwari.docx)"
  }
];

async function applyPhase2Corrections() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.\n');

  let modifiedCount = 0;

  for (const item of TARGET_CORRECTIONS) {
    const story = await Story.findOne({ id: item.id });
    if (!story) {
      console.error(`ERROR: Story not found: ${item.id}`);
      continue;
    }

    console.log(`-----------------------------------------------------------------`);
    console.log(`Story ID: ${item.id} | Target: ${item.expectedName}`);
    console.log(`  BEFORE -> Name: "${story.name}", Branch: "${story.branch}", SubBranch: "${story.subBranch}"`);

    let changed = false;
    for (const [key, val] of Object.entries(item.updates)) {
      if (story[key] !== val) {
        story[key] = val;
        changed = true;
      }
    }

    if (changed) {
      await story.save();
      modifiedCount++;
      console.log(`  AFTER  -> Name: "${story.name}", Branch: "${story.branch}", SubBranch: "${story.subBranch}"`);
      console.log(`  REASON -> ${item.reason}`);
    } else {
      console.log(`  ALREADY UP TO DATE.`);
    }
  }

  console.log(`\nModified ${modifiedCount} stories in MongoDB Atlas.`);

  // Invalidate Redis cache
  console.log('\nInvalidating Redis stories cache...');
  try {
    await cacheService.invalidateStories();
    console.log('Redis cache invalidated successfully.');
  } catch (err) {
    console.warn('Redis cache invalidation warning:', err.message);
  }

  // Verification
  console.log('\n--- VERIFICATION QUERY FROM MONGODB ATLAS ---');
  for (const item of TARGET_CORRECTIONS) {
    const verified = await Story.findOne({ id: item.id }).lean();
    console.log(`[${verified.id}] ${verified.name} (${verified.company}) | Branch: ${verified.branch} | SubBranch: ${verified.subBranch} | PassoutYear: ${verified.passoutYear}`);
  }

  process.exit(0);
}

applyPhase2Corrections().catch(err => {
  console.error('Fatal error during Phase 2 corrections:', err);
  process.exit(1);
});
