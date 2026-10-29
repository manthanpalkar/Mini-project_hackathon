const express = require('express');
const router = express.Router();
const { ComputeTelemetry, GreenComputeJob } = require('../models/computingMetricModel');

// GET /api/modules/c/telemetry - Retrieve current campus lab energy telemetry
router.get('/telemetry', async (req, res) => {
  try {
    const readings = await ComputeTelemetry.find().sort({ recordedAt: -1 }).limit(100);
    res.json({ success: true, count: readings.length, data: readings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve telemetry data', details: err.message });
  }
});

// POST /api/modules/c/telemetry - Ingest node power metrics
router.post('/telemetry', async (req, res) => {
  try {
    const { labId, nodeId, cpuUtilizationPercent, powerWatts, estimatedCarbonGramsPerHour } = req.body;
    if (!labId || !nodeId || cpuUtilizationPercent === undefined || !powerWatts) {
      return res.status(400).json({ error: 'Missing required telemetry fields.' });
    }
    const entry = await ComputeTelemetry.create({
      labId,
      nodeId,
      cpuUtilizationPercent,
      powerWatts,
      estimatedCarbonGramsPerHour: estimatedCarbonGramsPerHour || (powerWatts * 0.475)
    });
    res.status(201).json({ success: true, message: 'Telemetry reading logged successfully.', data: entry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log telemetry', details: err.message });
  }
});

// GET /api/modules/c/health - Module C status probe
router.get('/health', (req, res) => {
  res.json({
    module: 'Module C: Sustainable Computing Observatory',
    status: 'ready',
    version: '1.0.0'
  });
});

module.exports = router;
