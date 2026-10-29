const express = require('express');
const router = express.Router();
const { ExamSession } = require('../models/examSessionModel');

// GET /api/modules/e/exams - List active exam monitoring sessions
router.get('/exams', async (req, res) => {
  try {
    const sessions = await ExamSession.find().sort({ sessionStartTime: -1 }).limit(50);
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve exam sessions', details: err.message });
  }
});

// GET /api/modules/e/health - Module E status probe
router.get('/health', (req, res) => {
  res.json({
    module: 'Module E: Responsible Examination Monitoring',
    status: 'ready',
    version: '1.0.0'
  });
});

module.exports = router;
