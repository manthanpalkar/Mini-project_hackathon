const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Story } = require('../models');

const BACKUP_FILE = path.join(__dirname, '../backups/stories_backup_2026-10-23T05-04-44-908Z.json');
const REPORTS_FILE = path.join(__dirname, '../../reports/extracted_placement_2026_stories.json');

function normalizePunctuation(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/([a-z0-9\)])\.([A-Z])/g, '$1. $2')
    .replace(/([a-z0-9\)])\?([A-Z])/g, '$1? $2')
    .replace(/([a-z0-9\)])\!([A-Z])/g, '$1! $2');
}

async function restoreRichNarratives() {
  console.log('=================================================================');
  console.log('LOOP STORY FORMATTING RESTORATION & NARRATIVE SYNCHRONIZATION');
  console.log('=================================================================\n');

  if (!fs.existsSync(BACKUP_FILE)) {
    console.error('Backup file not found at:', BACKUP_FILE);
    process.exit(1);
  }
  if (!fs.existsSync(REPORTS_FILE)) {
    console.error('Reports file not found at:', REPORTS_FILE);
    process.exit(1);
  }

  const backupStories = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  const currentStories = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'));

  console.log(`Loaded ${backupStories.length} backup stories and ${currentStories.length} current stories.`);

  // Build lookup maps
  const backupById = new Map();
  const backupByName = new Map();

  backupStories.forEach(s => {
    if (s._id) backupById.set(s._id.toString(), s);
    if (s.id) backupById.set(s.id.toString(), s);
    if (s.name) backupByName.set(s.name.trim().toLowerCase(), s);
  });

  let totalRestored = 0;
  let beforeLines = 0;
  let afterLines = 0;

  for (let i = 0; i < currentStories.length; i++) {
    const cur = currentStories[i];
    const match = backupById.get(cur._id?.toString()) ||
                  backupById.get(cur.id?.toString()) ||
                  backupByName.get(cur.name?.trim().toLowerCase());

    if (!match) {
      console.warn(`[WARN] No backup match for: ${cur.name} (${cur._id})`);
      continue;
    }

    beforeLines += (cur.journey?.howSecured || '').split('\n').length;
    beforeLines += (cur.journey?.prep || '').split('\n').length;

    // Restore rich multi-line narratives from backup
    let restoredHowSecured = normalizePunctuation(match.journey?.howSecured || cur.journey?.howSecured || '');
    let restoredPrep = normalizePunctuation(match.journey?.prep || cur.journey?.prep || '');
    let restoredProjects = normalizePunctuation(match.journey?.projects || cur.journey?.projects || '');

    // Aman Kanojia JD Link embed
    if (cur.name && cur.name.toLowerCase().includes('aman kanojia')) {
      const jdAnchor = 'GM SPIT Tech focused Intern role_JD - 2025.pdf';
      const jdUrl = 'https://drive.google.com/file/d/1KUDTxqKGzFo4TAcIPeuM3FuueHTeXrsT/view?usp=sharing';
      if (restoredHowSecured.includes(jdAnchor) && !restoredHowSecured.includes(`[${jdAnchor}](${jdUrl})`)) {
        restoredHowSecured = restoredHowSecured.replace(
          new RegExp(`GM Role JD\\s*-\\s*${jdAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
          `GM Role JD — [${jdAnchor}](${jdUrl})`
        );
      }
    }

    // Restore customSections from backup
    const restoredCustomSections = (match.customSections || cur.customSections || []).map(cs => ({
      ...cs,
      content: normalizePunctuation(cs.content || '')
    }));

    afterLines += restoredHowSecured.split('\n').length;
    afterLines += restoredPrep.split('\n').length;

    // Assign restored narratives
    cur.journey = {
      ...(cur.journey || {}),
      howSecured: restoredHowSecured,
      prep: restoredPrep,
      projects: restoredProjects
    };
    cur.customSections = restoredCustomSections;

    totalRestored++;
  }

  console.log(`\nNarratives restored in memory:`);
  console.log(`- Stories updated: ${totalRestored} / ${currentStories.length}`);
  console.log(`- Journey lines before: ${beforeLines}`);
  console.log(`- Journey lines after: ${afterLines} (Restored ${afterLines - beforeLines} lost lines!)`);

  // Write restored data back to reports/extracted_placement_2026_stories.json
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(currentStories, null, 2), 'utf8');
  console.log(`\nUpdated ${REPORTS_FILE} successfully.`);

  // Connect to MongoDB Atlas
  console.log('\nConnecting to MongoDB Atlas to synchronize live database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  let dbUpdatedCount = 0;

  for (const s of currentStories) {
    const updateDoc = {
      'journey.howSecured': s.journey.howSecured,
      'journey.prep': s.journey.prep,
      'journey.projects': s.journey.projects,
      customSections: s.customSections,
      // Preserve verified CGPA
      ...(s.cgpa ? { cgpa: s.cgpa } : {}),
      // Preserve cleaned resources and studyMaterials
      resources: s.resources || [],
      studyMaterials: s.studyMaterials || []
    };

    const res = await Story.updateOne(
      { $or: [{ _id: s._id }, { id: s.id }, { name: s.name, company: s.company }] },
      { $set: updateDoc }
    );

    if (res.matchedCount > 0) {
      dbUpdatedCount++;
    }
  }

  console.log(`Database sync complete: Updated ${dbUpdatedCount} stories in MongoDB Atlas.`);

  // Flush Redis cache if configured
  try {
    const cacheService = require('../services/cacheService');
    if (cacheService && cacheService.flushAll) {
      await cacheService.flushAll();
      console.log('Redis cache flushed.');
    }
  } catch (err) {
    console.log('Redis cache flush skipped (optional):', err.message);
  }

  await mongoose.disconnect();
  console.log('\n=================================================================');
  console.log('RESTORATION COMPLETE!');
  console.log('=================================================================\n');
}

restoreRichNarratives().catch(err => {
  console.error('Fatal error during restoration:', err);
  process.exit(1);
});
