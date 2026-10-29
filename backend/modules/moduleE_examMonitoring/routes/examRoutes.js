const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const mongoose = require('mongoose');
const { MonitoringSession, DetectionIncident } = require('../models/examSessionModel');

const PYTHON_VISION_URL = process.env.VISION_SERVICE_URL || 'http://127.0.0.1:5005';
const SAMPLES_DIR = path.join(__dirname, '../sample_videos');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage for uploaded exam footage (max 100MB)
const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `exam_${Date.now()}_${sanitized}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.originalname.match(/\.(mp4|mov|avi|webm|mkv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files (.mp4, .mov, .avi, .webm) are allowed for exam surveillance.'));
    }
  }
});

/**
 * Helper to ping or call Python Vision Service with configurable timeout
 */
async function callVisionService(endpoint, payload, timeoutMs = 120000) {
  const url = `${PYTHON_VISION_URL}${endpoint}`;
  const options = {
    method: payload ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  };
  if (payload) {
    options.body = JSON.stringify(payload);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Vision service HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }
  return res.json();
}

/**
 * Deterministic fallback synthesis when Python service is starting or unavailable
 */
function generateDeterministicAnalysis(videoName, durationSec = 24.0) {
  const fps = 15.0;
  const totalFrames = Math.floor(durationSec * fps);
  const frames = [];
  const incidents = [];

  const baseTracks = [
    { trackId: 1, baseBbox: [0.52, 0.22, 0.88, 0.82], yawProfile: (t) => 0.05 * Math.sin(t) },
    { trackId: 2, baseBbox: [0.30, 0.14, 0.58, 0.62], yawProfile: (t) => t > 4.0 && t < 9.0 ? 0.38 * Math.sin(t * 3.5) : -0.15 },
    { trackId: 3, baseBbox: [0.12, 0.10, 0.32, 0.50], yawProfile: (t) => -0.18 + 0.04 * Math.cos(t) },
    { trackId: 4, baseBbox: [0.65, 0.12, 0.88, 0.54], yawProfile: (t) => t > 6.0 && t < 12.0 ? 0.42 * Math.sin(t * 2.8) : 0.05 },
    { trackId: 5, baseBbox: [0.38, 0.08, 0.52, 0.42], yawProfile: (t) => 0.02 * Math.sin(t * 0.5) }
  ];

  let incCount = 1;
  let lastIncTime = {};

  for (let f = 1; f <= totalFrames; f += 2) {
    const tSec = f / fps;
    const overlayTracks = [];

    for (const b of baseTracks) {
      const yaw = b.yawProfile(tSec);
      let isReview = false;
      let label = `NORMAL — Track #${b.trackId}`;

      // Trigger observable events at characteristic intervals
      if (b.trackId === 2 && tSec >= 4.5 && tSec <= 9.0) {
        isReview = true;
        label = `REVIEW — Track #2: Repeated head-direction changes`;
        if (!lastIncTime[2] || (tSec - lastIncTime[2]) > 6.0) {
          lastIncTime[2] = tSec;
          incidents.push({
            incidentId: `INC-${1000 + incCount++}`,
            trackingId: 2,
            eventType: 'repeated_head_turn',
            eventLabel: 'Repeated head-direction changes',
            videoTimestampSeconds: parseFloat(tSec.toFixed(2)),
            confidence: 0.89,
            boundingBox: b.baseBbox,
            reviewStatus: 'Pending Review',
            metadata: { turns_in_window: 4, relative_yaw: 0.34 }
          });
        }
      } else if (b.trackId === 4 && tSec >= 7.0 && tSec <= 11.5) {
        isReview = true;
        label = `REVIEW — Track #4: Prolonged orientation toward neighbouring seat`;
        if (!lastIncTime[4] || (tSec - lastIncTime[4]) > 6.0) {
          lastIncTime[4] = tSec;
          incidents.push({
            incidentId: `INC-${1000 + incCount++}`,
            trackingId: 4,
            eventType: 'prolonged_orientation',
            eventLabel: 'Prolonged orientation toward neighbouring seat',
            videoTimestampSeconds: parseFloat(tSec.toFixed(2)),
            confidence: 0.84,
            boundingBox: b.baseBbox,
            reviewStatus: 'Pending Review',
            metadata: { sustained_turn_ratio: 0.78 }
          });
        }
      }

      overlayTracks.push({
        trackId: b.trackId,
        bbox: b.baseBbox,
        status: isReview ? 'REVIEW' : 'NORMAL',
        label: label,
        conf: 0.92
      });
    }

    frames.push({
      frameIdx: f,
      timestampSec: parseFloat(tSec.toFixed(2)),
      tracks: overlayTracks,
      detectedPeople: overlayTracks.length,
      activeAlerts: overlayTracks.filter(t => t.status === 'REVIEW').length
    });
  }

  return {
    summary: {
      totalFrames,
      processedFrames: frames.length,
      durationSeconds: durationSec,
      fpsMeasured: 18.4,
      elapsedSeconds: 1.2,
      totalIncidents: incidents.length
    },
    incidents,
    frames
  };
}

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/modules/e/health - Module E status probe & vision service connectivity
router.get('/health', async (req, res) => {
  let visionStatus = 'offline';
  let visionCaps = [];
  let visionDevice = 'unknown';

  try {
    const vRes = await callVisionService('/health', null, 5000);
    visionStatus = vRes.status || 'ready';
    visionCaps = vRes.capabilities || [];
    visionDevice = vRes.device || 'cpu';
  } catch (_) {
    visionStatus = 'standby_simulation_active';
  }

  res.json({
    module: 'Module E: Responsible Examination Monitoring',
    status: 'ready',
    version: '2.0.0-multi-candidate-cctv',
    visionServiceStatus: visionStatus,
    visionDevice,
    visionCapabilities: visionCaps,
    ethicalGuarantees: [
      'No biometric face recognition or facial identity matching',
      'Temporary anonymous track identifiers per examination session',
      'Observations are review flags requiring human invigilator appraisal',
      'No automated penalties or accusations of misconduct'
    ]
  });
});

// GET /api/modules/e/samples - List preloaded authentic CCTV examination videos
router.get('/samples', (req, res) => {
  const samples = [
    {
      id: 'classroom_diagonal',
      name: 'Classroom CCTV (Diagonal View)',
      fileName: 'classroom_diagonal_exam.mp4',
      description: 'Wide-angle CCTV vantage point of examination hall with multiple desks and candidates.',
      url: '/api/modules/e/video/classroom_diagonal_exam.mp4',
      durationSeconds: 23.1,
      resolution: '1920x1080',
      approxCandidates: 6
    },
    {
      id: 'classroom_aisle',
      name: 'Classroom CCTV (Front Aisle View)',
      fileName: 'classroom_front_aisle.mp4',
      description: 'Front aisle surveillance stream monitoring student desk alignment and inter-seat orientation.',
      url: '/api/modules/e/video/classroom_front_aisle.mp4',
      durationSeconds: 16.4,
      resolution: '1920x1080',
      approxCandidates: 6
    }
  ];

  res.json({ success: true, count: samples.length, samples });
});

// GET /api/modules/e/video/:videoName - Video stream with HTTP 206 partial content range requests
router.get('/video/:videoName', (req, res) => {
  const videoName = req.params.videoName.replace(/[^a-zA-Z0-9._-]/g, '');
  
  let videoPath = path.join(SAMPLES_DIR, videoName);
  if (!fs.existsSync(videoPath)) {
    videoPath = path.join(UPLOADS_DIR, videoName);
  }

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// POST /api/modules/e/upload - Upload an authorized CCTV examination recording
router.post('/upload', videoUpload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const fileUrl = `/api/modules/e/video/${req.file.filename}`;
  res.json({
    success: true,
    message: 'Authorized examination footage uploaded successfully.',
    file: {
      fileName: req.file.filename,
      originalName: req.file.originalname,
      sizeBytes: req.file.size,
      url: fileUrl,
      localPath: req.file.path
    }
  });
});

// In-memory fallback stores for test environments or disconnected DB
const inMemorySessions = new Map();
const inMemoryIncidents = new Map();

function isDatabaseOperational() {
  return mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db != null;
}

// GET /api/modules/e/sessions - List monitoring sessions
router.get('/sessions', async (req, res) => {
  try {
    if (isDatabaseOperational()) {
      const sessions = await MonitoringSession.find().sort({ createdAt: -1 }).limit(30).lean();
      return res.json({ success: true, count: sessions.length, data: sessions });
    }
    const sessions = Array.from(inMemorySessions.values()).reverse();
    res.json({ success: true, count: sessions.length, data: sessions });
  } catch (err) {
    const sessions = Array.from(inMemorySessions.values()).reverse();
    res.json({ success: true, count: sessions.length, data: sessions });
  }
});

// POST /api/modules/e/sessions - Create or initialize a new monitoring session
router.post('/sessions', async (req, res) => {
  try {
    const { sessionName, roomCode, sourceType, sourceName, videoFileName, config, operatorEmail } = req.body;

    const sessionId = `SES-EXAM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const effectiveSourceName = sourceName || (sourceType === 'webcam' ? 'Live Proctor Webcam Feed' : 'Classroom CCTV (Diagonal View)');
    const effectiveFileName = videoFileName || 'classroom_diagonal_exam.mp4';
    const videoUrl = `/api/modules/e/video/${effectiveFileName}`;
    const videoPath = path.join(SAMPLES_DIR, effectiveFileName);

    const sessionObj = {
      sessionId,
      sessionName: sessionName || `Examination Surveillance ${new Date().toLocaleDateString()}`,
      roomCode: roomCode || 'EXAM-HALL-302',
      sourceType: sourceType || 'preloaded_sample',
      sourceName: effectiveSourceName,
      videoPath: fs.existsSync(videoPath) ? videoPath : null,
      videoUrl: videoUrl,
      status: 'idle',
      operatorEmail: operatorEmail || req.user?.email || 'proctor@spit.ac.in',
      config: {
        frameSkip: config?.frameSkip || 3,
        confidenceThreshold: config?.confidenceThreshold || 0.45,
        headTurnThreshold: config?.headTurnThreshold || 3,
        phoneConfidenceThreshold: config?.phoneConfidenceThreshold || 0.40,
        restrictedZone: config?.restrictedZone || {
          enabled: false,
          name: 'Invigilator Master Desk Zone',
          xMin: 0.0,
          yMin: 0.0,
          xMax: 0.25,
          yMax: 0.35
        }
      },
      metrics: {
        totalFrames: 0,
        processedFrames: 0,
        activeTracksCount: 0,
        alertTracksCount: 0,
        fpsMeasured: 0,
        latencyMs: 0,
        durationSeconds: 0
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDatabaseOperational()) {
      try {
        const session = new MonitoringSession(sessionObj);
        await session.save();
        return res.status(201).json({ success: true, session });
      } catch (dbErr) {
        // Fallback to in-memory
      }
    }

    inMemorySessions.set(sessionId, sessionObj);
    res.status(201).json({ success: true, session: sessionObj });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create monitoring session', details: err.message });
  }
});

// POST /api/modules/e/sessions/:sessionId/start - Execute Vision Analysis Pipeline
router.post('/sessions/:sessionId/start', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = null;

    if (isDatabaseOperational()) {
      try {
        session = await MonitoringSession.findOne({ sessionId });
      } catch (_) {}
    }
    if (!session) {
      session = inMemorySessions.get(sessionId);
    }
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'running';
    session.startTime = new Date();
    if (session.save) {
      await session.save().catch(() => {});
    }

    // Determine target video file path
    let targetPath = session.videoPath;
    if (!targetPath || !fs.existsSync(targetPath)) {
      targetPath = path.join(SAMPLES_DIR, 'classroom_diagonal_exam.mp4');
    }

    let analysisResult = null;
    let usedEngine = 'yolov8_python_service';

    // 1. Try calling the Python Vision Service with 3-minute timeout window
    try {
      console.log(`[Module E] Calling Python Vision Service for: ${targetPath}`);
      analysisResult = await callVisionService('/analyze_video', {
        video_path: targetPath,
        frame_skip: Math.max(2, session.config?.frameSkip || 3),
        head_turn_threshold: session.config?.headTurnThreshold || 2,
        phone_conf_threshold: session.config?.phoneConfidenceThreshold || 0.35,
        restricted_zone: session.config?.restrictedZone,
        max_frames: req.body?.max_frames || session.config?.maxFrames || 250
      }, 180000);
      usedEngine = 'yolov8_python_service';
      console.log(`[Module E] Python Vision Service finished successfully: ${analysisResult.summary?.processedFrames || 0} frames analyzed via YOLOv8.`);
    } catch (visionErr) {
      console.warn(`[Module E] Python Vision Service unavailable (${visionErr.message}). Switching to verified deterministic DEMO FALLBACK MODE.`);
      analysisResult = generateDeterministicAnalysis(path.basename(targetPath), 23.1);
      usedEngine = 'demo_fallback_mode';
    }

    // 2. Clear old incidents for this session
    if (isDatabaseOperational()) {
      await DetectionIncident.deleteMany({ sessionId }).catch(() => {});
    }
    inMemoryIncidents.delete(sessionId);

    // 3. Save new incidents
    const incidentDocs = (analysisResult.incidents || []).map(inc => ({
      incidentId: `${sessionId}-${inc.incidentId || Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      trackingId: inc.trackingId,
      eventType: inc.eventType,
      eventLabel: inc.eventLabel,
      videoTimestampSeconds: inc.videoTimestampSeconds,
      confidence: inc.confidence,
      boundingBox: inc.boundingBox,
      reviewStatus: 'Pending Review',
      evidenceSnapshot: inc.evidenceSnapshot || '',
      reviewerNotes: '',
      metadata: inc.metadata || {}
    }));

    if (isDatabaseOperational()) {
      await DetectionIncident.insertMany(incidentDocs).catch(() => {});
    }
    inMemoryIncidents.set(sessionId, incidentDocs);

    // 4. Update session metrics
    const summary = analysisResult.summary || {};
    session.status = 'running';
    session.metrics = {
      totalFrames: summary.totalFrames || 0,
      processedFrames: summary.processedFrames || 0,
      activeTracksCount: (analysisResult.frames && analysisResult.frames[0]?.detectedPeople) || 5,
      alertTracksCount: incidentDocs.length,
      fpsMeasured: summary.fpsMeasured || 18.0,
      latencyMs: summary.elapsedSeconds ? Math.round(summary.elapsedSeconds * 1000 / Math.max(1, summary.processedFrames)) : 45,
      durationSeconds: summary.durationSeconds || 23.0,
      engine: usedEngine,
      engineLabel: usedEngine === 'yolov8_python_service'
        ? 'Live YOLOv8 + Pose Vision Engine Active'
        : 'DEMO / SIMULATED FALLBACK MODE (Python Vision Service Offline)',
      isFallbackDemo: usedEngine !== 'yolov8_python_service'
    };
    if (session.save) {
      await session.save().catch(() => {});
    }

    res.json({
      success: true,
      sessionId,
      status: 'running',
      session,
      engine: usedEngine,
      engineLabel: session.metrics.engineLabel,
      isFallbackDemo: session.metrics.isFallbackDemo,
      metrics: session.metrics,
      totalIncidents: incidentDocs.length,
      incidents: incidentDocs,
      frames: analysisResult.frames || [],
      message: usedEngine === 'yolov8_python_service'
        ? 'Live YOLOv8 + Pose Computer Vision analysis completed.'
        : 'Python Vision Service was unavailable. Results generated in explicitly labelled DEMO FALLBACK MODE.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute vision analysis', details: err.message });
  }
});

// POST /api/modules/e/sessions/:sessionId/pause
router.post('/sessions/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = null;
    if (isDatabaseOperational()) {
      session = await MonitoringSession.findOneAndUpdate(
        { sessionId },
        { status: 'paused' },
        { new: true }
      ).catch(() => null);
    }
    if (!session && inMemorySessions.has(sessionId)) {
      session = inMemorySessions.get(sessionId);
      session.status = 'paused';
    }
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/modules/e/sessions/:sessionId/resume
router.post('/sessions/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = null;
    if (isDatabaseOperational()) {
      session = await MonitoringSession.findOneAndUpdate(
        { sessionId },
        { status: 'running' },
        { new: true }
      ).catch(() => null);
    }
    if (!session && inMemorySessions.has(sessionId)) {
      session = inMemorySessions.get(sessionId);
      session.status = 'running';
    }
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/modules/e/sessions/:sessionId/stop
router.post('/sessions/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let session = null;
    if (isDatabaseOperational()) {
      session = await MonitoringSession.findOneAndUpdate(
        { sessionId },
        { status: 'stopped', endTime: new Date() },
        { new: true }
      ).catch(() => null);
    }
    if (!session && inMemorySessions.has(sessionId)) {
      session = inMemorySessions.get(sessionId);
      session.status = 'stopped';
      session.endTime = new Date();
    }
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, status: session.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/modules/e/sessions/:sessionId/incidents - List incidents with filtering
router.get('/sessions/:sessionId/incidents', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, eventType } = req.query;
    let incidents = [];

    if (isDatabaseOperational()) {
      const query = { sessionId };
      if (status && status !== 'all') query.reviewStatus = status;
      if (eventType && eventType !== 'all') query.eventType = eventType;
      incidents = await DetectionIncident.find(query).sort({ videoTimestampSeconds: 1 }).lean().catch(() => []);
    }

    if (incidents.length === 0 && inMemoryIncidents.has(sessionId)) {
      incidents = inMemoryIncidents.get(sessionId) || [];
      if (status && status !== 'all') {
        incidents = incidents.filter(i => i.reviewStatus === status);
      }
      if (eventType && eventType !== 'all') {
        incidents = incidents.filter(i => i.eventType === eventType);
      }
    }

    res.json({ success: true, count: incidents.length, incidents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve incidents', details: err.message });
  }
});

// PATCH /api/modules/e/incidents/:incidentId - Invigilator review action
router.patch('/incidents/:incidentId', async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { reviewStatus, reviewerNotes } = req.body;
    const allowedStatuses = ['Pending Review', 'Reviewed', 'Dismissed', 'Resolved'];

    if (reviewStatus && !allowedStatuses.includes(reviewStatus)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    let incident = null;
    if (isDatabaseOperational()) {
      const updateFields = {};
      if (reviewStatus) {
        updateFields.reviewStatus = reviewStatus;
        updateFields.reviewedAt = new Date();
        updateFields.reviewedBy = req.user?.email || 'proctor@spit.ac.in';
      }
      if (typeof reviewerNotes === 'string') {
        updateFields.reviewerNotes = reviewerNotes;
      }
      incident = await DetectionIncident.findOneAndUpdate(
        { incidentId },
        { $set: updateFields },
        { new: true }
      ).catch(() => null);
    }

    if (!incident) {
      // Find in memory
      for (const [_, incList] of inMemoryIncidents.entries()) {
        const found = incList.find(i => i.incidentId === incidentId);
        if (found) {
          if (reviewStatus) {
            found.reviewStatus = reviewStatus;
            found.reviewedAt = new Date();
            found.reviewedBy = req.user?.email || 'proctor@spit.ac.in';
          }
          if (typeof reviewerNotes === 'string') {
            found.reviewerNotes = reviewerNotes;
          }
          incident = found;
          break;
        }
      }
    }

    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    res.json({
      success: true,
      message: `Incident ${incident.incidentId} updated to [${incident.reviewStatus}].`,
      incident
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update incident', details: err.message });
  }
});

module.exports = router;
