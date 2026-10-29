const mongoose = require('mongoose');

/**
 * Module D: Privacy-Aware Digital Wellbeing
 * Differential-privacy protected study habits, focus session telemetry,
 * user-defined categorization rules, synthetic demo events, and mindful nudges.
 */

// 1. Focus Session Schema
const FocusSessionSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
  anonymousHash: { type: String, required: true, index: true }, // Irreversible salted hash for differential privacy
  title: { type: String, default: 'Deep Focus Session', trim: true },
  branchTrack: { type: String, enum: ['CSE', 'CE', 'EXTC', 'Other'], default: 'CSE' },
  targetDurationMinutes: { type: Number, default: 25, min: 1, max: 480 },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned'],
    default: 'active',
    index: true
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  accumulatedActiveSeconds: { type: Number, default: 0, min: 0 },
  lastResumedAt: { type: Date, default: Date.now },
  totalPausedSeconds: { type: Number, default: 0, min: 0 },
  lastPausedAt: { type: Date, default: null },
  sessionCategory: {
    type: String,
    enum: ['coding', 'revision', 'exam_prep', 'reading', 'deep_work', 'other'],
    default: 'coding'
  },
  breakMinutes: { type: Number, default: 5 },
  focusQualityScore: { type: Number, min: 1, max: 10, default: 8 },
  contextSwitchCount: { type: Number, default: 0, min: 0 },
  distractingDurationSeconds: { type: Number, default: 0, min: 0 },
  eventCount: { type: Number, default: 0, min: 0 },
  reflectionNotes: { type: String, default: '', trim: true, maxlength: 1000 },
  isSimulated: { type: Boolean, default: false },
  completedAt: { type: Date, default: null, index: true }
}, {
  timestamps: true
});

// Compound index for fast user session querying
FocusSessionSchema.index({ userEmail: 1, status: 1, createdAt: -1 });

// 2. User-Defined Categorization Rule Schema
const CategorizationRuleSchema = new mongoose.Schema({
  userEmail: { type: String, default: null, index: true, lowercase: true, trim: true }, // null indicates system default
  ruleName: { type: String, required: true, trim: true, maxlength: 80 },
  pattern: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
  matchType: {
    type: String,
    enum: ['domain_suffix', 'exact_host', 'contains'],
    default: 'domain_suffix'
  },
  category: {
    type: String,
    enum: ['productive', 'learning', 'distracting', 'neutral', 'uncategorized'],
    default: 'productive',
    index: true
  },
  priority: { type: Number, default: 10, min: 1, max: 100 },
  isEnabled: { type: Boolean, default: true, index: true }
}, {
  timestamps: true
});

CategorizationRuleSchema.index({ userEmail: 1, isEnabled: 1, priority: -1 });

// 3. Activity Event Schema (Purely user-initiated or synthetic demo telemetry)
const ActivityEventSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FocusSession', index: true, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
  domain: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
  category: {
    type: String,
    enum: ['productive', 'learning', 'distracting', 'neutral', 'uncategorized'],
    default: 'uncategorized',
    index: true
  },
  durationSeconds: { type: Number, default: 60, min: 1, max: 7200 },
  ruleId: { type: mongoose.Schema.Types.ObjectId, ref: 'CategorizationRule', default: null },
  source: {
    type: String,
    enum: ['synthetic_demo', 'manual_entry'],
    default: 'synthetic_demo',
    index: true
  },
  label: { type: String, default: '', trim: true, maxlength: 120 },
  isDistracting: { type: Boolean, default: false }
}, {
  timestamps: true
});

ActivityEventSchema.index({ userEmail: 1, sessionId: 1, timestamp: -1 });

// 4. Mindful Nudge Rule Schema
const NudgeRuleSchema = new mongoose.Schema({
  ruleName: { type: String, required: true },
  thresholdStudyMinutes: { type: Number, default: 90 },
  recommendedBreakMinutes: { type: Number, default: 15 },
  nudgeMessage: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

const FocusSession = mongoose.models.FocusSession || mongoose.model('FocusSession', FocusSessionSchema);
const CategorizationRule = mongoose.models.CategorizationRule || mongoose.model('CategorizationRule', CategorizationRuleSchema);
const ActivityEvent = mongoose.models.ActivityEvent || mongoose.model('ActivityEvent', ActivityEventSchema);
const NudgeRule = mongoose.models.NudgeRule || mongoose.model('NudgeRule', NudgeRuleSchema);

module.exports = {
  FocusSession,
  CategorizationRule,
  ActivityEvent,
  NudgeRule
};
