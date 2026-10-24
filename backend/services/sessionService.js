const crypto = require('crypto');
const mongoose = require('mongoose');
const { UserSession } = require('../models');

// In-memory revoked session cache for high-speed authentication verification
const MAX_CACHE_ENTRIES = 10000;
const revokedSessionsCache = new Set();
const activeSessionsCache = new Map(); // sessionId -> { email, refreshTokenHash, expiresAt }
const sessionRefreshLocks = new Map(); // sessionId -> Promise for in-flight mutex serialization
const DEFAULT_SESSION_DURATION_HOURS = 24 * 30; // 30-day persistent session

function trimCache(collection) {
  if (!collection || collection.size <= MAX_CACHE_ENTRIES) return;
  const excess = collection.size - MAX_CACHE_ENTRIES;
  const iterator = collection.keys ? collection.keys() : collection.values();
  for (let i = 0; i < excess; i++) {
    const item = iterator.next().value;
    if (item !== undefined) collection.delete(item);
  }
}

/**
 * Determine a concise human-readable device and browser summary from userAgent
 */
function parseDeviceSummary(userAgent = '') {
  if (!userAgent || typeof userAgent !== 'string') return 'Web Browser';

  let os = 'Unknown OS';
  if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  else if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';

  return `${browser} on ${os}`;
}

/**
 * Create a new user session upon successful login (default 30-day persistence)
 */
async function createSession({ email, userAgent = '', ipAddress = '127.0.0.1', durationHours = DEFAULT_SESSION_DURATION_HOURS }) {
  const sessionId = `SES-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const refreshToken = `RT-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`;
  const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const deviceSummary = parseDeviceSummary(userAgent);
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

  const session = new UserSession({
    sessionId,
    email: email.toLowerCase().trim(),
    refreshTokenHash,
    deviceSummary,
    ipAddress: (ipAddress || '127.0.0.1').replace('::ffff:', ''),
    userAgent: userAgent.slice(0, 255),
    lastActive: new Date(),
    expiresAt,
    revoked: false
  });

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await session.save().catch(err => {
      console.warn('[SESSION_SERVICE_WARN] Session save failed:', err.message);
    });
  }
  activeSessionsCache.set(sessionId, { 
    email: email.toLowerCase().trim(), 
    refreshTokenHash,
    activeRefreshToken: refreshToken,
    expiresAt 
  });
  trimCache(activeSessionsCache);

  return {
    sessionId,
    refreshToken,
    deviceSummary,
    expiresAt
  };
}

/**
 * Refresh an existing user session with refresh token rotation and multi-request race protection
 */
async function refreshSession({ sessionId, refreshToken, userAgent = '', ipAddress = '127.0.0.1' }) {
  if (!sessionId || typeof sessionId !== 'string' || !refreshToken || typeof refreshToken !== 'string') {
    return { success: false, code: 'INVALID_INPUT', error: 'Session ID and refresh token are required.' };
  }

  // In-flight serialization: If a refresh for this sessionId is currently executing, wait for it
  if (sessionRefreshLocks.has(sessionId)) {
    try {
      const lockResult = await sessionRefreshLocks.get(sessionId);
      if (lockResult && lockResult.success) {
        return lockResult;
      }
    } catch (e) {}
  }

  const runRefresh = async () => {
    if (revokedSessionsCache.has(sessionId)) {
      return { success: false, code: 'SESSION_REVOKED', error: 'Session has been revoked or signed out.' };
    }

    let session = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        session = await UserSession.findOne({ sessionId });
      } catch (err) {
        console.warn('[SESSION_SERVICE_WARN] Error looking up session for refresh:', err.message);
        return { success: false, code: 'DB_ERROR', error: 'Database temporarily unavailable.' };
      }
    } else {
      return { success: false, code: 'DB_ERROR', error: 'Database temporarily unavailable.' };
    }

    if (!session) {
      // Session not found in database or was permanently removed/revoked
      revokedSessionsCache.add(sessionId);
      trimCache(revokedSessionsCache);
      activeSessionsCache.delete(sessionId);
      return { success: false, code: 'SESSION_REVOKED', error: 'Session has expired or was terminated.' };
    }

    if (session.revoked) {
      revokedSessionsCache.add(sessionId);
      trimCache(revokedSessionsCache);
      activeSessionsCache.delete(sessionId);
      return { success: false, code: 'SESSION_REVOKED', error: 'Session has been revoked or signed out.' };
    }

    // Check 30-day session expiration
    if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
      return { success: false, code: 'SESSION_EXPIRED', error: 'Session has expired. Please sign in again.' };
    }

    // Validate incoming refresh token against SHA-256 hash
    const incomingHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const incomingBuf = Buffer.from(incomingHash);

    let isCurrentMatch = false;
    let isGraceMatch = false;

    if (session.refreshTokenHash) {
      const currentBuf = Buffer.from(session.refreshTokenHash);
      if (incomingBuf.length === currentBuf.length && crypto.timingSafeEqual(incomingBuf, currentBuf)) {
        isCurrentMatch = true;
      }
    }

    // Check 60-second grace window for concurrent requests that used previous token during rotation
    if (!isCurrentMatch && session.previousRefreshTokenHash && session.previousTokenExpiresAt) {
      const prevBuf = Buffer.from(session.previousRefreshTokenHash);
      const isGraceWindow = Date.now() < new Date(session.previousTokenExpiresAt).getTime();
      if (isGraceWindow && incomingBuf.length === prevBuf.length && crypto.timingSafeEqual(incomingBuf, prevBuf)) {
        isGraceMatch = true;
      }
    }

    if (!isCurrentMatch && !isGraceMatch) {
      return { success: false, code: 'INVALID_REFRESH_TOKEN', error: 'Invalid refresh token.' };
    }

    // Idempotent grace window: If a concurrent request arrives with previous token within 60s
    // and we have the active rotated token cached in memory, return it directly without re-rotating
    const cached = activeSessionsCache.get(sessionId);
    if (isGraceMatch && cached && cached.activeRefreshToken) {
      return {
        success: true,
        email: session.email,
        sessionId: session.sessionId,
        refreshToken: cached.activeRefreshToken,
        expiresAt: session.expiresAt
      };
    }

    // Generate new rotated refresh token and extend session for 30 more days
    const newRefreshToken = `RT-${Date.now()}-${crypto.randomBytes(32).toString('hex')}`;
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + DEFAULT_SESSION_DURATION_HOURS * 3600 * 1000);

    if (isCurrentMatch) {
      session.previousRefreshTokenHash = session.refreshTokenHash;
      session.previousTokenExpiresAt = new Date(Date.now() + 60 * 1000); // 60s grace window
    }
    // If matching on grace, keep existing previousRefreshTokenHash so subsequent sibling requests continue to match!

    session.refreshTokenHash = newHash;
    session.expiresAt = newExpiresAt;
    session.lastActive = new Date();
    if (ipAddress) session.ipAddress = ipAddress.replace('::ffff:', '');
    if (userAgent) session.userAgent = userAgent.slice(0, 255);

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await session.save().catch(err => {
        console.warn('[SESSION_SERVICE_WARN] Error saving rotated session:', err.message);
      });
    }

    activeSessionsCache.set(sessionId, {
      email: session.email,
      refreshTokenHash: newHash,
      activeRefreshToken: newRefreshToken,
      expiresAt: newExpiresAt
    });
    trimCache(activeSessionsCache);

    return {
      success: true,
      email: session.email,
      sessionId: session.sessionId,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt
    };
  };

  const promise = runRefresh();
  sessionRefreshLocks.set(sessionId, promise);
  try {
    return await promise;
  } finally {
    sessionRefreshLocks.delete(sessionId);
  }
}

/**
 * Check if a session ID is valid and active
 */
async function isSessionActive(sessionId, email) {
  if (!sessionId) return true; // Legacy token fallback without session ID

  if (revokedSessionsCache.has(sessionId)) {
    return false;
  }

  // Check active cache first
  const cached = activeSessionsCache.get(sessionId);
  if (cached) {
    if (Date.now() > cached.expiresAt.getTime()) {
      activeSessionsCache.delete(sessionId);
      return false;
    }
    return true;
  }

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    let session = null;
    try {
      session = await UserSession.findOne({ sessionId }).lean();
    } catch (dbErr) {
      console.warn('[SESSION_SERVICE_WARN] UserSession query error:', dbErr.message);
      // Transient database error or connection reconnect: DO NOT revoke the session!
      // Fail open for cryptographically verified JWT tokens during transient DB hiccups.
      return true;
    }

    if (session) {
      if (session.revoked) {
        revokedSessionsCache.add(sessionId);
        trimCache(revokedSessionsCache);
        return false;
      }

      if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
        return false;
      }

      activeSessionsCache.set(sessionId, { 
        email: session.email, 
        refreshTokenHash: session.refreshTokenHash,
        expiresAt: new Date(session.expiresAt) 
      });
      trimCache(activeSessionsCache);
      return true;
    }

    // Document was not found in DB.
    // If the token is cryptographically verified by JWT_SECRET and not in revokedSessionsCache,
    // self-heal: lazily persist a session document so future queries find it.
    if (email) {
      const expiresAt = new Date(Date.now() + DEFAULT_SESSION_DURATION_HOURS * 3600 * 1000);
      const newSession = new UserSession({
        sessionId,
        email: email.toLowerCase().trim(),
        deviceSummary: 'Web Browser',
        ipAddress: '127.0.0.1',
        userAgent: '',
        lastActive: new Date(),
        expiresAt,
        revoked: false
      });
      newSession.save().catch(err => {
        console.warn('[SESSION_SERVICE_WARN] Self-heal session save skipped:', err.message);
      });
      activeSessionsCache.set(sessionId, { email: email.toLowerCase().trim(), expiresAt });
      trimCache(activeSessionsCache);
      return true;
    }

    return false;
  }

  return true;
}

/**
 * Touch session to update lastActive timestamp and extend expiration (throttled to once every 5 minutes)
 */
const lastTouchMap = new Map();
function touchSession(sessionId) {
  if (!sessionId) return;
  const now = Date.now();
  const lastTouch = lastTouchMap.get(sessionId) || 0;
  if (now - lastTouch > 5 * 60 * 1000) {
    lastTouchMap.set(sessionId, now);
    trimCache(lastTouchMap);
    const newExpiresAt = new Date(now + DEFAULT_SESSION_DURATION_HOURS * 3600 * 1000);
    const cached = activeSessionsCache.get(sessionId);
    if (cached) {
      cached.expiresAt = newExpiresAt;
    }
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      // Extend expiration by 30 days on active interaction
      UserSession.updateOne(
        { sessionId },
        { $set: { lastActive: new Date(), expiresAt: newExpiresAt } }
      ).catch(() => {});
    }
  }
}

/**
 * Revoke an individual session
 */
async function revokeSession(sessionId, email = null, reason = 'User requested logout') {
  if (!sessionId) return;
  revokedSessionsCache.add(sessionId);
  trimCache(revokedSessionsCache);
  activeSessionsCache.delete(sessionId);

  const filter = { sessionId };
  if (email) filter.email = email.toLowerCase().trim();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return UserSession.updateOne(
      filter,
      { $set: { revoked: true, revokedAt: new Date(), revokedReason: reason } }
    ).catch(() => {});
  }
}

/**
 * Revoke all other sessions for a user except the current one
 */
async function revokeOtherSessions(email, currentSessionId) {
  const query = {
    email: email.toLowerCase().trim(),
    revoked: false
  };
  if (currentSessionId) {
    query.sessionId = { $ne: currentSessionId };
  }

  for (const [sId, meta] of activeSessionsCache.entries()) {
    if (meta.email === email.toLowerCase().trim() && sId !== currentSessionId) {
      revokedSessionsCache.add(sId);
      activeSessionsCache.delete(sId);
    }
  }
  trimCache(revokedSessionsCache);

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const sessionsToRevoke = await UserSession.find(query, { sessionId: 1 }).lean().catch(() => []);
    for (const s of (sessionsToRevoke || [])) {
      revokedSessionsCache.add(s.sessionId);
      activeSessionsCache.delete(s.sessionId);
    }
    trimCache(revokedSessionsCache);

    return UserSession.updateMany(
      query,
      { $set: { revoked: true, revokedAt: new Date(), revokedReason: 'Revoked all other sessions' } }
    ).catch(() => ({ modifiedCount: 0 }));
  }

  return { modifiedCount: 1 };
}

/**
 * List active sessions for a user
 */
async function listUserSessions(email, currentSessionId = '') {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const sessions = await UserSession.find({
      email: email.toLowerCase().trim(),
      revoked: false,
      expiresAt: { $gt: new Date() }
    })
      .sort({ lastActive: -1 })
      .lean()
      .catch(() => []);

    if (sessions && sessions.length > 0) {
      return sessions.map(s => ({
        sessionId: s.sessionId,
        deviceSummary: s.deviceSummary,
        ipAddress: s.ipAddress,
        lastActive: s.lastActive,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s.sessionId === currentSessionId
      }));
    }
  }

  // Fallback to active sessions cache
  const result = [];
  for (const [sId, meta] of activeSessionsCache.entries()) {
    if (meta.email === email.toLowerCase().trim() && !revokedSessionsCache.has(sId)) {
      result.push({
        sessionId: sId,
        deviceSummary: 'Current Web Session',
        ipAddress: '127.0.0.1',
        lastActive: new Date(),
        createdAt: new Date(),
        expiresAt: meta.expiresAt,
        isCurrent: sId === currentSessionId
      });
    }
  }
  return result;
}

module.exports = {
  createSession,
  refreshSession,
  isSessionActive,
  touchSession,
  revokeSession,
  revokeOtherSessions,
  listUserSessions,
  parseDeviceSummary,
  DEFAULT_SESSION_DURATION_HOURS,
  MAX_CACHE_ENTRIES,
  _trimCache: trimCache
};
