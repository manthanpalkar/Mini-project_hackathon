const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { FocusSession, CategorizationRule, ActivityEvent, NudgeRule } = require('../models/wellbeingModel');
const { authenticateToken: requireAuth, optionalAuthenticateToken: optionalAuth } = require('../../../middlewares/authMiddleware');

const {
  startSession,
  pauseSession,
  resumeSession,
  stopSession,
  getActiveSession,
  discardSession,
  createAnonymousHash
} = require('../services/wellbeingSessionService');

const {
  SYSTEM_DEFAULT_RULES,
  normalizeDomain,
  classifyDomain
} = require('../services/wellbeingClassificationService');

const { generateSyntheticScenario } = require('../services/wellbeingSyntheticService');
const { getUserAnalytics } = require('../services/wellbeingAnalyticsService');
const { deleteUserEvent, clearUserHistory, exportUserData } = require('../services/wellbeingPrivacyService');

// ---------------------------------------------------------------------------
// 0. HEALTH CHECK (Preserves contract for universeModules.test.js)
// ---------------------------------------------------------------------------
router.get('/health', (req, res) => {
  res.json({
    module: 'Module D: Privacy-Aware Digital Wellbeing',
    status: 'ready',
    version: '1.0.0',
    capabilities: [
      'focus_session_state_machine',
      'user_categorization_rules',
      'synthetic_demo_generator',
      'differential_privacy_telemetry',
      'right_to_be_forgotten'
    ]
  });
});

// ---------------------------------------------------------------------------
// 1. FOCUS SESSION LIFECYCLE
// ---------------------------------------------------------------------------

// POST /api/modules/d/sessions/start - Start a new focus session
router.post('/sessions/start', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { title, targetDurationMinutes, sessionCategory, branchTrack, isSimulated } = req.body;

    const session = await startSession(userEmail, {
      title,
      targetDurationMinutes,
      sessionCategory,
      branchTrack: branchTrack || req.user.branch || 'CSE',
      isSimulated
    });

    res.status(201).json({
      success: true,
      message: 'Focus session initiated.',
      data: session
    });
  } catch (err) {
    const status = err.statusCode || (err.code === 'ACTIVE_SESSION_EXISTS' ? 409 : 500);
    res.status(status).json({
      error: err.message,
      code: err.code || 'SESSION_START_FAILED',
      existingSessionId: err.existingSessionId
    });
  }
});

// POST /api/modules/d/sessions/:id/pause - Pause an active focus session
router.post('/sessions/:id/pause', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const session = await pauseSession(req.params.id, userEmail);
    res.json({
      success: true,
      message: 'Focus session paused.',
      data: session
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/modules/d/sessions/:id/resume - Resume a paused focus session
router.post('/sessions/:id/resume', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const session = await resumeSession(req.params.id, userEmail);
    res.json({
      success: true,
      message: 'Focus session resumed.',
      data: session
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/modules/d/sessions/:id/stop - Stop and complete a focus session
router.post('/sessions/:id/stop', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { focusQualityScore, reflectionNotes } = req.body;
    const session = await stopSession(req.params.id, userEmail, {
      focusQualityScore,
      reflectionNotes
    });
    res.json({
      success: true,
      message: 'Focus session completed and telemetry finalized.',
      data: session
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// GET /api/modules/d/sessions/active - Retrieve current active or paused session
router.get('/sessions/active', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const active = await getActiveSession(userEmail);
    res.json({
      success: true,
      hasActiveSession: Boolean(active),
      data: active
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to inspect active session', details: err.message });
  }
});

// GET /api/modules/d/sessions - List user's sessions with pagination
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    let sessions = [];
    let total = 0;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      [sessions, total] = await Promise.all([
        FocusSession.find({ userEmail })
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit),
        FocusSession.countDocuments({ userEmail })
      ]);
    }

    res.json({
      success: true,
      total,
      limit,
      offset,
      data: sessions
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list focus sessions', details: err.message });
  }
});

// GET /api/modules/d/sessions/:id - Get session detail
router.get('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    let session = null;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      session = await FocusSession.findOne({ _id: req.params.id, userEmail });
    }

    if (!session) {
      return res.status(404).json({ error: 'Session not found or unauthorized.' });
    }

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session', details: err.message });
  }
});

// DELETE /api/modules/d/sessions/:id - Discard / abandon session
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const result = await discardSession(req.params.id, userEmail);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/modules/d/sessions - Legacy route backwards compatibility
router.post('/sessions', async (req, res) => {
  try {
    const { studentIdentifier, branchTrack, durationMinutes, sessionCategory, focusQualityScore } = req.body;
    if (!studentIdentifier || !durationMinutes) {
      return res.status(400).json({ error: 'Missing required focus session fields.' });
    }
    const anonymousHash = createAnonymousHash(studentIdentifier);
    let session = {
      _id: new mongoose.Types.ObjectId(),
      userEmail: studentIdentifier.toLowerCase().trim(),
      anonymousHash,
      branchTrack: branchTrack || 'CSE',
      durationMinutes,
      accumulatedActiveSeconds: durationMinutes * 60,
      sessionCategory: sessionCategory || 'coding',
      focusQualityScore: focusQualityScore || 8,
      status: 'completed',
      completedAt: new Date()
    };
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      session = await FocusSession.create(session);
    }
    res.status(201).json({
      success: true,
      message: 'Focus session recorded with privacy protection.',
      data: { id: session._id, completedAt: session.completedAt }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record focus session', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. USER-DEFINED CATEGORIZATION RULES
// ---------------------------------------------------------------------------

// GET /api/modules/d/rules - List active rules (user rules + system presets)
router.get('/rules', optionalAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email || null;
    let customRules = [];

    if (userEmail && mongoose.connection && mongoose.connection.readyState === 1) {
      customRules = await CategorizationRule.find({ userEmail }).sort({ priority: -1, createdAt: -1 });
    }

    res.json({
      success: true,
      customRulesCount: customRules.length,
      systemDefaultsCount: SYSTEM_DEFAULT_RULES.length,
      data: {
        customRules,
        systemDefaults: SYSTEM_DEFAULT_RULES
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve rules', details: err.message });
  }
});

// POST /api/modules/d/rules - Create a custom categorization rule
router.post('/rules', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { ruleName, pattern, matchType, category, priority } = req.body;

    if (!ruleName || !pattern || !category) {
      return res.status(400).json({ error: 'ruleName, pattern, and category are required.' });
    }

    const cleanPattern = normalizeDomain(pattern);
    if (!cleanPattern) {
      return res.status(400).json({ error: 'Pattern must specify a valid hostname or domain pattern.' });
    }

    const validCategories = ['productive', 'learning', 'distracting', 'neutral', 'uncategorized'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `Category must be one of [${validCategories.join(', ')}].` });
    }

    const ruleObj = {
      userEmail,
      ruleName: ruleName.trim(),
      pattern: cleanPattern,
      matchType: matchType || 'domain_suffix',
      category,
      priority: Math.min(100, Math.max(1, parseInt(priority, 10) || 10)),
      isEnabled: true
    };

    let created = ruleObj;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      created = await CategorizationRule.create(ruleObj);
    } else {
      created._id = new mongoose.Types.ObjectId();
    }

    res.status(201).json({
      success: true,
      message: 'Categorization rule created successfully.',
      data: created
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create categorization rule', details: err.message });
  }
});

// PATCH /api/modules/d/rules/:id/toggle - Toggle rule enabled/disabled
router.patch('/rules/:id/toggle', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    let rule = null;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      rule = await CategorizationRule.findOne({ _id: req.params.id, userEmail });
      if (!rule) {
        return res.status(404).json({ error: 'Rule not found or unauthorized.' });
      }
      rule.isEnabled = !rule.isEnabled;
      await rule.save();
    } else {
      rule = { _id: req.params.id, isEnabled: true };
    }

    res.json({
      success: true,
      message: `Rule ${rule.isEnabled ? 'enabled' : 'disabled'} successfully.`,
      data: rule
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle rule', details: err.message });
  }
});

// DELETE /api/modules/d/rules/:id - Delete a custom rule
router.delete('/rules/:id', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const deleted = await CategorizationRule.findOneAndDelete({ _id: req.params.id, userEmail });
      if (!deleted) {
        return res.status(404).json({ error: 'Rule not found or unauthorized.' });
      }
    }

    res.json({
      success: true,
      message: 'Rule deleted successfully.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rule', details: err.message });
  }
});

// POST /api/modules/d/rules/preview - Test a domain against active rules
router.post('/rules/preview', optionalAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email || null;
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'domain is required for categorization preview.' });
    }

    let userRules = [];
    if (userEmail && mongoose.connection && mongoose.connection.readyState === 1) {
      userRules = await CategorizationRule.find({ userEmail, isEnabled: true }).sort({ priority: -1 });
    }

    const classification = classifyDomain(domain, userRules, true);
    res.json({
      success: true,
      normalizedDomain: normalizeDomain(domain),
      classification
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to preview rule classification', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 3. SYNTHETIC ACTIVITY EVENT GENERATOR & EVENT LOG
// ---------------------------------------------------------------------------

// POST /api/modules/d/events/generate-synthetic - User-initiated synthetic demo generator
router.post('/events/generate-synthetic', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { sessionId, scenario, eventCount, seed } = req.body;

    const result = await generateSyntheticScenario({
      userEmail,
      sessionId,
      scenario: scenario || 'focused_study',
      eventCount: parseInt(eventCount, 10) || 8,
      seed: seed !== undefined ? seed : 42
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate synthetic scenario', details: err.message });
  }
});

// GET /api/modules/d/events - Inspect activity events
router.get('/events', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const category = req.query.category;
    const sessionId = req.query.sessionId;

    const query = { userEmail };
    if (category) query.category = category;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) query.sessionId = sessionId;

    let events = [];
    let total = 0;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      [events, total] = await Promise.all([
        ActivityEvent.find(query)
          .sort({ timestamp: -1 })
          .skip(offset)
          .limit(limit),
        ActivityEvent.countDocuments(query)
      ]);
    }

    res.json({
      success: true,
      total,
      limit,
      offset,
      data: events
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list activity events', details: err.message });
  }
});

// DELETE /api/modules/d/events/:id - Delete single activity event
router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const result = await deleteUserEvent(req.params.id, userEmail);
    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. FOCUS ANALYTICS
// ---------------------------------------------------------------------------

// GET /api/modules/d/analytics - Retrieve aggregated focus metrics & insights
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const range = req.query.range || 'all';
    const sessionId = req.query.sessionId || null;

    const analytics = await getUserAnalytics(userEmail, { range, sessionId });
    res.json({
      success: true,
      data: analytics
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute analytics', details: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. PRIVACY CENTER & DATA RIGHTS
// ---------------------------------------------------------------------------

// GET /api/modules/d/privacy/status - Overview of current tracking & data rights
router.get('/privacy/status', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const active = await getActiveSession(userEmail);

    let sessionsCount = 0;
    let eventsCount = 0;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      [sessionsCount, eventsCount] = await Promise.all([
        FocusSession.countDocuments({ userEmail }),
        ActivityEvent.countDocuments({ userEmail })
      ]);
    }

    res.json({
      success: true,
      userEmail,
      trackingStatus: active ? (active.status === 'paused' ? 'PAUSED' : 'ACTIVE') : 'IDLE',
      activeSessionId: active ? active._id : null,
      storedRecords: {
        sessionsCount,
        eventsCount
      },
      privacyGuarantees: [
        'Zero background surveillance or silent tab monitoring.',
        'Zero keystroke, credential, password, or page content collection.',
        'Data is strictly user-scoped and stored encrypted on MongoDB Atlas.',
        'Full right-to-be-forgotten deletion at any time with one click.'
      ]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve privacy status', details: err.message });
  }
});

// POST /api/modules/d/privacy/clear-history - Permanently delete all user wellbeing records
router.post('/privacy/clear-history', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const result = await clearUserHistory(userEmail);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear user history', details: err.message });
  }
});

// GET /api/modules/d/privacy/export - Export user data as JSON
router.get('/privacy/export', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const data = await exportUserData(userEmail);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=universe_wellbeing_${req.user.name || 'student'}_export.json`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export user data', details: err.message });
  }
});

module.exports = router;
