process.env.NODE_ENV = 'test';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { app, normalizeLoginIdentifier } = require('../server');
const { User } = require('../models');

describe('Login Formats & Flexible Identifier Authentication', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalFindOne;
  let reqCount = 0;

  // Pre-hashed password for testing
  const plainPassword = 'CorrectPassword123!';
  let hashedPassword;

  before(async () => {
    hashedPassword = await bcrypt.hash(plainPassword, 8);

    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalFindOne = User.findOne;

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    User.findOne = originalFindOne;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // Helper to make test requests with distinct forwarded IPs to prevent rate-limiting test flakiness
  async function makeLoginRequest(payload) {
    reqCount++;
    const res = await fetch(`${baseUrl}/api/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `192.168.10.${reqCount}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // Unit tests for normalizeLoginIdentifier
  describe('normalizeLoginIdentifier: Normalization & Safety', () => {
    test('normalizes standard username by appending @spit.ac.in', () => {
      const res = normalizeLoginIdentifier('swapnil.patil24');
      assert.equal(res.valid, true);
      assert.equal(res.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(res.username, 'swapnil.patil24');
    });

    test('normalizes full SPIT email address', () => {
      const res = normalizeLoginIdentifier('swapnil.patil24@spit.ac.in');
      assert.equal(res.valid, true);
      assert.equal(res.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(res.username, 'swapnil.patil24');
    });

    test('trims surrounding whitespace and converts uppercase', () => {
      const resUser = normalizeLoginIdentifier('   SWAPNIL.PATIL24   ');
      assert.equal(resUser.valid, true);
      assert.equal(resUser.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(resUser.username, 'swapnil.patil24');

      const resEmail = normalizeLoginIdentifier('  SWAPNIL.PATIL24@SPIT.AC.IN  ');
      assert.equal(resEmail.valid, true);
      assert.equal(resEmail.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(resEmail.username, 'swapnil.patil24');
    });

    test('rejects non-SPIT email domains', () => {
      const res = normalizeLoginIdentifier('swapnil.patil24@gmail.com');
      assert.equal(res.valid, false);
      assert.match(res.error, /@spit\.ac\.in/i);
    });

    test('rejects malformed email formats (multiple @, missing parts)', () => {
      assert.equal(normalizeLoginIdentifier('user@@spit.ac.in').valid, false);
      assert.equal(normalizeLoginIdentifier('@spit.ac.in').valid, false);
      assert.equal(normalizeLoginIdentifier('user@').valid, false);
    });

    test('rejects usernames with spaces or illegal characters', () => {
      assert.equal(normalizeLoginIdentifier('swapnil patil').valid, false);
      assert.equal(normalizeLoginIdentifier('swapnil<script>').valid, false);
      assert.equal(normalizeLoginIdentifier('swapnil;DROP').valid, false);
    });

    test('rejects empty or non-string inputs', () => {
      assert.equal(normalizeLoginIdentifier('').valid, false);
      assert.equal(normalizeLoginIdentifier('   ').valid, false);
      assert.equal(normalizeLoginIdentifier(12345).valid, false);
      assert.equal(normalizeLoginIdentifier(null).valid, false);
    });
  });

  // End-to-end endpoint tests for /api/users/login
  describe('POST /api/users/login: Authentication Workflows', () => {
    const mockUser = {
      email: 'swapnil.patil24@spit.ac.in',
      username: 'swapnil.patil24',
      name: 'Swapnil Patil',
      role: 'Student',
      status: 'Active',
      branch: 'Computer Engineering',
      currentYear: 'Final Year',
      onboarded: true,
      nameColor: '#007AFF',
      password: '' // will set in before
    };

    before(() => {
      mockUser.password = hashedPassword;

      // Mock User.findOne to match either email or username in the $or array
      User.findOne = async (query) => {
        if (!query || !query.$or) return null;
        for (const condition of query.$or) {
          if (condition.email && condition.email.test(mockUser.email)) {
            return mockUser;
          }
          if (condition.username && condition.username.test(mockUser.username)) {
            return mockUser;
          }
        }
        return null;
      };
    });

    test('succeeds using full SPIT email address', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'swapnil.patil24@spit.ac.in',
        password: plainPassword
      });

      assert.equal(status, 200);
      assert.equal(data.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(data.username, 'swapnil.patil24');
      assert.ok(data.token, 'Token must be issued');
    });

    test('succeeds using username without @spit.ac.in', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'swapnil.patil24',
        password: plainPassword
      });

      assert.equal(status, 200);
      assert.equal(data.email, 'swapnil.patil24@spit.ac.in');
      assert.equal(data.username, 'swapnil.patil24');
      assert.ok(data.token, 'Token must be issued');
    });

    test('succeeds with whitespace and uppercase username', async () => {
      const { status, data } = await makeLoginRequest({
        email: '  SWAPNIL.PATIL24  ',
        password: plainPassword
      });

      assert.equal(status, 200);
      assert.equal(data.email, 'swapnil.patil24@spit.ac.in');
    });

    test('succeeds with whitespace and uppercase email', async () => {
      const { status, data } = await makeLoginRequest({
        email: '  SWAPNIL.PATIL24@SPIT.AC.IN  ',
        password: plainPassword
      });

      assert.equal(status, 200);
      assert.equal(data.email, 'swapnil.patil24@spit.ac.in');
    });

    test('rejects incorrect password with 401', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'swapnil.patil24',
        password: 'WrongPassword999!'
      });

      assert.equal(status, 401);
      assert.equal(data.error, 'Invalid username/email or password. Please try again.');
    });

    test('rejects unknown username / email with 401', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'unknown.user999',
        password: plainPassword
      });

      assert.equal(status, 401);
      assert.equal(data.error, 'Invalid username/email or password. Please try again.');
    });

    test('rejects non-SPIT email domains with 400', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'external@gmail.com',
        password: plainPassword
      });

      assert.equal(status, 400);
      assert.match(data.error, /@spit\.ac\.in/i);
    });

    test('rejects malformed identifier with 400', async () => {
      const { status, data } = await makeLoginRequest({
        email: 'swapnil@@spit.ac.in',
        password: plainPassword
      });

      assert.equal(status, 400);
      assert.match(data.error, /malformed/i);
    });

    test('rejects inactive accounts with 403', async () => {
      const savedStatus = mockUser.status;
      mockUser.status = 'Inactive';

      const { status, data } = await makeLoginRequest({
        email: 'swapnil.patil24',
        password: plainPassword
      });

      mockUser.status = savedStatus; // restore
      assert.equal(status, 403);
      assert.match(data.error, /inactive/i);
    });

    test('rejects pending accounts with 403', async () => {
      const savedStatus = mockUser.status;
      mockUser.status = 'Pending';

      const { status, data } = await makeLoginRequest({
        email: 'swapnil.patil24',
        password: plainPassword
      });

      mockUser.status = savedStatus; // restore
      assert.equal(status, 403);
      assert.match(data.error, /pending/i);
    });
  });
});
