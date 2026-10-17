const crypto = require('crypto');
const mongoose = require('mongoose');
const { ActivityLog } = require('../models');

// Sensitive field names that must never be recorded in audit logs
const SENSITIVE_KEYS = new Set([
  'password', 'newpassword', 'confirmpassword', 'token', 'refreshtoken', 'idtoken',
  'jwt', 'secret', 'jwt_secret', 'code', 'otp', 'codehash', 'resettotoken', 'resettotokenhash',
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

module.exports = {
  logActivity,
  getAuditLogs,
  sanitizeMetadata
};
