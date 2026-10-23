const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PROJECT_ROOT = path.join(__dirname, '../..');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'reports');

const YEAR_FILES = {
  '2024': path.join(REPORTS_DIR, 'extracted_placement_2024_stories.json'),
  '2025': path.join(REPORTS_DIR, 'extracted_placement_2025_stories.json'),
  '2027': path.join(REPORTS_DIR, 'extracted_placement_2027_stories.json')
};

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const targetYears = args.find(a => !a.startsWith('--')) 
    ? args.find(a => !a.startsWith('--')).split(',') 
    : ['2024', '2025', '2027'];

  console.log(`\n======================================================`);
  console.log(`LOOP Multi-Year Placement Stories Ingestion Engine`);
  console.log(`Target Years: ${targetYears.join(', ')}`);
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE DATABASE INGESTION'}`);
  console.log(`======================================================\n`);

  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI missing from backend/.env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas cluster...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Successfully connected to MongoDB Atlas.\n');

  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = [];

  for (const year of targetYears) {
    const filePath = YEAR_FILES[year];
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn(`[WARN] Stories file for year ${year} not found at ${filePath}. Skipping.`);
      continue;
    }

    const storiesData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`\n--- Processing Year ${year}: ${storiesData.length} candidate records ---`);

    let yearInserted = 0;
    let yearUpdated = 0;

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
        passoutYear: s.passoutYear || year,
        cgpa: s.cgpa || undefined,
        package: s.package || undefined,
        ctc: s.ctc || undefined,
        stipend: s.stipend || undefined,
        offerType: s.offerType || 'Placement',
        journey: {
          firstYear: s.journey?.firstYear || undefined,
          secondYear: s.journey?.secondYear || undefined,
          thirdYear: s.journey?.thirdYear || undefined,
          fourthYear: s.journey?.fourthYear || undefined,
          prep: s.journey?.prep,
          projects: s.journey?.projects,
          howSecured: s.journey?.howSecured
        },
        resources: s.resources || [],
        resume: s.resume || undefined,
        resumeFile: s.resumeFile || undefined,
        studyMaterials: s.studyMaterials || [],
        customSections: s.customSections || [],
        uploadedByEmail: 'tpo.verified@spit.ac.in'
      };

      // Match by exact id or (name + company + passoutYear)
      const nameRegex = new RegExp(`^${s.name.trim()}$`, 'i');
      const compRegex = new RegExp(`^${s.company.trim()}$`, 'i');

      const existing = await Story.findOne({
        $or: [
          { id: s.id },
          { name: nameRegex, company: compRegex, passoutYear: storyDataToSet.passoutYear }
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
          existing.resources = storyDataToSet.resources || [];
          existing.studyMaterials = storyDataToSet.studyMaterials || [];
          if (storyDataToSet.resumeFile) {
            existing.resumeFile = storyDataToSet.resumeFile;
            existing.resume = storyDataToSet.resume;
          }
          if (!existing.uploadedByEmail) {
            existing.uploadedByEmail = storyDataToSet.uploadedByEmail;
          }

          const valErr = existing.validateSync();
          if (valErr) {
            totalErrors.push({ file: s.source_file, error: valErr.message });
            continue;
          }

          await existing.save();
          yearUpdated++;
          totalUpdated++;
        } else {
          const dummyDoc = new Story({ ...storyDataToSet, id: existing.id });
          const valErr = dummyDoc.validateSync();
          if (valErr) {
            totalErrors.push({ file: s.source_file, error: valErr.message });
            continue;
          }
          yearUpdated++;
          totalUpdated++;
        }
      } else {
        const newDoc = new Story({
          ...storyDataToSet,
          id: s.id
        });

        const valErr = newDoc.validateSync();
        if (valErr) {
          totalErrors.push({ file: s.source_file, error: valErr.message });
          continue;
        }

        if (!isDryRun) {
          await newDoc.save();
          yearInserted++;
          totalInserted++;
        } else {
          yearInserted++;
          totalInserted++;
        }
      }

      totalProcessed++;
    }

    console.log(`Year ${year} Summary: ${yearInserted} inserted, ${yearUpdated} updated.`);
  }

  if (!isDryRun && (totalInserted > 0 || totalUpdated > 0)) {
    try {
      await cacheService.invalidateStories();
      console.log('\nInvalidated Redis story cache keys successfully.');
    } catch (e) {
      console.warn('Cache invalidation warning:', e.message);
    }
  }

  // Count total stories across all years in database
  const totalInDb = await Story.countDocuments();
  const yearBreakdown = await Story.aggregate([
    { $group: { _id: "$passoutYear", count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);

  console.log('\n======================================================');
  console.log('FINAL DATABASE INVENTORY ACROSS ALL YEARS');
  console.log('======================================================');
  console.log(`Total Stories in Database: ${totalInDb}`);
  console.log('Breakdown by Passout Year:');
  yearBreakdown.forEach(b => console.log(`  - Year ${b._id || 'Unspecified'}: ${b.count} stories`));
  console.log(`Total Processed in this run: ${totalProcessed}`);
  console.log(`Total Inserted:              ${totalInserted}`);
  console.log(`Total Updated:               ${totalUpdated}`);
  console.log(`Total Errors:                ${totalErrors.length}`);

  if (totalErrors.length > 0) {
    console.error('\nValidation Errors:');
    totalErrors.forEach(e => console.error(`  - ${e.file}: ${e.error}`));
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});