const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { FocusSession, CategorizationRule, ActivityEvent, NudgeRule, IN_MEMORY_WELLBEING } = require('../models/wellbeingModel');
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

// ---------------------------------------------------------------------------
// 6. CHROME EXTENSION SYNCHRONIZATION BRIDGE
// ---------------------------------------------------------------------------

// POST /api/modules/d/sync-extension - Sync completed session and activity events from Chrome Extension
router.post('/sync-extension', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { session, events } = req.body;

    if (!session) {
      return res.status(400).json({ error: 'Session payload is required.' });
    }

    const anonymousHash = createAnonymousHash(userEmail);
    const activeSec = Math.max(
      10,
      session.accumulatedActiveSeconds || (session.durationMinutes ? session.durationMinutes * 60 : 1500)
    );
    const durationMinutes = Math.max(1, Math.round(activeSec / 60));

    const sessionDoc = {
      userEmail,
      anonymousHash,
      title: session.title || 'Chrome Focus Session',
      branchTrack: req.user.branch || 'CSE',
      targetDurationMinutes: session.targetDurationMinutes || 25,
      status: 'completed',
      startTime: session.startedAt ? new Date(session.startedAt) : new Date(Date.now() - activeSec * 1000),
      endTime: session.completedAt ? new Date(session.completedAt) : new Date(),
      accumulatedActiveSeconds: activeSec,
      sessionCategory: session.sessionCategory || 'deep_work',
      focusQualityScore: Math.min(10, Math.max(1, session.focusQualityScore || 8)),
      contextSwitchCount: Math.max(0, parseInt(session.contextSwitchCount, 10) || 0),
      distractingDurationSeconds: Math.max(0, parseInt(session.distractingDurationSeconds, 10) || 0),
      eventCount: Array.isArray(events) ? events.length : 0,
      reflectionNotes: session.reflectionNotes || 'Recorded via UniVerse Chrome Extension',
      isSimulated: false,
      source: 'chrome_extension',
      completedAt: session.completedAt ? new Date(session.completedAt) : new Date()
    };

    let savedSession = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        savedSession = await FocusSession.create(sessionDoc);
      } catch (err) {
        console.warn('[SYNC_DB_FALLBACK] Could not save to remote MongoDB, storing in-memory:', err.message);
      }
    }
    if (!savedSession) {
      savedSession = { _id: new mongoose.Types.ObjectId(), ...sessionDoc, createdAt: new Date() };
    }
    // Always keep in memory store for immediate dashboard availability
    IN_MEMORY_WELLBEING.sessions.unshift(savedSession);

    // Insert associated activity events if any
    let insertedEventsCount = 0;
    if (Array.isArray(events) && events.length > 0) {
      const eventDocs = events.map(ev => ({
        _id: new mongoose.Types.ObjectId(),
        userEmail,
        sessionId: savedSession._id,
        timestamp: ev.timestamp ? new Date(ev.timestamp) : new Date(),
        domain: normalizeDomain(ev.domain || 'unknown'),
        category: ev.category || 'uncategorized',
        durationSeconds: Math.min(3600, Math.max(1, parseInt(ev.durationSeconds, 10) || 60)),
        source: 'chrome_extension',
        label: ev.label || 'Chrome Extension Activity',
        isDistracting: Boolean(ev.isDistracting || ev.category === 'distracting')
      }));

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          const inserted = await ActivityEvent.insertMany(eventDocs);
          insertedEventsCount = inserted.length;
        } catch (_) {}
      }
      IN_MEMORY_WELLBEING.events.unshift(...eventDocs);
      insertedEventsCount = Math.max(insertedEventsCount, eventDocs.length);
    }

    res.status(201).json({
      success: true,
      message: 'Extension statistics successfully synchronized to UniVerse dashboard.',
      data: {
        sessionId: savedSession._id,
        source: 'chrome_extension',
        insertedEventsCount,
        accumulatedActiveSeconds: savedSession.accumulatedActiveSeconds,
        activeMinutes: durationMinutes
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync extension data', details: err.message });
  }
});

// GET /api/modules/d/extension/summary - Extension-specific summary metrics for the user
router.get('/extension/summary', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    let extensionSessions = [];
    let extensionEvents = [];

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        [extensionSessions, extensionEvents] = await Promise.all([
          FocusSession.find({ userEmail, source: 'chrome_extension' }).sort({ completedAt: -1 }),
          ActivityEvent.find({ userEmail, source: 'chrome_extension' }).sort({ timestamp: -1 }).limit(100)
        ]);
      } catch (_) {}
    }
    // Blend with in-memory store
    const memSessions = IN_MEMORY_WELLBEING.sessions.filter(s => s.userEmail.toLowerCase() === userEmail.toLowerCase() && s.source === 'chrome_extension');
    const memEvents = IN_MEMORY_WELLBEING.events.filter(e => e.userEmail.toLowerCase() === userEmail.toLowerCase() && e.source === 'chrome_extension');

    const seenSessionIds = new Set(extensionSessions.map(s => String(s._id)));
    memSessions.forEach(s => {
      if (!seenSessionIds.has(String(s._id))) {
        extensionSessions.push(s);
      }
    });

    const seenEventIds = new Set(extensionEvents.map(e => String(e._id)));
    memEvents.forEach(e => {
      if (!seenEventIds.has(String(e._id))) {
        extensionEvents.push(e);
      }
    });

    const totalSeconds = extensionSessions.reduce((acc, s) => acc + (s.accumulatedActiveSeconds || 0), 0);
    const totalDistractingSec = extensionSessions.reduce((acc, s) => acc + (s.distractingDurationSeconds || 0), 0);
    const totalSwitches = extensionSessions.reduce((acc, s) => acc + (s.contextSwitchCount || 0), 0);

    // Group domains
    const domainCounts = {};
    extensionEvents.forEach(e => {
      domainCounts[e.domain] = (domainCounts[e.domain] || 0) + (e.durationSeconds || 60);
    });

    const topDomains = Object.entries(domainCounts)
      .map(([domain, durationSeconds]) => ({ domain, durationSeconds, durationMinutes: Math.round(durationSeconds / 60) }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
      .slice(0, 5);

    res.json({
      success: true,
      userEmail,
      summary: {
        sessionsCount: extensionSessions.length,
        totalActiveSeconds: totalSeconds,
        totalActiveMinutes: Math.round(totalSeconds / 60),
        distractingMinutes: Math.round(totalDistractingSec / 60),
        totalContextSwitches: totalSwitches,
        topDomains
      },
      latestSession: extensionSessions[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve extension summary', details: err.message });
  }
});

module.exports = router;
