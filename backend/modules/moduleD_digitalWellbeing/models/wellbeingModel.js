const mongoose = require('mongoose');

// Module D: Privacy-Aware Digital Wellbeing
// Differential-privacy protected study habits, focus session telemetry, and mindful break nudges

const FocusSessionSchema = new mongoose.Schema({
  anonymousHash: { type: String, required: true, index: true }, // Irreversible salted hash to guarantee user privacy
  branchTrack: { type: String, enum: ['CSE', 'CE', 'EXTC', 'Other'], default: 'CSE' },
  durationMinutes: { type: Number, required: true, min: 1 },
  breakMinutes: { type: Number, default: 5 },
  focusQualityScore: { type: Number, min: 1, max: 10, default: 8 },
  sessionCategory: { type: String, enum: ['coding', 'revision', 'exam_prep', 'reading'], default: 'coding' },
  completedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

const NudgeRuleSchema = new mongoose.Schema({
  ruleName: { type: String, required: true },
  thresholdStudyMinutes: { type: Number, default: 90 },
  recommendedBreakMinutes: { type: Number, default: 15 },
  nudgeMessage: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const FocusSession = mongoose.models.FocusSession || mongoose.model('FocusSession', FocusSessionSchema);
const NudgeRule = mongoose.models.NudgeRule || mongoose.model('NudgeRule', NudgeRuleSchema);

module.exports = {
  FocusSession,
  NudgeRule
};
