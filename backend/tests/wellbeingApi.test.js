const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { app } = require('../server');

describe('Module D: Privacy-Aware Digital Wellbeing API Test Suite', () => {
  let server;
  let baseUrl;
  let token;
  const testEmail = 'manthan.palkar24@spit.ac.in';
  const jwtSecret = process.env.JWT_SECRET || 'spit_loop_super_secret_jwt_key_2026_production_grade_32chars';

  before(async () => {
    token = jwt.sign(
      {
        email: testEmail,
        name: 'Manthan Palkar',
        role: 'Administrator',
        status: 'Active'
      },
      jwtSecret,
      { expiresIn: '2h' }
    );

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/modules/d/health returns 200 with module metadata and capability list', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Digital Wellbeing/);
    assert.ok(Array.isArray(json.capabilities));
    assert.ok(json.capabilities.includes('focus_session_state_machine'));
    assert.ok(json.capabilities.includes('user_categorization_rules'));
  });

  test('GET /api/modules/d/rules returns system defaults and user rules', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/rules`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.systemDefaultsCount > 0);
    assert.ok(Array.isArray(json.data.systemDefaults));
  });

  test('POST /api/modules/d/rules/preview classifies sample domain accurately', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/rules/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ domain: 'https://moodle.spit.ac.in/course/view.php?id=45' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.normalizedDomain, 'moodle.spit.ac.in');
    assert.equal(json.classification.category, 'learning');
  });

  test('POST /api/modules/d/rules rejects missing ruleName or pattern with 400', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/rules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ruleName: 'Incomplete Rule' })
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.ok(json.error);
  });

  test('POST /api/modules/d/events/generate-synthetic returns deterministic simulated events', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/events/generate-synthetic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        scenario: 'focused_study',
        eventCount: 6,
        seed: 123
      })
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.eventCount, 6);
    assert.equal(json.scenario, 'focused_study');
    assert.ok(json.disclaimer.includes('SIMULATED DEMO DATA'));
    assert.ok(Array.isArray(json.events));
    assert.equal(json.events[0].source, 'synthetic_demo');
  });

  test('GET /api/modules/d/privacy/status returns user privacy guarantees and tracking status', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/privacy/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(['IDLE', 'ACTIVE', 'PAUSED'].includes(json.trackingStatus));
    assert.ok(Array.isArray(json.privacyGuarantees));
    assert.ok(json.privacyGuarantees.length >= 3);
  });

  test('GET /api/modules/d/analytics returns comprehensive metrics summary', async () => {
    const res = await fetch(`${baseUrl}/api/modules/d/analytics?range=all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data.summary);
    assert.ok(Array.isArray(json.data.categoryBreakdown));
    assert.ok(Array.isArray(json.data.nudges));
  });

});
