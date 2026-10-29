const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('http');

// Setup mock JWT token decoding for authMiddleware
process.env.JWT_SECRET = 'test_secret_for_wellbeing_12345';
const jwt = require('jsonwebtoken');

const wellbeingRouter = require('../modules/moduleD_digitalWellbeing/routes/wellbeingRoutes');

describe('Module D: Chrome Extension Synchronization Endpoint Tests', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/modules/d', wellbeingRouter);

  let server;
  let baseUrl;
  let testToken;
  const testEmail = 'student.extension@spit.ac.in';

  test('setup test HTTP server and generate auth token', async () => {
    testToken = jwt.sign(
      { email: testEmail, name: 'Extension Student', branch: 'CSE' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api/modules/d`;
        resolve();
      });
    });

    assert.ok(baseUrl);
  });

  test('POST /sync-extension rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/sync-extension`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: { title: 'Test' } })
    });
    assert.strictEqual(res.status, 401);
  });

  test('POST /sync-extension accepts valid completed session and activity events', async () => {
    const payload = {
      session: {
        title: 'Compiler Design Deep Work',
        targetDurationMinutes: 25,
        sessionCategory: 'coding',
        accumulatedActiveSeconds: 1500,
        contextSwitchCount: 2,
        distractingDurationSeconds: 120,
        focusQualityScore: 9,
        reflectionNotes: 'Great focus session using Chrome Extension',
        startedAt: new Date(Date.now() - 1500000).toISOString(),
        completedAt: new Date().toISOString()
      },
      events: [
        {
          domain: 'github.com',
          category: 'productive',
          durationSeconds: 900,
          isDistracting: false
        },
        {
          domain: 'stackoverflow.com',
          category: 'learning',
          durationSeconds: 480,
          isDistracting: false
        },
        {
          domain: 'youtube.com',
          category: 'distracting',
          durationSeconds: 120,
          isDistracting: true
        }
      ]
    };

    const res = await fetch(`${baseUrl}/sync-extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`
      },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.data.source, 'chrome_extension');
    assert.strictEqual(data.data.activeMinutes, 25);
  });

  test('GET /extension/summary responds with 200 OK for authenticated user', async () => {
    const res = await fetch(`${baseUrl}/extension/summary`, {
      headers: { Authorization: `Bearer ${testToken}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.userEmail, testEmail);
    assert.ok(data.summary);
  });

  test('teardown test HTTP server', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
