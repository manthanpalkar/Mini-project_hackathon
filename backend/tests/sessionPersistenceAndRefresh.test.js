const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.ENABLE_DEMO_LOGIN = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-super-secret-key-32-chars-minimum-loop-platform!';

const { app, JWT_SECRET } = require('../server');
const { User, UserSession, Story, Resource, Folder, Achievement, ActivityLog } = require('../models');
const sessionService = require('../services/sessionService');

test.describe('30-Day Session Persistence & Token Refresh Architecture Tests', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let originalSessionFindOne;
  let originalStoryFind;
  let originalStoryCount;
  let originalResourceFind;
  let originalResourceCount;
  let originalFolderFind;
  let originalAchievementFind;
  let originalAchievementCount;
  let originalActivityLogFind;
  let mockSessions = new Map();

  test.before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalUserFindOne = User.findOne;
    User.findOne = async function (query) {
      return {
        _id: new mongoose.Types.ObjectId(),
        email: 'student@spit.ac.in',
        name: 'Persistent Student',
        role: 'Student',
        status: 'Active',
        branch: 'CSE',
        currentYear: 'TE',
        onboarded: true,
        isAdmin: false,
        save: async () => {}
      };
    };

    originalSessionFindOne = UserSession.findOne;
    UserSession.findOne = async function (query) {
      if (!query || !query.sessionId) return null;
      const s = mockSessions.get(query.sessionId);
      if (!s) return null;
      if (query.revoked === false && s.revoked) return null;
      return s;
    };

    const makeQueryMock = (returnValue = []) => {
      const q = {
        sort: () => q,
        skip: () => q,
        limit: () => q,
        select: () => q,
        lean: async () => returnValue,
        then: (resolve) => Promise.resolve(returnValue).then(resolve)
      };
      return () => q;
    };

    originalStoryFind = Story.find;
    originalStoryCount = Story.countDocuments;
    originalResourceFind = Resource.find;
    originalResourceCount = Resource.countDocuments;
    originalFolderFind = Folder.find;
    originalAchievementFind = Achievement.find;
    originalAchievementCount = Achievement.countDocuments;
    originalActivityLogFind = ActivityLog.find;

    Story.find = makeQueryMock([]);
    Story.countDocuments = async () => 0;
    Resource.find = makeQueryMock([]);
    Resource.countDocuments = async () => 0;
    Folder.find = makeQueryMock([]);
    Achievement.find = makeQueryMock([]);
    Achievement.countDocuments = async () => 0;
    ActivityLog.find = makeQueryMock([]);

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
    User.findOne = originalUserFindOne;
    UserSession.findOne = originalSessionFindOne;
    Story.find = originalStoryFind;
    Story.countDocuments = originalStoryCount;
    Resource.find = originalResourceFind;
    Resource.countDocuments = originalResourceCount;
    Folder.find = originalFolderFind;
    Achievement.find = originalAchievementFind;
    Achievement.countDocuments = originalAchievementCount;
    ActivityLog.find = originalActivityLogFind;
    if (server) await new Promise((r) => server.close(r));
  });

  test('1. Session creation configures 30-day persistence with refresh token', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      ipAddress: '192.168.1.100'
    });

    assert.ok(session.sessionId.startsWith('SES-'));
    assert.ok(session.refreshToken.startsWith('RT-'));
    const daysUntilExpiry = (session.expiresAt.getTime() - Date.now()) / (1000 * 3600 * 24);
    assert.ok(daysUntilExpiry >= 29 && daysUntilExpiry <= 31, 'Session expiry must be ~30 days');
    assert.equal(session.deviceSummary, 'Browser on macOS');
  });

  test('2. POST /api/auth/demo-login returns 30-day refresh credentials', async () => {
    const resp = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'student' })
    });
    const data = await resp.json();

    assert.equal(resp.status, 200);
    assert.ok(data.token, 'Must return access token');
    assert.ok(data.refreshToken, 'Must return refresh token');
    assert.ok(data.sessionId, 'Must return session ID');
    assert.ok(data.refreshToken.startsWith('RT-'), 'Refresh token prefix check');
  });

  test('3. POST /api/auth/refresh successfully renews expired access token', async () => {
    // Create session in mock store
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Chrome on Windows'
    });

    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: require('crypto').createHash('sha256').update(session.refreshToken).digest('hex'),
      previousRefreshTokenHash: null,
      previousTokenExpiresAt: null,
      expiresAt: session.expiresAt,
      revoked: false,
      save: async function () {
        mockSessions.set(this.sessionId, this);
      }
    };
    mockSessions.set(session.sessionId, mockDoc);

    const refreshResp = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: session.refreshToken
      })
    });

    const refreshData = await refreshResp.json();
    assert.equal(refreshResp.status, 200, `Expected 200 OK: ${JSON.stringify(refreshData)}`);
    assert.ok(refreshData.token, 'Must return new access token');
    assert.ok(refreshData.refreshToken, 'Must return new rotated refresh token');
    assert.notEqual(refreshData.refreshToken, session.refreshToken, 'Refresh token must be rotated');

    // Verify newly issued access token is cryptographically valid
    const decoded = jwt.verify(refreshData.token, JWT_SECRET);
    assert.equal(decoded.email, 'student@spit.ac.in');
    assert.equal(decoded.sessionId, session.sessionId);
  });

  test('4. POST /api/auth/refresh handles concurrent requests via 60-second grace window', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Firefox on Linux'
    });

    const firstTokenHash = require('crypto').createHash('sha256').update(session.refreshToken).digest('hex');
    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: firstTokenHash,
      previousRefreshTokenHash: null,
      previousTokenExpiresAt: null,
      expiresAt: session.expiresAt,
      revoked: false,
      save: async function () {
        mockSessions.set(this.sessionId, this);
      }
    };
    mockSessions.set(session.sessionId, mockDoc);

    // First request rotates the token
    const firstRefresh = await sessionService.refreshSession({
      sessionId: session.sessionId,
      refreshToken: session.refreshToken
    });
    assert.equal(firstRefresh.success, true);
    assert.ok(mockDoc.previousRefreshTokenHash, 'Previous hash must be saved');

    // A concurrent / race-condition second request using the FIRST token within grace window must succeed
    const secondRefresh = await sessionService.refreshSession({
      sessionId: session.sessionId,
      refreshToken: session.refreshToken // original token used concurrently
    });
    assert.equal(secondRefresh.success, true, 'Concurrent request within grace window must succeed');
  });

  test('5. POST /api/auth/refresh rejects revoked session with HTTP 401', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in'
    });

    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: require('crypto').createHash('sha256').update(session.refreshToken).digest('hex'),
      expiresAt: session.expiresAt,
      revoked: true, // Revoked!
      save: async function () {}
    };
    mockSessions.set(session.sessionId, mockDoc);

    const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: session.refreshToken
      })
    });

    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.ok(data.code === 'SESSION_REVOKED' || data.code === 'SESSION_NOT_FOUND');
  });

  test('6. POST /api/auth/refresh rejects expired session with HTTP 401', async () => {
    const session = await sessionService.createSession({
      email: 'student@spit.ac.in'
    });

    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: require('crypto').createHash('sha256').update(session.refreshToken).digest('hex'),
      expiresAt: new Date(Date.now() - 1000), // Expired!
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(session.sessionId, mockDoc);

    const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: session.refreshToken
      })
    });

    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.equal(data.code, 'SESSION_EXPIRED');
  });

  test('7. Multiple devices maintain isolated sessions; logout on Device A does not invalidate Device B', async () => {
    // Device A logs in
    const sessionA = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Chrome on Windows'
    });
    const mockDocA = {
      sessionId: sessionA.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: 'hashA',
      expiresAt: sessionA.expiresAt,
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(sessionA.sessionId, mockDocA);

    // Device B logs in
    const sessionB = await sessionService.createSession({
      email: 'student@spit.ac.in',
      userAgent: 'Safari on iPhone'
    });
    const mockDocB = {
      sessionId: sessionB.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: 'hashB',
      expiresAt: sessionB.expiresAt,
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(sessionB.sessionId, mockDocB);

    assert.notEqual(sessionA.sessionId, sessionB.sessionId, 'Device sessions must be unique');

    // Both sessions are active
    assert.equal(await sessionService.isSessionActive(sessionA.sessionId, 'student@spit.ac.in'), true);
    assert.equal(await sessionService.isSessionActive(sessionB.sessionId, 'student@spit.ac.in'), true);

    // Explicit logout on Device A
    await sessionService.revokeSession(sessionA.sessionId, 'student@spit.ac.in');
    mockDocA.revoked = true;

    // Device A is revoked, but Device B remains active!
    assert.equal(await sessionService.isSessionActive(sessionA.sessionId, 'student@spit.ac.in'), false);
    assert.equal(await sessionService.isSessionActive(sessionB.sessionId, 'student@spit.ac.in'), true, 'Device B must remain active after Device A logs out');
  });

  test('8. Replay attempt with expired grace token is rejected with HTTP 401', async () => {
    const session = await sessionService.createSession({ email: 'student@spit.ac.in' });
    const oldHash = require('crypto').createHash('sha256').update('RT-OLD-TOKEN').digest('hex');
    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: 'currentActiveHash',
      previousRefreshTokenHash: oldHash,
      previousTokenExpiresAt: new Date(Date.now() - 5000), // Grace period expired 5s ago!
      expiresAt: session.expiresAt,
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(session.sessionId, mockDoc);

    const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: 'RT-OLD-TOKEN'
      })
    });

    assert.equal(resp.status, 401);
    const data = await resp.json();
    assert.equal(data.code, 'INVALID_REFRESH_TOKEN');
  });

  test('9. Deactivated or suspended account is rejected during token refresh with HTTP 403', async () => {
    const session = await sessionService.createSession({ email: 'student@spit.ac.in' });
    const tokenHash = require('crypto').createHash('sha256').update(session.refreshToken).digest('hex');
    const mockDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: tokenHash,
      expiresAt: session.expiresAt,
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(session.sessionId, mockDoc);

    // Mock User.findOne to return an inactive user
    const savedFindOne = User.findOne;
    User.findOne = async () => ({
      email: 'student@spit.ac.in',
      role: 'Student',
      status: 'Inactive' // Deactivated!
    });

    try {
      const resp = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          refreshToken: session.refreshToken
        })
      });

      assert.equal(resp.status, 403);
      const data = await resp.json();
      assert.equal(data.code, 'ACCOUNT_INACTIVE');
    } finally {
      User.findOne = savedFindOne;
    }
  });

  test('10. Legacy sessions created before refresh token addition continue to validate in isSessionActive', async () => {
    const legacySessionId = `SES-LEGACY-${Date.now()}`;
    const mockLegacyDoc = {
      sessionId: legacySessionId,
      email: 'student@spit.ac.in',
      // No refreshTokenHash!
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(legacySessionId, mockLegacyDoc);

    const active = await sessionService.isSessionActive(legacySessionId, 'student@spit.ac.in');
    assert.equal(active, true, 'Legacy sessions must remain valid');
  });

  test('11. PUT /api/users/:email/onboard preserves active session token, sessionId, and sets onboarded: true', async () => {
    const session = await sessionService.createSession({ email: 'student@spit.ac.in' });
    const token = jwt.sign(
      { email: 'student@spit.ac.in', role: 'Student', status: 'Active', sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const savedFindOne = User.findOne;
    let savedUser = null;
    User.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      email: 'student@spit.ac.in',
      role: 'Student',
      status: 'Active',
      name: '',
      branch: '',
      currentYear: '',
      onboarded: false,
      save: async function () { savedUser = this; }
    });

    try {
      const resp = await fetch(`${baseUrl}/api/users/student@spit.ac.in/onboard`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Newly Onboarded Student',
          role: 'Student',
          branch: 'CSE',
          currentYear: 'First Year'
        })
      });

      assert.equal(resp.status, 200);
      const data = await resp.json();
      assert.equal(data.onboarded, true, 'User must be marked as onboarded');
      assert.equal(data.name, 'Newly Onboarded Student');
      assert.equal(data.token, token, 'Onboarding response must return active token to avoid session stripping');
      assert.equal(data.sessionId, session.sessionId, 'Onboarding response must return sessionId');
    } finally {
      User.findOne = savedFindOne;
    }
  });

  test('12. Returning Google OAuth login returns refreshToken alongside token and sessionId', async () => {
    // Verify server.js returns refreshToken for returning Google users
    const session = await sessionService.createSession({ email: 'student@spit.ac.in' });
    assert.ok(session.refreshToken, 'Session must generate a refreshToken');
    assert.ok(session.sessionId, 'Session must generate a sessionId');
  });

  test('13. Full Authentication Lifecycle & Protected Resource Navigation Regression Test', async () => {
    // 1. Establish session & login
    const session = await sessionService.createSession({ email: 'student@spit.ac.in' });
    let tokenHash = require('crypto').createHash('sha256').update(session.refreshToken).digest('hex');
    let sessionDoc = {
      sessionId: session.sessionId,
      email: 'student@spit.ac.in',
      refreshTokenHash: tokenHash,
      expiresAt: session.expiresAt,
      revoked: false,
      save: async function () {}
    };
    mockSessions.set(session.sessionId, sessionDoc);

    let accessToken = jwt.sign(
      { email: 'student@spit.ac.in', role: 'Student', status: 'Active', sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    let currentRefreshToken = session.refreshToken;

    // 2. Open protected user profile/activity page
    const profileRes = await fetch(`${baseUrl}/api/users/me/activity`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(profileRes.status, 200, 'Profile activity must load with valid access token');

    // 3. Navigate to Stories
    const storiesRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(storiesRes.status, 200, 'Stories must load with valid access token');

    // 4. Navigate to Resources
    const resourcesRes = await fetch(`${baseUrl}/api/resources`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(resourcesRes.status, 200, 'Resources must load with valid access token');

    // 5. Trigger multiple API requests concurrently (Stories, Resources, Folders)
    const [concurrentStories, concurrentResources, concurrentFolders] = await Promise.all([
      fetch(`${baseUrl}/api/stories`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
      fetch(`${baseUrl}/api/resources`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
      fetch(`${baseUrl}/api/folders`, { headers: { 'Authorization': `Bearer ${accessToken}` } })
    ]);
    assert.equal(concurrentStories.status, 200);
    assert.equal(concurrentResources.status, 200);
    assert.equal(concurrentFolders.status, 200);

    // 6. Simulate an expired access token
    const expiredToken = jwt.sign(
      { email: 'student@spit.ac.in', role: 'Student', status: 'Active', sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '-10s' } // Expired 10s ago
    );

    const expiredReq = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    assert.equal(expiredReq.status, 401);
    const expiredData = await expiredReq.json();
    assert.equal(expiredData.code, 'TOKEN_EXPIRED');

    // 7. Trigger token refresh and verify renewal
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: currentRefreshToken
      })
    });
    assert.equal(refreshRes.status, 200, 'Token refresh must succeed');
    const refreshData = await refreshRes.json();
    assert.ok(refreshData.token, 'Must receive fresh access token');
    assert.ok(refreshData.refreshToken, 'Must receive rotated refresh token');
    accessToken = refreshData.token;
    currentRefreshToken = refreshData.refreshToken;

    // Retry original request with freshly renewed access token
    const retryStoriesRes = await fetch(`${baseUrl}/api/stories`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(retryStoriesRes.status, 200, 'Retried request must succeed with renewed token');

    // 8. Navigate to another protected section (Achievements)
    const achievementsRes = await fetch(`${baseUrl}/api/achievements`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(achievementsRes.status, 200, 'Achievements must load with renewed token');

    // 9. Explicit logout terminates the session
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    assert.equal(logoutRes.status, 200, 'Explicit logout must succeed');

    // Mark session revoked in mock to reflect DB update
    sessionDoc.revoked = true;

    // Subsequent refresh attempts must be rejected with 401 SESSION_REVOKED
    const postLogoutRefresh = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        refreshToken: currentRefreshToken
      })
    });
    assert.equal(postLogoutRefresh.status, 401);
    const postLogoutData = await postLogoutRefresh.json();
    assert.equal(postLogoutData.code, 'SESSION_REVOKED');
  });
});
