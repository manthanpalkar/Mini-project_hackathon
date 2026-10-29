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

    // 5. Safe seed Module B demonstration ride offers if empty
    const { RideOffer, RideRequest } = require('../modules/moduleB_ridePooling/models/rideModel');
    const rideOfferCount = await RideOffer.countDocuments();
    if (rideOfferCount === 0) {
      const now = new Date();
      const futureTime1 = new Date(now.getTime() + 45 * 60 * 1000); // +45 mins
      const futureTime2 = new Date(now.getTime() + 90 * 60 * 1000); // +90 mins
      const futureTime3 = new Date(now.getTime() + 180 * 60 * 1000); // +3 hours

      const demoRide1 = await RideOffer.create({
        driverEmail: 'aarav.mehta@spit.ac.in',
        driverName: 'Aarav Mehta (Senior SDE)',
        driverPhone: '+91 98200 11223',
        originNodeId: 'andheri_station_west',
        destinationNodeId: 'spit_library',
        originName: 'Andheri Railway Station (West)',
        destinationName: 'SPIT Central Library & Academic Quad',
        departureTime: futureTime1,
        totalSeats: 4,
        availableSeats: 3,
        confirmedPassengerCount: 1,
        maxDetourKm: 2.0,
        costPerSeat: 10,
        vehicleType: 'car',
        vehicleModel: 'Hyundai i20 White',
        vehicleNumber: 'MH-02-EE-4120',
        originalRoute: ['andheri_station_west', 'spit_main_gate', 'spit_library'],
        originalDistanceKm: 2.5,
        originalDurationMins: 9,
        currentRoute: ['andheri_station_west', 'spit_main_gate', 'spit_library'],
        currentDistanceKm: 2.5,
        currentDurationMins: 9,
        status: 'open',
        confirmedPassengers: []
      });

      // Add one confirmed passenger to demoRide1
      const demoReq = await RideRequest.create({
        passengerEmail: 'dev.student@spit.ac.in',
        passengerName: 'Dev Student (Synthetic)',
        rideOfferId: demoRide1._id,
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        pickupName: "SPIT Main Gate (Bhavan's Campus)",
        dropoffName: 'SPIT Central Library & Academic Quad',
        seatsRequested: 1,
        desiredDepartureTime: futureTime1,
        status: 'accepted',
        matchMetrics: {
          detourKm: 0,
          estimatedCo2SavedGrams: 360,
          fareEstimate: 10,
          monetarySavings: 25,
          matchScore: 98,
          explanation: "Direct match along driver's planned transit trajectory (0 km detour)"
        }
      });

      demoRide1.confirmedPassengers.push({
        passengerEmail: 'dev.student@spit.ac.in',
        passengerName: 'Dev Student (Synthetic)',
        pickupNodeId: 'spit_main_gate',
        dropoffNodeId: 'spit_library',
        seatsBooked: 1,
        fareTotal: 10,
        requestId: demoReq._id
      });
      await demoRide1.save();

      await RideOffer.create({
        driverEmail: 'tanvi.shukla@spit.ac.in',
        driverName: 'Tanvi Shukla (EXTC 4th Yr)',
        driverPhone: '+91 98331 44556',
        originNodeId: 'azad_nagar_metro',
        destinationNodeId: 'spit_hostel_boys',
        originName: 'Azad Nagar Metro Station (Line 1)',
        destinationName: "Bhavan's Boys Hostel Campus",
        departureTime: futureTime2,
        totalSeats: 3,
        availableSeats: 3,
        confirmedPassengerCount: 0,
        maxDetourKm: 1.5,
        costPerSeat: 0, // Free carpool
        vehicleType: 'car',
        vehicleModel: 'Maruti Baleno Silver',
        vehicleNumber: 'MH-02-CB-8891',
        originalRoute: ['azad_nagar_metro', 'spit_main_gate', 'bhavans_lake', 'spit_hostel_boys'],
        originalDistanceKm: 1.8,
        originalDurationMins: 7,
        currentRoute: ['azad_nagar_metro', 'spit_main_gate', 'bhavans_lake', 'spit_hostel_boys'],
        currentDistanceKm: 1.8,
        currentDurationMins: 7,
        status: 'open',
        confirmedPassengers: []
      });

      await RideOffer.create({
        driverEmail: 'siddharth.deshmukh@spit.ac.in',
        driverName: 'Siddharth Deshmukh (Faculty CSE)',
        driverPhone: '+91 98199 77889',
        originNodeId: 'versova_link_road',
        destinationNodeId: 'spit_main_gate',
        originName: 'Versova Link Road Junction',
        destinationName: "SPIT Main Gate (Bhavan's Campus)",
        departureTime: futureTime3,
        totalSeats: 4,
        availableSeats: 4,
        confirmedPassengerCount: 0,
        maxDetourKm: 2.5,
        costPerSeat: 15,
        vehicleType: 'car',
        vehicleModel: 'Honda City Grey',
        vehicleNumber: 'MH-02-DP-1002',
        originalRoute: ['versova_link_road', 'dn_nagar_metro', 'spit_main_gate'],
        originalDistanceKm: 3.2,
        originalDurationMins: 11,
        currentRoute: ['versova_link_road', 'dn_nagar_metro', 'spit_main_gate'],
        currentDistanceKm: 3.2,
        currentDurationMins: 11,
        status: 'open',
        confirmedPassengers: []
      });

      console.log('[SEED] Seeded 3 synthetic campus ride offers and 1 accepted passenger request.');
    } else {
      console.log(`[SEED] Found ${rideOfferCount} existing ride offers; preserved without overwrite.`);
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
