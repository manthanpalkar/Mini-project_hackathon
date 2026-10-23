const mongoose = require('mongoose');
const path = require('path');
const { Story } = require('../models');
const cacheService = require('../services/cacheService');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function cleanCurrencyString(val) {
  if (!val) return val;
  let s = String(val).trim();

  // Fix misrecognized currency symbols
  s = s.replace(/[₴·<€]\s*(\d)/g, '₹$1');
  s = s.replace(/\b1pa\b/gi, 'LPA');
  s = s.replace(/\bIpa\b/g, 'LPA');

  // Fix 7 used as ₹
  s = s.replace(/(?:^|[\s\+\(])7\s*(80,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(1,35,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(1,00,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(25,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(8,50,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(50,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(40,000)\b/g, ' ₹$1');
  s = s.replace(/(?:^|[\s\+\(])7\s*(30,000)\b/g, ' ₹$1');

  // Clean double spaces
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function run() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.\n');

  const stories = await Story.find({});
  let updatedCount = 0;

  for (const s of stories) {
    let modified = false;

    let newPkg = cleanCurrencyString(s.package);
    let newCtc = cleanCurrencyString(s.ctc);
    let newStipend = cleanCurrencyString(s.stipend);

    // Specific verified package normalizations
    if (s.name.includes('Prasad Gade') && s.company.includes('Nomura')) {
      newPkg = '13.9 LPA';
      newCtc = '₹13,90,500/- [Fixed : ₹12,45,500/-]';
      newStipend = '₹75,000/-';
    } else if (s.name.includes('Stephen David Vaz') && s.company.includes('PhonePe')) {
      newPkg = '33.57 LPA';
      newCtc = '₹33,57,017';
    } else if (s.name.includes('Vasundhara Singh') && s.company.includes('Work India')) {
      newPkg = '23 LPA';
      newCtc = '₹23,00,000';
    } else if (s.name.includes('Sayali Khanolkar') && s.company.includes('TransUnion')) {
      newPkg = '9.5 LPA';
      newCtc = '₹9,50,000';
    } else if (s.name.includes('Soham Kher') && s.company.includes('Axis Mutual Fund')) {
      newPkg = '8.23 LPA';
      newCtc = '₹8,22,651';
    } else if (s.name.includes('Shivam Kadam') && s.company.includes('ISS STOXX')) {
      newPkg = '9.5 LPA';
      newCtc = '₹9,50,000';
    } else if (s.name.includes('Krish Ashwin Jain') && s.company.includes('Nomura')) {
      newPkg = '13.66 LPA';
      newCtc = '₹13,66,000 (₹11,66,000 Base + ₹2,00,000 Joining Bonus)';
    } else if (s.name.includes('Umang Bhatt') && s.company.includes('Nomura')) {
      newPkg = '13.66 LPA';
      newCtc = '₹13,66,000 (₹11,66,000 Base + ₹2,00,000 Joining Bonus)';
    }

    if (newPkg !== s.package || newCtc !== s.ctc || newStipend !== s.stipend) {
      console.log(`Updating ${s.id} (${s.name} - ${s.company}):`);
      if (newPkg !== s.package) console.log(`  package: "${s.package}" -> "${newPkg}"`);
      if (newCtc !== s.ctc) console.log(`  ctc:     "${s.ctc}" -> "${newCtc}"`);
      if (newStipend !== s.stipend) console.log(`  stipend: "${s.stipend}" -> "${newStipend}"`);

      s.package = newPkg;
      s.ctc = newCtc;
      s.stipend = newStipend;
      await s.save();
      updatedCount++;
    }
  }

  console.log(`\nSuccessfully updated ${updatedCount} stories in MongoDB.`);

  // Invalidate Redis cache
  console.log('Invalidating Redis cache for stories...');
  try {
    await cacheService.invalidateStories();
    console.log('Stories cache invalidated successfully.');
  } catch (err) {
    console.warn('Cache invalidation warning:', err.message);
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
