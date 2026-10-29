const mongoose = require('mongoose');

// Module E: Responsible Examination Monitoring
// Ethical integrity verification, dispute audit trails, and student-first proctor telemetry

const ExamSessionSchema = new mongoose.Schema({
  examCode: { type: String, required: true, index: true },
  examName: { type: String, required: true },
  candidateEmail: { type: String, required: true, index: true },
  proctorEmail: { type: String, default: null },
  sessionStartTime: { type: Date, default: Date.now },
  sessionEndTime: { type: Date, default: null },
  status: { type: String, enum: ['scheduled', 'in_progress', 'submitted', 'flagged_for_review', 'verified_clean'], default: 'scheduled', index: true },
  events: [{
    eventType: { type: String, enum: ['camera_check', 'window_blur', 'network_jitter', 'reconnection', 'audio_peak'] },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    timestamp: { type: Date, default: Date.now },
    explanationProvidedByCandidate: { type: String, default: '' },
    resolvedByProctor: { type: Boolean, default: false }
  }],
  proctorNotes: { type: String, default: '' }
}, { timestamps: true });

ExamSessionSchema.index({ examCode: 1, candidateEmail: 1 });

const ExamSession = mongoose.models.ExamSession || mongoose.model('ExamSession', ExamSessionSchema);

module.exports = {
  ExamSession
};
