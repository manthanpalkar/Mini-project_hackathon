require('dotenv').config();
const mongoose = require('mongoose');

function maskUri(uri) {
  if (!uri) return 'undefined';
  return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
}

async function verifyConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI is not set in environment.');
    process.exit(1);
  }

  console.log('[AUDIT] Target connection (masked):', maskUri(uri));

  // Verify host and target
  const parsed = new URL(uri);
  const hostname = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  console.log('[AUDIT] Extracted Host:', hostname);
  console.log('[AUDIT] Extracted Database Name:', dbName);

  if (!hostname.includes('loopuniversedev.ky5byth.mongodb.net')) {
    console.error('[SAFETY HALT] Host is NOT the new Atlas cluster! Expected: loopuniversedev.ky5byth.mongodb.net');
    process.exit(1);
  }

  if (dbName !== 'loop_universe_dev') {
    console.error('[SAFETY HALT] Database name is NOT loop_universe_dev! Target was:', dbName);
    process.exit(1);
  }

  console.log('[ISOLATION VERIFIED] Target matches expected cluster and dev database.');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      }
    });

    console.log('[CONNECTION] Successfully connected to MongoDB Atlas!');
    console.log('[CONNECTION] ReadyState:', mongoose.connection.readyState);
    console.log('[CONNECTION] Active Database:', mongoose.connection.name);

    const pingResult = await mongoose.connection.db.admin().ping();
    console.log('[PING] Admin ping result:', pingResult);

    // Test synthetic write isolation
    const testCollection = mongoose.connection.db.collection('_connection_verification');
    const testDoc = {
      testId: 'verify_' + Date.now(),
      purpose: 'UniVerse isolation and write verification',
      createdAt: new Date()
    };

    const insertResult = await testCollection.insertOne(testDoc);
    console.log('[WRITE VERIFICATION] Inserted synthetic test document ID:', insertResult.insertedId.toString());

    const readBack = await testCollection.findOne({ _id: insertResult.insertedId });
    if (!readBack || readBack.testId !== testDoc.testId) {
      throw new Error('Read-back verification failed for inserted test doc');
    }
    console.log('[READ VERIFICATION] Synthetic test document read back successfully.');

    const deleteResult = await testCollection.deleteOne({ _id: insertResult.insertedId });
    console.log('[CLEANUP VERIFICATION] Synthetic test document deleted count:', deleteResult.deletedCount);

    // List existing collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('[COLLECTIONS] Existing collections in loop_universe_dev:', collections.map(c => c.name));

    await mongoose.disconnect();
    console.log('[SUCCESS] All connection and isolation checks completed cleanly.');
  } catch (err) {
    console.error('[CONNECTION ERROR]', err.message);
    process.exit(1);
  }
}

verifyConnection();
