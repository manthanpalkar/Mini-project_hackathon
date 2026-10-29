require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Story, Resource, Folder, Achievement } = require('../models');
const { ensureSystemFolders } = require('./initSystemFolders');

function maskUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

async function seedDevSafe() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[SAFETY HALT] MONGODB_URI is not set.');
    process.exit(1);
  }

  // Safety checks
  const parsed = new URL(uri);
  const hostname = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  console.log('[AUDIT] Target cluster (masked):', maskUri(uri));
  console.log('[AUDIT] Target host:', hostname);
  console.log('[AUDIT] Target database name:', dbName);

  if (!hostname.includes('loopuniversedev.ky5byth.mongodb.net')) {
    console.error('[SAFETY HALT] Host is NOT the authorized development cluster! Refusing to run.');
    process.exit(1);
  }

  if (dbName !== 'loop_universe_dev') {
    console.error('[SAFETY HALT] Database name is NOT loop_universe_dev! Refusing to run.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      }
    });

    console.log('[SAFETY VERIFIED] Connected to target database [' + mongoose.connection.name + '].');

    // 1. Ensure system folders
    await ensureSystemFolders();
    console.log('[SEED] System folder hierarchy initialized/verified.');

    // 2. Safe seed synthetic development test user (without touching existing users or creating production admin)
    const devStudentEmail = 'dev.student@spit.ac.in';
    const existingStudent = await User.findOne({ email: devStudentEmail });
    if (!existingStudent) {
      const hashedPassword = await bcrypt.hash('devpass123', 10);
      await User.create({
        email: devStudentEmail,
        name: 'Dev Student (Synthetic)',
        role: 'Student',
        branch: 'CSE',
        status: 'Active',
        currentYear: '3rd Year',
        password: hashedPassword,
        onboarded: true
      });
      console.log('[SEED] Created synthetic development student user:', devStudentEmail);
    } else {
      console.log('[SEED] Synthetic development student user already exists; skipped.');
    }

    // 3. Safe seed a synthetic placement story if empty
    const storyCount = await Story.countDocuments();
    if (storyCount === 0) {
      await Story.create({
        id: 'synthetic-story-1',
        name: 'Dev Candidate (Synthetic)',
        branch: 'CSE',
        subBranch: 'AI',
        passoutYear: '2026',
        company: 'Campus Innovations',
        role: 'Software Development Engineer',
        semester: '7',
        cgpa: '9.0',
        journey: {
          firstYear: 'Explored programming fundamentals and version control.',
          secondYear: 'Practiced data structures, algorithms, and web applications.',
          thirdYear: 'Built scalable campus solutions and prepared system design.',
          fourthYear: 'Cleared interviews for full-time software engineering role.',
          prep: 'Standard CS fundamentals, algorithms practice, and project building.',
          projects: 'Campus ride-pooling and sustainable computing dashboards.',
          howSecured: 'Cleared coding test and 2 technical rounds on campus.'
        },
        package: '18 LPA',
        ctc: '18 LPA',
        offerType: 'FTE'
      });
      console.log('[SEED] Seeded initial synthetic placement story.');
    } else {
      console.log(`[SEED] Found ${storyCount} existing stories; preserved without overwrite.`);
    }

    // 4. Safe seed a synthetic resource if empty
    const resourceCount = await Resource.countDocuments();
    if (resourceCount === 0) {
      await Resource.create({
        id: 'synthetic-res-1',
        title: 'UniVerse Development Welcome Guide',
        description: 'Synthetic developer guide for UniVerse platform setup and modules.',
        category: 'General',
        type: 'PDF',
        folderId: 'system-placement-material',
        uploadedBy: 'UniVerse System',
        status: 'approved',
        visibility: 'public'
      });
      console.log('[SEED] Seeded initial synthetic welcome resource.');
    } else {
      console.log(`[SEED] Found ${resourceCount} existing resources; preserved without overwrite.`);
    }

    await mongoose.disconnect();
    console.log('[SUCCESS] Safe dev seeding completed successfully.');
  } catch (err) {
    console.error('[SEED ERROR]', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDevSafe();
}

module.exports = { seedDevSafe };
