require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

async function setupAccounts() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to Atlas DB:', mongoose.connection.name);

  const defaultPassword = 'spit123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  // 1. Manthan Palkar account
  const manthanEmail = 'manthan.palkar24@spit.ac.in';
  const manthan = await User.findOneAndUpdate(
    { email: manthanEmail },
    {
      $set: {
        email: manthanEmail,
        username: 'manthan.palkar24',
        name: 'Manthan Palkar',
        role: 'Administrator',
        isAdmin: true,
        branch: 'CSE',
        status: 'Active',
        currentYear: '4th Year',
        password: hashedPassword,
        onboarded: true
      }
    },
    { upsert: true, new: true }
  );
  console.log('Upserted user:', manthan.email, 'Role:', manthan.role);

  // 2. Default Administrator account
  const adminEmail = 'admin@spit.ac.in';
  const adminUser = await User.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        email: adminEmail,
        username: 'admin',
        name: 'Loop Administrator',
        role: 'Administrator',
        isAdmin: true,
        branch: 'CSE',
        status: 'Active',
        password: hashedPassword,
        onboarded: true
      }
    },
    { upsert: true, new: true }
  );
  console.log('Upserted user:', adminUser.email, 'Role:', adminUser.role);

  // Test bcrypt comparison
  const match = await bcrypt.compare(defaultPassword, manthan.password);
  console.log('Password verification for spit123 on', manthanEmail, ':', match ? 'VALID' : 'FAILED');

  process.exit(0);
}

setupAccounts().catch(err => {
  console.error(err);
  process.exit(1);
});
