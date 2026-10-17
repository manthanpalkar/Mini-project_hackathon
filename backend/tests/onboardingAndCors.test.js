process.env.NODE_ENV = 'test';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app, requireOnboarded, parseConfiguredOrigins, DEFAULT_ALLOWED_ORIGINS } = require('../server');
const { User, Folder, Story, Resource, Achievement } = require('../models');

describe('Onboarding Backend Enforcement & CORS Configuration', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let reqCount = 0;

  const JWT_SECRET = process.env.JWT_SECRET || 'a-very-long-secret-key-that-is-at-least-32-chars-long';

  // Test accounts
  const unonboardedStudent = {
    _id: 'user_unonboarded_1',
    id: 'user_unonboarded_1',
    email: 'new.student@spit.ac.in',
    name: 'New Student',
    role: 'Student',
    status: 'Active',
    onboarded: false,
    save: async function() { return this; }
  };

  const onboardedStudent = {
    _id: 'user_onboarded_2',
    id: 'user_onboarded_2',
    email: 'active.student@spit.ac.in',
    name: 'Active Student',
    role: 'Student',
    status: 'Active',
    onboarded: true,
    save: async function() { return this; }
  };

  const adminUser = {
    _id: 'user_admin_3',
    id: 'user_admin_3',
    email: 'admin@spit.ac.in',
    name: 'College Admin',
    role: 'Administrator',
    status: 'Active',
    onboarded: false, // Even if onboarded: false, admin must bypass
    isAdmin: true,
    save: async function() { return this; }
  };

  let unonboardedToken;
  let onboardedToken;
  let adminToken;

  function getHeaders(token) {
    reqCount++;
    return {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.50.60.${reqCount % 250 + 1}`,
      'Authorization': `Bearer ${token}`
    };
  }

  async function makeRequest(method, path, token, body = null) {
    const opts = {
      method,
      headers: getHeaders(token)
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${baseUrl}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  before(async () => {
    unonboardedToken = jwt.sign(
      { email: unonboardedStudent.email, role: unonboardedStudent.role, status: unonboardedStudent.status },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    onboardedToken = jwt.sign(
      { email: onboardedStudent.email, role: onboardedStudent.role, status: onboardedStudent.status },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { email: adminUser.email, role: adminUser.role, status: adminUser.status },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalUserFindOne = User.findOne;

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

    User.findOne = originalUserFindOne;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    User.findOne = async (query) => {
      if (!query || !query.email) return null;
      const em = query.email instanceof RegExp
        ? [unonboardedStudent.email, onboardedStudent.email, adminUser.email].find(e => query.email.test(e))
        : String(query.email);

      if (em === unonboardedStudent.email) return unonboardedStudent;
      if (em === onboardedStudent.email) return onboardedStudent;
      if (em === adminUser.email) return adminUser;
      return null;
    };
  });

  describe('TASK 2 — Backend Onboarding Enforcement', () => {
    test('Unonboarded student is BLOCKED from GET /api/folders with 403 ONBOARDING_REQUIRED', async () => {
      const { status, data } = await makeRequest('GET', '/api/folders', unonboardedToken);
      assert.equal(status, 403);
      assert.equal(data.code, 'ONBOARDING_REQUIRED');
      assert.match(data.error, /Onboarding required/i);
    });

    test('Unonboarded student is BLOCKED from GET /api/stories with 403 ONBOARDING_REQUIRED', async () => {
      const { status, data } = await makeRequest('GET', '/api/stories', unonboardedToken);
      assert.equal(status, 403);
      assert.equal(data.code, 'ONBOARDING_REQUIRED');
    });

    test('Unonboarded student is BLOCKED from GET /api/resources with 403 ONBOARDING_REQUIRED', async () => {
      const { status, data } = await makeRequest('GET', '/api/resources', unonboardedToken);
      assert.equal(status, 403);
      assert.equal(data.code, 'ONBOARDING_REQUIRED');
    });

    test('Unonboarded student is BLOCKED from GET /api/achievements with 403 ONBOARDING_REQUIRED', async () => {
      const { status, data } = await makeRequest('GET', '/api/achievements', unonboardedToken);
      assert.equal(status, 403);
      assert.equal(data.code, 'ONBOARDING_REQUIRED');
    });

    test('Unonboarded student is BLOCKED from chunked upload init with 403 ONBOARDING_REQUIRED', async () => {
      const { status, data } = await makeRequest('POST', '/api/resources/upload/init', unonboardedToken, {
        fileName: 'notes.pdf',
        fileSize: 1024,
        totalChunks: 1
      });
      assert.equal(status, 403);
      assert.equal(data.code, 'ONBOARDING_REQUIRED');
    });

    test('Unonboarded student is ALLOWED to access profile endpoint GET /api/users/:email', async () => {
      const { status, data } = await makeRequest('GET', `/api/users/${unonboardedStudent.email}`, unonboardedToken);
      // Returns 200 (or user object), NOT 403
      assert.notEqual(status, 403, 'Profile check must not be blocked by requireOnboarded');
    });

    test('Unonboarded student is ALLOWED to call PUT /api/users/:email/onboard to complete onboarding', async () => {
      // Mock findOneAndUpdate on User for onboarding
      const originalFindOneAndUpdate = User.findOneAndUpdate;
      User.findOneAndUpdate = async () => ({
        ...unonboardedStudent,
        onboarded: true,
        branch: 'Computer Engineering'
      });

      const { status, data } = await makeRequest('PUT', `/api/users/${unonboardedStudent.email}/onboard`, unonboardedToken, {
        name: 'New Student',
        branch: 'Computer Engineering',
        currentYear: 'Third Year',
        role: 'Student'
      });

      User.findOneAndUpdate = originalFindOneAndUpdate;

      assert.notEqual(status, 403, 'Onboard endpoint must not be blocked by requireOnboarded');
      assert.equal(status, 200);
      assert.equal(data.onboarded, true);
    });

    test('Admin bypass: administrator with onboarded: false bypasses requireOnboarded middleware', async () => {
      // Test direct middleware execution
      let nextCalled = false;
      const mockReq = { user: adminUser };
      const mockRes = {
        status: () => mockRes,
        json: () => mockRes
      };
      requireOnboarded(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'requireOnboarded must call next() for administrators');
    });

    test('Onboarded student with onboarded: true successfully passes requireOnboarded middleware', async () => {
      let nextCalled = false;
      const mockReq = { user: onboardedStudent };
      const mockRes = {
        status: () => mockRes,
        json: () => mockRes
      };
      requireOnboarded(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, 'requireOnboarded must call next() for onboarded students');
    });
  });

  describe('TASK 3 — CORS Discrepancy Resolution & parseConfiguredOrigins', () => {
    test('parseConfiguredOrigins: preserves default origins when no env is set', () => {
      const origins = parseConfiguredOrigins({});
      for (const def of DEFAULT_ALLOWED_ORIGINS) {
        assert.ok(origins.includes(def), `Default origin ${def} must be present`);
      }
    });

    test('parseConfiguredOrigins: correctly parses ALLOWED_ORIGIN (singular)', () => {
      const origins = parseConfiguredOrigins({
        ALLOWED_ORIGIN: 'https://staging.spit-loop.edu'
      });
      assert.ok(origins.includes('https://staging.spit-loop.edu'));
    });

    test('parseConfiguredOrigins: correctly parses ALLOWED_ORIGINS (plural)', () => {
      const origins = parseConfiguredOrigins({
        ALLOWED_ORIGINS: 'https://preview.spit-loop.edu, https://test.spit-loop.edu'
      });
      assert.ok(origins.includes('https://preview.spit-loop.edu'));
      assert.ok(origins.includes('https://test.spit-loop.edu'));
    });

    test('parseConfiguredOrigins: merges both singular and plural without duplicate entries', () => {
      const origins = parseConfiguredOrigins({
        ALLOWED_ORIGIN: 'http://localhost:5173, https://singular.spit-loop.edu',
        ALLOWED_ORIGINS: 'https://plural.spit-loop.edu, https://singular.spit-loop.edu'
      });

      assert.ok(origins.includes('https://singular.spit-loop.edu'));
      assert.ok(origins.includes('https://plural.spit-loop.edu'));
      assert.ok(origins.includes('http://localhost:5173'));

      // Verify no duplicates
      const count = origins.filter(o => o === 'https://singular.spit-loop.edu').length;
      assert.equal(count, 1, 'Merged origins must not contain duplicates');
    });

    test('parseConfiguredOrigins: trims whitespace and ignores empty or blank segments', () => {
      const origins = parseConfiguredOrigins({
        ALLOWED_ORIGINS: '  https://clean.spit-loop.edu  , ,   , https://another.spit-loop.edu  '
      });
      assert.ok(origins.includes('https://clean.spit-loop.edu'));
      assert.ok(origins.includes('https://another.spit-loop.edu'));
      assert.equal(origins.includes(''), false);
      assert.equal(origins.includes(' '), false);
    });
  });
});
