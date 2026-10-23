const mongoose = require('mongoose');
const path = require('path');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function cleanAndFormatCompensation(ctcStr, rawPkgStr) {
  const input = (rawPkgStr || ctcStr || '').trim();
  if (!input || input.toLowerCase() in ['na', 'n/a', 'none', 'nil', '-', '—', 'not disclosed']) {
    return { pkg: undefined, ctc: undefined };
  }

  let s = input;
  // Clean OCR misrecognitions of Rupee symbol '₹'
  s = s.replace(/(?:^|[\s\+\(])[7<]\s*([6-9]\d?,\d{2},\d{3})\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])[72<]\s*(1,00,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(\d{5,})\b/g, ' ₹$1');
  s = s.replace(/€\s*(\d+)/g, '₹$1');
  s = s.replace(/\s+/g, ' ').trim();

  // TransUnion specific: 8,50,000 + 1,00,000 joining bonus
  if (s.includes('8,50,000') && s.includes('1,00,000')) {
    return {
      pkg: '8.5 + 1 (Joining Bonus) LPA',
      ctc: '₹8,50,000 + ₹1,00,000 joining bonus'
    };
  }

  // Quantiphi Rahul Chalwadi: (Base- ₹ 850000 per Annum) + Variables
  if (s.includes('850000') && s.toLowerCase().includes('variable')) {
    return {
      pkg: '8.5 LPA (Base) + Variables',
      ctc: '₹8,50,000 (Base) + Variables'
    };
  }

  // ₹ 11,00,000 -> 11 LPA
  const mRupee = s.match(/₹?\s*(\d{1,2}),(\d{2}),000\b/);
  if (mRupee) {
    const lakhs = mRupee[2] !== '00' ? `${mRupee[1]}.${mRupee[2]}` : mRupee[1];
    let extra = s.replace(/₹?\s*\d{1,2},\d{2},000\s*(?:per\s*annum)?/gi, '').trim();
    extra = extra.replace(/^[\+\-\s]+/, '').trim();
    const pkg = extra ? `${lakhs} LPA + ${extra}` : `${lakhs} LPA`;
    return { pkg, ctc: s };
  }

  // Raw integers: 900000 -> 9 LPA, 1523000 -> 15.23 LPA
  const mRaw = s.match(/₹?\s*(\d{6,7})\b/);
  if (mRaw) {
    const val = parseInt(mRaw[1], 10);
    const lakhs = (val / 100000).toFixed(2).replace(/\.?0+$/, '');
    let extra = s.replace(mRaw[0], '').trim();
    extra = extra.replace(/(?:per\s*annum)/gi, '').trim();
    extra = extra.replace(/^[\+\-\s]+/, '').trim();
    const pkg = extra ? `${lakhs} LPA + ${extra}` : `${lakhs} LPA`;
    return { pkg, ctc: s };
  }

  return { pkg: rawPkgStr || s, ctc: ctcStr || s };
}

function cleanStipend(stipendStr) {
  if (!stipendStr) return stipendStr;
  let s = String(stipendStr).trim();
  s = s.replace(/225,000/g, '25,000');
  s = s.replace(/€\s*25,000/g, '25,000');
  return s;
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const stories = await Story.find({});
  let fixedCount = 0;
  let removedCustomCompCount = 0;

  for (const story of stories) {
    let modified = false;

    // 1. Remove redundant "Compensation & Offer Breakdown" from customSections
    if (story.customSections && story.customSections.length > 0) {
      const origLen = story.customSections.length;
      story.customSections = story.customSections.filter(sec => {
        const title = (sec.title || '').toLowerCase();
        return !title.includes('compensation') && !title.includes('offer breakdown');
      });
      if (story.customSections.length !== origLen) {
        removedCustomCompCount++;
        modified = true;
      }
    }

    // 2. Clean and format compensation
    const rawPkg = story.package || '';
    const rawCtc = story.ctc || '';
    if (
      /7[0-9],\d{2},\d{3}|<\d+,\d+|€\d+|\d{5,}|₹\s*\d{5,}|₹\s*\d+,\d+|7\s*850000/.test(rawPkg) ||
      /7[0-9],\d{2},\d{3}|<\d+,\d+|€\d+|\d{5,}|₹\s*\d{5,}|₹\s*\d+,\d+|7\s*850000/.test(rawCtc)
    ) {
      const { pkg, ctc } = cleanAndFormatCompensation(rawCtc, rawPkg);
      console.log(`Fixing [${story.passoutYear}] ${story.name} (${story.company}):`);
      console.log(`  BEFORE -> pkg: "${story.package}", ctc: "${story.ctc}"`);
      story.package = pkg;
      story.ctc = ctc;
      console.log(`  AFTER  -> pkg: "${story.package}", ctc: "${story.ctc}"`);
      modified = true;
      fixedCount++;
    }

    // 3. Clean stipend if affected
    if (story.stipend && (/225,000|€25,000/.test(story.stipend))) {
      story.stipend = cleanStipend(story.stipend);
      modified = true;
    }

    if (modified) {
      await story.save();
    }
  }

  console.log(`\nFixed ${fixedCount} candidate package/ctc values.`);
  console.log(`Removed redundant compensation customSection from ${removedCustomCompCount} stories.`);

  try {
    await cacheService.invalidateStories();
    console.log('Redis cache invalidated successfully.');
  } catch (e) {
    console.warn('Cache invalidation warning:', e.message);
  }

  // Inspect Valencia Dmonte specifically
  const valencia = await Story.findOne({ id: 'story_2027_4df1af5f' }).lean();
  console.log('\n--- Verified Valencia Dmonte Post-Fix ---');
  console.log('ID:             ', valencia.id);
  console.log('Name:           ', valencia.name);
  console.log('Package (LPA):  ', valencia.package);
  console.log('CTC:            ', valencia.ctc);
  console.log('Stipend:        ', valencia.stipend);
  console.log('Custom Sections:', valencia.customSections);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});