const mongoose = require('mongoose');

/**
 * ============================================================================
 * UniVerse — Module E: Responsible Examination Monitoring
 * Database Schema Definitions (MonitoringSession & DetectionIncident)
 * 
 * Ethical, Privacy-Aware, Human-in-the-Loop Proctoring Architecture
 * - Zero biometric face templates or face recognition
 * - Anonymous temporary tracking identifiers (Track #ID)
 * - Explicit distinction between model observations and human review verdicts
 * ============================================================================
 */

const MonitoringSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  sessionName: { type: String, required: true },
  roomCode: { type: String, default: 'EXAM-HALL-302', index: true },
  sourceType: {
    type: String,
    enum: ['preloaded_sample', 'uploaded_video', 'webcam', 'rtsp_stream'],
    default: 'preloaded_sample'
  },
  sourceName: { type: String, default: 'Classroom CCTV (Diagonal View)' },
  videoPath: { type: String, default: null },
  videoUrl: { type: String, default: null },
  status: {
    type: String,
    enum: ['idle', 'running', 'paused', 'completed', 'stopped'],
    default: 'idle',
    index: true
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  operatorEmail: { type: String, default: 'proctor@spit.ac.in', index: true },
  config: {
    frameSkip: { type: Number, default: 3, min: 1, max: 10 },
    confidenceThreshold: { type: Number, default: 0.45, min: 0.1, max: 1.0 },
    headTurnThreshold: { type: Number, default: 3, min: 1, max: 10 },
    phoneConfidenceThreshold: { type: Number, default: 0.40, min: 0.1, max: 1.0 },
    restrictedZone: {
      enabled: { type: Boolean, default: false },
      name: { type: String, default: 'Invigilator Master Desk Zone' },
      xMin: { type: Number, default: 0.0 },
      yMin: { type: Number, default: 0.0 },
      xMax: { type: Number, default: 0.25 },
      yMax: { type: Number, default: 0.35 }
    }
  },
  metrics: {
    totalFrames: { type: Number, default: 0 },
    processedFrames: { type: Number, default: 0 },
    activeTracksCount: { type: Number, default: 0 },
    alertTracksCount: { type: Number, default: 0 },
    fpsMeasured: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 }
  }
}, { timestamps: true });

const DetectionIncidentSchema = new mongoose.Schema({
  incidentId: { type: String, required: true, unique: true, index: true },
  sessionId: { type: String, required: true, index: true },
  trackingId: { type: Number, required: true, index: true },
  eventType: {
    type: String,
    enum: ['repeated_head_turn', 'phone_detected', 'restricted_zone_entry', 'prolonged_orientation'],
    required: true,
    index: true
  },
  eventLabel: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  videoTimestampSeconds: { type: Number, default: 0 },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  boundingBox: {
    type: [Number], // [x1, y1, x2, y2] normalized to 0.0 - 1.0
    default: [0, 0, 0, 0]
  },
  reviewStatus: {
    type: String,
    enum: ['Pending Review', 'Reviewed', 'Dismissed', 'Resolved'],
    default: 'Pending Review',
    index: true
  },
  evidenceSnapshot: { type: String, default: '' }, // Data URI or URL
  reviewerNotes: { type: String, default: '' },
  reviewedBy: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

DetectionIncidentSchema.index({ sessionId: 1, reviewStatus: 1 });
DetectionIncidentSchema.index({ sessionId: 1, trackingId: 1 });

const MonitoringSession = mongoose.models.MonitoringSession || mongoose.model('MonitoringSession', MonitoringSessionSchema);
const DetectionIncident = mongoose.models.DetectionIncident || mongoose.model('DetectionIncident', DetectionIncidentSchema);

module.exports = {
  MonitoringSession,
  DetectionIncident
};
