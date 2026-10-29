const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './.env' });

async function syncPasswords() {
  await mongoose.connect(process.env.MONGODB_URI);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('spit123', salt);

  // Update dev.student@spit.ac.in to spit123
  await mongoose.connection.collection('users').updateOne(
    { email: 'dev.student@spit.ac.in' },
    { $set: { password: hashedPassword, status: 'Active', onboarded: true, name: 'Student Dev', branch: 'Computer Science' } }
  );

  // Create or update student@spit.ac.in with spit123
  await mongoose.connection.collection('users').updateOne(
    { email: 'student@spit.ac.in' },
    {
      $set: {
        email: 'student@spit.ac.in',
        username: 'student',
        password: hashedPassword,
        role: 'Student',
        status: 'Active',
        onboarded: true,
        name: 'Aarav Sharma',
        branch: 'Information Technology'
      }
    },
    { upsert: true }
  );

  // Ensure manthan.palkar24@spit.ac.in has spit123
  await mongoose.connection.collection('users').updateOne(
    { email: 'manthan.palkar24@spit.ac.in' },
    { $set: { password: hashedPassword, status: 'Active', onboarded: true, role: 'Administrator' } }
  );

  // Ensure admin@spit.ac.in has spit123
  await mongoose.connection.collection('users').updateOne(
    { email: 'admin@spit.ac.in' },
    { $set: { password: hashedPassword, status: 'Active', onboarded: true, role: 'Administrator' } }
  );

  const allUsers = await mongoose.connection.collection('users').find({}, { projection: { email: 1, role: 1, status: 1 } }).toArray();
  console.log('ALL USERS READY WITH PASSWORD "spit123":');
  console.log(allUsers);

  await mongoose.disconnect();
}

syncPasswords().catch(err => {
  console.error(err);
  process.exit(1);
});
