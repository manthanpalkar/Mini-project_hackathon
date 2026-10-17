const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const sessionService = require('../services/sessionService');
const activityService = require('../services/activityService');
const { app, JWT_SECRET } = require('../server');

test('Multi-Device Session & Persistent Auth Service', async (t) => {
  await t.test('createSession: generates unique session ID, human-readable device summary, and active cache', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ipAddress: '192.168.1.100'
    });

    assert.ok(session.sessionId.startsWith('SES-'), 'Session ID should start with SES- prefix');
    assert.equal(session.deviceSummary, 'Chrome on macOS', 'Device summary should correctly identify Chrome on macOS');
    assert.ok(session.expiresAt > new Date(), 'Session expiresAt should be in the future');

    const isActive = await sessionService.isSessionActive(session.sessionId, 'student@spit.ac.in');
    assert.equal(isActive, true, 'Newly created session should be immediately active in cache');
  });

  await t.test('device summary parser: correctly maps various user agents', () => {
    assert.equal(sessionService.parseDeviceSummary('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/120.0'), 'Edge on Windows');
    assert.equal(sessionService.parseDeviceSummary('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'), 'Safari on iOS');
    assert.equal(sessionService.parseDeviceSummary('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile'), 'Chrome on Android');
    assert.equal(sessionService.parseDeviceSummary(''), 'Web Browser');
  });

  await t.test('revokeSession: marks session as revoked in cache and terminates validity', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Chrome on Windows'
    });

    await sessionService.revokeSession(session.sessionId, 'student@spit.ac.in', 'User test revocation');
    const isActive = await sessionService.isSessionActive(session.sessionId, 'student@spit.ac.in');
    assert.equal(isActive, false, 'Revoked session must be inactive');
  });

  await t.test('revokeOtherSessions: revokes all sessions except current session ID', async () => {
    const s1 = await sessionService.createSession({ email: 'multi@spit.ac.in', userAgent: 'Device 1' });
    const s2 = await sessionService.createSession({ email: 'multi@spit.ac.in', userAgent: 'Device 2' });
    const s3 = await sessionService.createSession({ email: 'multi@spit.ac.in', userAgent: 'Device 3' });

    await sessionService.revokeOtherSessions('multi@spit.ac.in', s2.sessionId);

    assert.equal(await sessionService.isSessionActive(s1.sessionId, 'multi@spit.ac.in'), false, 'Session 1 must be revoked');
    assert.equal(await sessionService.isSessionActive(s2.sessionId, 'multi@spit.ac.in'), true, 'Current Session 2 must remain active');
    assert.equal(await sessionService.isSessionActive(s3.sessionId, 'multi@spit.ac.in'), false, 'Session 3 must be revoked');
  });

  await t.test('listUserSessions: returns active sessions with current session flag', async () => {
    const sCurrent = await sessionService.createSession({ email: 'lister@spit.ac.in', userAgent: 'Chrome on macOS' });
    const list = await sessionService.listUserSessions('lister@spit.ac.in', sCurrent.sessionId);

    assert.ok(Array.isArray(list), 'Should return list of sessions');
    const found = list.find(s => s.sessionId === sCurrent.sessionId);
    assert.ok(found, 'Current session must be present');
    assert.equal(found.isCurrent, true, 'Current session should have isCurrent = true');
  });
});

test('Security Audit Trail & Activity Intelligence Service', async (t) => {
  await t.test('sanitizeMetadata: removes sensitive credentials, tokens, and passwords', () => {
    const dirty = {
      password: 'superSecretPassword123!',
      token: 'jwt.token.here',
      apiKey: 'xyz-secret-key',
      safeField: 'student profile view',
      nested: {
        authorization: 'Bearer 12345',
        cookie: 'session=abc',
        normalInfo: 42
      }
    };

    const clean = activityService.sanitizeMetadata(dirty);
    assert.equal(clean.password, '[REDACTED]', 'Password must be redacted');
    assert.equal(clean.token, '[REDACTED]', 'Token must be redacted');
    assert.equal(clean.apiKey, '[REDACTED]', 'API key must be redacted');
    assert.equal(clean.safeField, 'student profile view', 'Safe fields must remain untouched');
    assert.equal(clean.nested.authorization, '[REDACTED]', 'Nested authorization must be redacted');
    assert.equal(clean.nested.cookie, '[REDACTED]', 'Nested cookie must be redacted');
    assert.equal(clean.nested.normalInfo, 42, 'Normal nested info preserved');
  });

  await t.test('logActivity: generates event ID and completes safely without error', async () => {
    const log = await activityService.logActivity({
      eventType: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      actorEmail: 'audit_test@spit.ac.in',
      actorRole: 'Student',
      summary: 'Test login event',
      outcome: 'SUCCESS',
      metadata: { browser: 'Chrome', password: 'shouldBeRedacted' }
    });

    assert.ok(log, 'Log entry should be created');
    assert.ok(log.eventId.startsWith('EVT-'), 'Event ID should start with EVT- prefix');
    assert.equal(log.metadata.password, '[REDACTED]', 'Password metadata must be sanitized');
  });
});

const http = require('http');
const mongoose = require('mongoose');

test('Sliding Token Rotation & 401 Expiry Verification', async (t) => {
  let server;
  let baseUrl;
  let originalReadyState;
  const SECRET = JWT_SECRET || process.env.JWT_SECRET || 'a-very-long-secret-key-that-is-at-least-32-chars-long';

  originalReadyState = mongoose.connection.readyState;
  Object.defineProperty(mongoose.connection, 'readyState', {
    value: 1,
    configurable: true
  });

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  t.after(() => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    if (server) server.close();
  });

  await t.test('expired JWT signature check produces HTTP 401 with code TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { email: 'expired@spit.ac.in', role: 'Student' },
      SECRET,
      { expiresIn: '-10s' }
    );

    const res = await fetch(`${baseUrl}/api/sessions/my`, {
      headers: {
        'Authorization': `Bearer ${expiredToken}`,
        'X-Forwarded-For': '10.99.88.77'
      }
    });

    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 401, 'Expired token must return HTTP 401 (NOT HTTP 403)');
    assert.equal(body.code, 'TOKEN_EXPIRED', 'Error payload must contain TOKEN_EXPIRED code');
  });

  await t.test('revoked session check produces HTTP 401 with code SESSION_REVOKED', async () => {
    const session = await sessionService.createSession({ email: 'revoked_user@spit.ac.in' });
    await sessionService.revokeSession(session.sessionId, 'revoked_user@spit.ac.in', 'Testing revocation');

    const tokenWithRevokedSession = jwt.sign(
      { email: 'revoked_user@spit.ac.in', role: 'Student', sessionId: session.sessionId },
      SECRET,
      { expiresIn: '1h' }
    );

    const res = await fetch(`${baseUrl}/api/sessions/my`, {
      headers: {
        'Authorization': `Bearer ${tokenWithRevokedSession}`,
        'X-Forwarded-For': '10.99.88.78'
      }
    });

    const body = await res.json().catch(() => ({}));
    assert.equal(res.status, 401, 'Revoked session must return HTTP 401 (NOT HTTP 403)');
    assert.equal(body.code, 'SESSION_REVOKED', 'Error payload must contain SESSION_REVOKED code');
  });

  await t.test('near-expiry token triggers sliding rotation and attaches X-Refreshed-Token header', async () => {
    const nearExpiryToken = jwt.sign(
      { email: 'refresher@spit.ac.in', role: 'Student', status: 'Active' },
      SECRET,
      { expiresIn: '2h' }
    );

    const { userAuthCache } = require('../server');
    userAuthCache.set('refresher@spit.ac.in', {
      email: 'refresher@spit.ac.in',
      role: 'Student',
      status: 'Active',
      onboarded: true
    });

    const res = await fetch(`${baseUrl}/api/sessions/my`, {
      headers: {
        'Authorization': `Bearer ${nearExpiryToken}`,
        'X-Forwarded-For': '10.99.88.79'
      }
    });

    const refreshedHeader = res.headers.get('x-refreshed-token');
    assert.ok(refreshedHeader, 'Near-expiry token must receive sliding refreshed token in X-Refreshed-Token header');
    const decodedNew = jwt.verify(refreshedHeader, SECRET);
    assert.equal(decodedNew.email, 'refresher@spit.ac.in', 'Refreshed token must contain same user email');
  });
});
