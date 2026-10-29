const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../server');

describe('Module E: Responsible Examination Monitoring API & Lifecycle Tests', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let createdSessionId;
  let incidentToTest;

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

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
    if (originalReadyState !== undefined) {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: originalReadyState,
        configurable: true
      });
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. GET /api/modules/e/health returns 200 with ethical guarantees & vision status', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ready');
    assert.match(json.module, /Responsible Examination Monitoring/);
    assert.ok(Array.isArray(json.ethicalGuarantees));
    assert.ok(json.ethicalGuarantees.some(g => g.includes('No biometric face recognition')));
  });

  test('2. GET /api/modules/e/samples returns authentic preloaded CCTV footage list', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/samples`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.samples.length >= 2);
    assert.ok(json.samples.some(s => s.fileName.includes('classroom')));
  });

  test('3. POST /api/modules/e/sessions creates new examination surveillance session', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionName: 'Midterm Test Exam Hall 302',
        roomCode: 'HALL-302',
        videoFileName: 'classroom_diagonal_exam.mp4',
        config: { frameSkip: 3, headTurnThreshold: 2 }
      })
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.session.sessionId);
    assert.equal(json.session.roomCode, 'HALL-302');
    assert.equal(json.session.status, 'idle');
    createdSessionId = json.session.sessionId;
  });

  test('4. POST /api/modules/e/sessions/:id/start executes multi-candidate video analysis', async () => {
    assert.ok(createdSessionId, 'Session ID required');
    const res = await fetch(`${baseUrl}/api/modules/e/sessions/${createdSessionId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.metrics.fpsMeasured > 0);
    assert.ok(Array.isArray(json.incidents));
    assert.ok(Array.isArray(json.frames));

    if (json.incidents.length > 0) {
      incidentToTest = json.incidents[0];
      assert.ok(incidentToTest.incidentId);
      assert.ok(incidentToTest.confidence > 0);
      assert.equal(incidentToTest.reviewStatus, 'Pending Review');
    }
  });

  test('5. POST /api/modules/e/sessions/:id/pause and /resume updates processing lifecycle', async () => {
    assert.ok(createdSessionId);
    const pauseRes = await fetch(`${baseUrl}/api/modules/e/sessions/${createdSessionId}/pause`, { method: 'POST' });
    assert.equal(pauseRes.status, 200);
    const pauseJson = await pauseRes.json();
    assert.equal(pauseJson.status, 'paused');

    const resumeRes = await fetch(`${baseUrl}/api/modules/e/sessions/${createdSessionId}/resume`, { method: 'POST' });
    assert.equal(resumeRes.status, 200);
    const resumeJson = await resumeRes.json();
    assert.equal(resumeJson.status, 'running');
  });

  test('6. GET /api/modules/e/sessions/:id/incidents retrieves audit trail with status filter', async () => {
    assert.ok(createdSessionId);
    const res = await fetch(`${baseUrl}/api/modules/e/sessions/${createdSessionId}/incidents?status=all`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.incidents));
  });

  test('7. PATCH /api/modules/e/incidents/:id allows proctor to review and record notes', async () => {
    if (!incidentToTest) {
      return; // Skip if no incidents detected in short clip
    }
    const res = await fetch(`${baseUrl}/api/modules/e/incidents/${incidentToTest.incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewStatus: 'Reviewed',
        reviewerNotes: 'Verified candidate motion: Candidate adjusted spectacles and looked at wall clock.'
      })
    });

    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.incident.reviewStatus, 'Reviewed');
    assert.match(json.incident.reviewerNotes, /Candidate adjusted spectacles/);
    assert.ok(json.incident.reviewedAt);
  });

  test('8. PATCH /api/modules/e/incidents/:id rejects invalid status with 400', async () => {
    if (!incidentToTest) return;
    const res = await fetch(`${baseUrl}/api/modules/e/incidents/${incidentToTest.incidentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewStatus: 'Confirmed Cheater' // Rejected: Violates ethical AI policy!
      })
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.match(json.error, /Invalid status/);
  });

  test('9. POST /api/modules/e/sessions/:id/stop terminates session', async () => {
    assert.ok(createdSessionId);
    const res = await fetch(`${baseUrl}/api/modules/e/sessions/${createdSessionId}/stop`, { method: 'POST' });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'stopped');
  });

  test('10. GET /api/modules/e/video/:name returns 200/206 partial content range', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/video/classroom_diagonal_exam.mp4`, {
      headers: { Range: 'bytes=0-1023' }
    });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), 'bytes 0-1023/7513736');
  });

  test('11. Non-existent session returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/modules/e/sessions/INVALID-NONEXISTENT-999/start`, { method: 'POST' });
    assert.equal(res.status, 404);
  });
});
