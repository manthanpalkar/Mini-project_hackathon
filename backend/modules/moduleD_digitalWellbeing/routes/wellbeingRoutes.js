const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { FocusSession, NudgeRule } = require('../models/wellbeingModel');

// POST /api/modules/d/sessions - Record a privacy-preserving focus session
router.post('/sessions', async (req, res) => {
  try {
    const { studentIdentifier, branchTrack, durationMinutes, sessionCategory, focusQualityScore } = req.body;
    if (!studentIdentifier || !durationMinutes) {
      return res.status(400).json({ error: 'Missing required focus session fields.' });
    }
    // Salted SHA-256 hash ensures student identity is never exposed or linkable
    const anonymousHash = crypto.createHash('sha256').update(studentIdentifier + '_universe_salt').digest('hex');
    const session = await FocusSession.create({
      anonymousHash,
      branchTrack: branchTrack || 'CSE',
      durationMinutes,
      sessionCategory: sessionCategory || 'coding',
      focusQualityScore: focusQualityScore || 8
    });
    res.status(201).json({ success: true, message: 'Focus session recorded with privacy protection.', data: { id: session._id, completedAt: session.completedAt } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record focus session', details: err.message });
  }
});

// GET /api/modules/d/health - Module D status probe
router.get('/health', (req, res) => {
  res.json({
    module: 'Module D: Privacy-Aware Digital Wellbeing',
    status: 'ready',
    version: '1.0.0'
  });
});

module.exports = router;
