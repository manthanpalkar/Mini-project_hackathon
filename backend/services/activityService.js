const crypto = require('crypto');
const mongoose = require('mongoose');
const { ActivityLog } = require('../models');

// Sensitive field names that must never be recorded in audit logs
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'confirmpassword', 'token', 'refreshtoken', 'idtoken',
  'jwt', 'secret', 'jwt_secret', 'code', 'otp', 'codehash', 'resettoken', 'resettokenhash', 'resettotoken', 'resettotokenhash',
  'authorization', 'cookie', 'cookies', 'apikey', 'privatekey', 'key'
]);

/**
 * Recursively sanitize metadata to remove sensitive data
 */
function sanitizeMetadata(obj, depth = 0) {
  if (!obj || depth > 4) return {};
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.slice(0, 20).map(item => sanitizeMetadata(item, depth + 1));
  }

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      clean[key] = '[REDACTED]';
    } else if (val && typeof val === 'object') {
      clean[key] = sanitizeMetadata(val, depth + 1);
    } else if (typeof val === 'string' && val.length > 500) {
      clean[key] = val.slice(0, 500) + '...[TRUNCATED]';
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Record a structured activity or security audit event
 */
async function logActivity({
  eventType,
  category = 'AUTH',
  actorEmail = 'anonymous',
  actorRole = 'Student',
  targetUserEmail = '',
  targetType = '',
  targetId = '',
  summary = '',
  outcome = 'SUCCESS',
  ipAddress = '127.0.0.1',
  userAgent = '',
  metadata = {}
}) {
  try {
    const eventId = `EVT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const cleanMeta = sanitizeMetadata(metadata);

    const logEntry = new ActivityLog({
      eventId,
      eventType,
      category,
      actorEmail: (actorEmail || 'anonymous').toLowerCase().trim(),
      actorRole: actorRole || 'Student',
      targetUserEmail: (targetUserEmail || '').toLowerCase().trim(),
      targetType: targetType || '',
      targetId: targetId ? String(targetId) : '',
      summary: summary || `${eventType} - ${outcome}`,
      outcome: outcome || 'SUCCESS',
      ipAddress: (ipAddress || '127.0.0.1').replace('::ffff:', ''),
      userAgent: (userAgent || '').slice(0, 255),
      metadata: cleanMeta
    });

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await logEntry.save().catch(err => {
        console.warn('[ACTIVITY_LOG_WARN] Failed to save activity event:', err.message);
      });
    }
    return logEntry;
  } catch (err) {
    // Audit logging failure must never crash the main application process
    console.error('[ACTIVITY_LOG_ERROR] Failed to record activity event:', err.message);
    return null;
  }
}

/**
 * Retrieve paginated audit events with filters
 */
async function getAuditLogs({
  page = 1,
  limit = 25,
  category = '',
  eventType = '',
  actorEmail = '',
  outcome = '',
  search = '',
  startDate = null,
  endDate = null
}) {
  const query = {};

  if (category) query.category = category;
  if (eventType) query.eventType = eventType;
  if (outcome) query.outcome = outcome;
  if (actorEmail) query.actorEmail = actorEmail.toLowerCase().trim();

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  if (search && typeof search === 'string') {
    const safeRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { actorEmail: safeRegex },
      { summary: safeRegex },
      { eventId: safeRegex },
      { targetType: safeRegex }
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 25));
  const skip = (safePage - 1) * safeLimit;

  const [total, events] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean()
  ]);

  return {
    events,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit) || 1
    }
  };
}

/**
 * Retrieve dedicated paginated audit events for a specific user
 * (Both actions performed BY user and actions performed ON user by admin)
 */
async function getUserActivity({
  userEmail = '',
  userId = '',
  page = 1,
  limit = 20,
  category = '',
  search = ''
}) {
  const safeEmail = (userEmail || '').toLowerCase().trim();
  const safeId = userId ? String(userId).trim() : '';

  if (!safeEmail && !safeId) {
    return { events: [], pagination: { total: 0, page: 1, limit: 20, pages: 1 } };
  }

  const userConditions = [];
  if (safeEmail) {
    userConditions.push({ actorEmail: safeEmail });
    userConditions.push({ targetUserEmail: safeEmail });
  }
  if (safeId) {
    userConditions.push({ targetId: safeId });
  }

  const query = { $or: userConditions };

  if (category && category !== 'All' && category !== 'ALL') {
    query.category = category.toUpperCase();
  }

  if (search && typeof search === 'string' && search.trim()) {
    const safeRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [
      {
        $or: [
          { summary: safeRegex },
          { eventType: safeRegex },
          { targetType: safeRegex },
          { outcome: safeRegex },
          { actorEmail: safeRegex },
          { targetUserEmail: safeRegex }
        ]
      }
    ];
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [total, rawEvents] = await Promise.all([
    ActivityLog.countDocuments(query),
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean()
  ]);

  const events = rawEvents.map(evt => {
    const isActor = safeEmail && evt.actorEmail === safeEmail;
    return {
      ...evt,
      actionDirection: isActor ? 'BY_USER' : 'ON_USER_BY_ADMIN'
    };
  });

  return {
    events,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit) || 1
    }
  };
}

/**
 * Retrieve comprehensive activity intelligence summary counts for a specific user
 */
async function getUserActivitySummary({ userEmail = '', userId = '' }) {
  const safeEmail = (userEmail || '').toLowerCase().trim();
  const safeId = userId ? String(userId).trim() : '';

  const userConditions = [];
  if (safeEmail) {
    userConditions.push({ actorEmail: safeEmail });
    userConditions.push({ targetUserEmail: safeEmail });
  }
  if (safeId) {
    userConditions.push({ targetId: safeId });
  }

  const baseQuery = userConditions.length ? { $or: userConditions } : {};

  const [
    totalEvents,
    successfulLogins,
    failedLogins,
    resourceUploads,
    resourceDeletions,
    profileUpdates,
    storySubmissions,
    passwordEvents,
    adminInterventions,
    mostRecentLog
  ] = await Promise.all([
    ActivityLog.countDocuments(baseQuery),
    safeEmail ? ActivityLog.countDocuments({ actorEmail: safeEmail, eventType: 'AUTH_LOGIN_SUCCESS' }) : 0,
    safeEmail ? ActivityLog.countDocuments({ actorEmail: safeEmail, eventType: 'AUTH_LOGIN_FAIL' }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      $or: [
        { actorEmail: safeEmail, eventType: { $in: ['CONTENT_RESOURCE_UPLOAD', 'CONTENT_RESOURCE_SUBMIT'] } },
        { targetUserEmail: safeEmail, eventType: 'CONTENT_RESOURCE_APPROVE' }
      ]
    }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      actorEmail: safeEmail,
      eventType: 'CONTENT_RESOURCE_DELETE'
    }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      $or: [
        { actorEmail: safeEmail, eventType: 'PROFILE_UPDATE' },
        { targetUserEmail: safeEmail, eventType: 'PROFILE_UPDATE' }
      ]
    }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      $or: [
        { actorEmail: safeEmail, eventType: { $in: ['CONTENT_STORY_ADD', 'CONTENT_STORY_SUBMIT'] } },
        { targetUserEmail: safeEmail, eventType: 'CONTENT_STORY_APPROVE' }
      ]
    }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      $or: [
        { actorEmail: safeEmail, eventType: { $in: ['AUTH_PASSWORD_RESET_REQ', 'AUTH_PASSWORD_RESET_SUCCESS', 'AUTH_PASSWORD_CHANGE'] } },
        { targetUserEmail: safeEmail, eventType: { $in: ['AUTH_PASSWORD_RESET_REQ', 'AUTH_PASSWORD_RESET_SUCCESS', 'AUTH_PASSWORD_CHANGE'] } }
      ]
    }) : 0,
    safeEmail ? ActivityLog.countDocuments({
      targetUserEmail: safeEmail,
      actorEmail: { $ne: safeEmail }
    }) : 0,
    ActivityLog.findOne(baseQuery).sort({ createdAt: -1 }).select('createdAt eventType summary').lean()
  ]);

  return {
    totalEvents,
    successfulLogins,
    failedLogins,
    resourceUploads,
    resourceDeletions,
    profileUpdates,
    storySubmissions,
    passwordEvents,
    adminInterventions,
    recentActivityAt: mostRecentLog ? mostRecentLog.createdAt : null,
    recentEventSummary: mostRecentLog ? mostRecentLog.summary : null,
    hasActivityLogs: totalEvents > 0,
    isHistoricalDataAvailable: true
  };
}

module.exports = {
  logActivity,
  getAuditLogs,
  getUserActivity,
  getUserActivitySummary,
  sanitizeMetadata
};
