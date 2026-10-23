const crypto = require('crypto');
const mongoose = require('mongoose');
const { UserSession } = require('../models');

// In-memory revoked session cache for high-speed authentication verification
const revokedSessionsCache = new Set();
const activeSessionsCache = new Map(); // sessionId -> { email, expiresAt }

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
 * Create a new user session upon successful login
 */
async function createSession({ email, userAgent = '', ipAddress = '127.0.0.1', durationHours = 24 * 7 }) {
  const sessionId = `SES-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const deviceSummary = parseDeviceSummary(userAgent);
  const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

  const session = new UserSession({
    sessionId,
    email: email.toLowerCase().trim(),
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
  activeSessionsCache.set(sessionId, { email: email.toLowerCase().trim(), expiresAt });

  return {
    sessionId,
    deviceSummary,
    expiresAt
  };
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
      session = await UserSession.findOne({ sessionId, revoked: false }).lean();
    } catch (dbErr) {
      console.warn('[SESSION_SERVICE_WARN] UserSession query error:', dbErr.message);
      // Transient database error or connection reconnect: DO NOT revoke the session!
      // Fail open for cryptographically verified JWT tokens during transient DB hiccups.
      return true;
    }

    if (!session) {
      // Document genuinely does not exist in DB or was explicitly revoked
      revokedSessionsCache.add(sessionId);
      return false;
    }

    if (session.expiresAt && Date.now() > new Date(session.expiresAt).getTime()) {
      return false;
    }

    activeSessionsCache.set(sessionId, { email: session.email, expiresAt: new Date(session.expiresAt) });
  }

  return true;
}

/**
 * Touch session to update lastActive timestamp (throttled to once every 5 minutes)
 */
const lastTouchMap = new Map();
function touchSession(sessionId) {
  if (!sessionId) return;
  const now = Date.now();
  const lastTouch = lastTouchMap.get(sessionId) || 0;
  if (now - lastTouch > 5 * 60 * 1000) {
    lastTouchMap.set(sessionId, now);
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      UserSession.updateOne({ sessionId }, { $set: { lastActive: new Date() } }).catch(() => {});
    }
  }
}

/**
 * Revoke an individual session
 */
async function revokeSession(sessionId, email = null, reason = 'User requested logout') {
  if (!sessionId) return;
  revokedSessionsCache.add(sessionId);
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

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const sessionsToRevoke = await UserSession.find(query, { sessionId: 1 }).lean().catch(() => []);
    for (const s of (sessionsToRevoke || [])) {
      revokedSessionsCache.add(s.sessionId);
      activeSessionsCache.delete(s.sessionId);
    }

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
  isSessionActive,
  touchSession,
  revokeSession,
  revokeOtherSessions,
  listUserSessions,
  parseDeviceSummary
};
