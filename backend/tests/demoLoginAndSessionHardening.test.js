const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.ENABLE_DEMO_LOGIN = 'true';
process.env.ENABLE_ADMIN_DEMO = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';

const { app, JWT_SECRET } = require('../server');
const { User } = require('../models');
const sessionService = require('../services/sessionService');

test.describe('One-Click Demo Authentication & Session Resilience Test Suite', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalFindOne;
  let originalCreate;

  test.before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalFindOne = User.findOne;
    originalCreate = User.create;

    User.findOne = async function (query) {
      if (query && query.email) {
        if (query.email.test && query.email.test('student@spit.ac.in')) {
          return {
            _id: new mongoose.Types.ObjectId(),
            email: 'student@spit.ac.in',
            name: 'SPIT Demo Student',
            role: 'Student',
            status: 'Active',
            branch: 'CSE',
            currentYear: 'TE',
            onboarded: true,
            isAdmin: false,
            save: async () => {}
          };
        }
        if (query.email.test && query.email.test('admin@spit.ac.in')) {
          return {
            _id: new mongoose.Types.ObjectId(),
            email: 'admin@spit.ac.in',
            name: 'System Administrator',
            role: 'Administrator',
            status: 'Active',
            branch: 'COMP',
            currentYear: 'Faculty',
            onboarded: true,
            isAdmin: true,
            save: async () => {}
          };
        }
      }
      return null;
    };

    User.create = async function (data) {
      return {
        _id: new mongoose.Types.ObjectId(),
        email: data.email,
        name: data.name,
        role: data.role,
        status: data.status || 'Active',
        branch: data.branch || 'CSE',
        currentYear: data.currentYear || 'TE',
        onboarded: true,
        isAdmin: data.role === 'Administrator',
        save: async () => {}
      };
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (server) await new Promise((r) => server.close(r));
  });

  test('POST /api/auth/demo-login returns authenticated student session', async () => {
    const resp = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' })
    });
    const data = await resp.json();

    assert.equal(resp.status, 200, `Expected 200 OK: ${JSON.stringify(data)}`);
    assert.ok(data.token, 'Token must be present');
    assert.equal(data.email, 'student@spit.ac.in');
    assert.equal(data.role, 'Student');
    assert.equal(data.isAdmin, false);

    const decoded = jwt.verify(data.token, JWT_SECRET);
    assert.equal(decoded.email, 'student@spit.ac.in');
    assert.equal(decoded.role, 'Student');
    assert.ok(decoded.sessionId, 'Session ID must be in JWT');
  });

  test('POST /api/auth/demo-login returns authenticated admin session', async () => {
    const resp = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' })
    });
    const data = await resp.json();

    assert.equal(resp.status, 200);
    assert.ok(data.token);
    assert.equal(data.email, 'admin@spit.ac.in');
    assert.equal(data.role, 'Administrator');
    assert.equal(data.isAdmin, true);
  });

  test('sessionService.isSessionActive does not permanently revoke session on transient DB error', async () => {
    const testSessionId = `SES-TEST-${Date.now()}`;
    const testEmail = 'student@spit.ac.in';

    const isActive = await sessionService.isSessionActive(testSessionId, testEmail);
    assert.equal(isActive, true, 'Valid or fallback session must be active');
  });

  test('authenticateToken rejects forged tokens with HTTP 401', async () => {
    const forgedToken = jwt.sign({ email: 'hacker@spit.ac.in', role: 'Administrator' }, 'wrong-secret-key-that-does-not-match');
    const resp = await fetch(`${baseUrl}/api/stories`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });
    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.equal(data.code, 'TOKEN_EXPIRED');
  });

  test('authenticateToken rejects expired tokens with HTTP 401', async () => {
    const expiredToken = jwt.sign({ email: 'student@spit.ac.in', role: 'Student' }, JWT_SECRET, { expiresIn: -10 });
    const resp = await fetch(`${baseUrl}/api/stories`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.equal(data.code, 'TOKEN_EXPIRED');
  });
});
