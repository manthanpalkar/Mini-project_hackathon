const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true, index: true },
  status: { type: String, default: 'Active', index: true },
  password: { type: String, default: null },
  name: { type: String, default: '' },
  branch: { type: String, default: '', index: true },
  currentYear: { type: String, default: '' },
  onboarded: { type: Boolean, default: false },
  pendingName: { type: String, default: '' },
  pendingRole: { type: String, default: '' },
  pendingBranch: { type: String, default: '' },
  pendingCurrentYear: { type: String, default: '' },
  hasPendingEdit: { type: Boolean, default: false },
  nameColor: { type: String, default: '' },
  pendingNameColor: { type: String, default: '' },
  username: { type: String, unique: true, sparse: true, trim: true, index: true },
  googleSub: { type: String, unique: true, sparse: true, index: true },
  authProvider: { type: String, default: 'local' }
}, { timestamps: true });

UserSchema.index({ createdAt: -1 });

// Journey Subschema
const JourneySchema = new mongoose.Schema({
  firstYear: String,
  secondYear: String,
  thirdYear: String,
  fourthYear: String,
  prep: String,
  projects: String,
  howSecured: String
}, { _id: false });

// Resource Reference Subschema
const ResourceRefSchema = new mongoose.Schema({
  name: String,
  type: String,
  url: String
}, { _id: false });

// Study Material Subschema
const StudyMaterialSchema = new mongoose.Schema({
  title: String,
  type: String,
  category: String,
  fileName: String,
  fileSize: String,
  url: String,
  storageProvider: { type: String, default: 'supabase' },
  storagePath: String,
  mimeType: String,
  sizeBytes: Number,
  bucket: String
}, { _id: false });

// Custom Section Subschema
const CustomSectionSchema = new mongoose.Schema({
  title: String,
  content: String
}, { _id: false });

// Resume File Subschema
const ResumeFileSchema = new mongoose.Schema({
  fileName: String,
  fileSize: String,
  url: String,
  storageProvider: { type: String, default: 'supabase' },
  storagePath: String,
  mimeType: String,
  sizeBytes: Number,
  bucket: String
}, { _id: false });

// Story Schema
const StorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  branch: { type: String, index: true },
  subBranch: String,
  passoutYear: { type: String, index: true },
  company: { type: String, index: true },
  role: { type: String, index: true },
  semester: String,
  cgpa: String,
  package: String,
  ctc: String,
  stipend: String,
  offerType: String,
  photo: String,
  journey: JourneySchema,
  resources: [ResourceRefSchema],
  resume: String,
  resumeFile: ResumeFileSchema,
  studyMaterials: [StudyMaterialSchema],
  customSections: [CustomSectionSchema],
  uploadedByEmail: String
}, { timestamps: true });

StorySchema.index({ createdAt: -1, _id: -1 });
StorySchema.index({ company: 1, branch: 1, passoutYear: 1, createdAt: -1 });

// Pending Story Schema
const PendingStorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  activeId: String,
  requestType: String, // 'add', 'edit', 'delete'
  status: { type: String, default: 'pending', index: true },
  name: { type: String, required: true },
  branch: String,
  subBranch: String,
  passoutYear: String,
  company: String,
  role: String,
  semester: String,
  cgpa: String,
  package: String,
  ctc: String,
  stipend: String,
  offerType: String,
  photo: String,
  journey: JourneySchema,
  resources: [ResourceRefSchema],
  resume: String,
  resumeFile: ResumeFileSchema,
  studyMaterials: [StudyMaterialSchema],
  customSections: [CustomSectionSchema],
  uploadedByEmail: String
}, { timestamps: true });

PendingStorySchema.index({ createdAt: -1 });
PendingStorySchema.index({ status: 1, createdAt: -1 });
PendingStorySchema.index({ activeId: 1 });
PendingStorySchema.index({ uploadedByEmail: 1, createdAt: -1 });

// Study Resource Schema
const ResourceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  type: { type: String, default: 'PDF' },
  link: { type: String, default: '' },
  originalFileName: { type: String, default: '' },
  mimeType: { type: String, default: 'application/pdf' },
  size: { type: Number, default: 0 },
  storageProvider: { type: String, enum: ['gridfs', 'local', 'legacy', 'r2', 's3'], default: 'gridfs' },
  storageKey: { type: String, default: '' },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  url: { type: String, default: '' },
  folderId: { type: String, required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedBy: { type: String, default: 'Anonymous' },
  uploadedByEmail: { type: String, default: '' },
  date: { type: String, default: '' },
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'approved', index: true },
  uploadId: { type: String, default: null },
  semester: { type: String, default: '' },
  year: { type: String, default: '' },
  tags: [String]
}, { timestamps: true });

ResourceSchema.index({ uploadId: 1 }, { unique: true, partialFilterExpression: { uploadId: { $type: 'string' } } });
ResourceSchema.index({ folderId: 1, status: 1, createdAt: -1 });
ResourceSchema.index({ folderId: 1, status: 1, type: 1, createdAt: -1 });
ResourceSchema.index({ uploadedByEmail: 1 });
ResourceSchema.index({ ownerId: 1 });
ResourceSchema.index({ createdAt: -1 });

// Pending Study Resource Schema
const PendingResourceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  uploadId: { type: String, default: null },
  activeId: String,
  requestType: { type: String, default: 'add' }, // 'add', 'edit', 'delete'
  status: { type: String, default: 'pending', index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  type: { type: String, default: 'PDF' },
  link: { type: String, default: '' },
  originalFileName: { type: String, default: '' },
  mimeType: { type: String, default: 'application/pdf' },
  size: { type: Number, default: 0 },
  storageProvider: { type: String, enum: ['gridfs', 'local', 'legacy', 'r2', 's3'], default: 'gridfs' },
  storageKey: { type: String, default: '' },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  url: { type: String, default: '' },
  folderId: { type: String, required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedBy: { type: String, default: 'Anonymous' },
  uploadedByEmail: { type: String, default: '' },
  date: { type: String, default: '' },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  semester: { type: String, default: '' },
  year: { type: String, default: '' }
}, { timestamps: true });

PendingResourceSchema.index({ uploadId: 1 }, { unique: true, partialFilterExpression: { uploadId: { $type: 'string' } } });
PendingResourceSchema.index({ createdAt: -1 });
PendingResourceSchema.index({ status: 1, createdAt: -1 });
PendingResourceSchema.index({ activeId: 1 });

// Achievement Schema
const AchievementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: String,
  date: String,
  category: String,
  image: String,
  imageFit: { type: String, default: 'cover' },
  imagePosition: { type: String, default: 'center' }
}, { timestamps: true });

AchievementSchema.index({ createdAt: -1 });

// Folder Schema
const FolderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  ownerEmail: { type: String, default: '' },
  ownerName: { type: String, default: '' },
  folderType: { type: String, enum: ['system', 'user'], default: 'user', index: true },
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  allowContributions: { type: Boolean, default: true },
  parentId: { type: String, default: null },
  isSystemFolder: { type: Boolean, default: false, index: true }
}, { timestamps: true });

FolderSchema.index({ ownerId: 1, visibility: 1, folderType: 1 });
FolderSchema.index({ parentId: 1 });
FolderSchema.index({ parentId: 1, isSystemFolder: -1, createdAt: 1 });
FolderSchema.index({ createdAt: -1 });

// GridFS Parallel Chunk Upload Session Schema
const UploadSessionSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, unique: true, index: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  chunkSize: { type: Number, required: true },
  totalChunks: { type: Number, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, default: 'General' },
  folderId: { type: String, default: 'system-placement-material' },
  semester: { type: String, default: '' },
  year: { type: String, default: '' },
  tags: [String],
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedBy: { type: String, default: 'Anonymous' },
  uploadedByEmail: { type: String, default: '' },
  isPending: { type: Boolean, default: false },
  isFinalizing: { type: Boolean, default: false, index: true },
  isFinalized: { type: Boolean, default: false, index: true },
  finalizingAt: { type: Date, default: null },
  leaseExpiresAt: { type: Date, default: null, index: true },
  finalizeGeneration: { type: Number, default: 0, index: true },
  finalResourceId: { type: String, default: null },
  finalGridFsId: { type: mongoose.Schema.Types.ObjectId, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: 0 } }
}, { timestamps: true });

// Password Reset Challenge Schema for Secure Password Recovery
const PasswordResetChallengeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastIssuedAt: { type: Date, default: Date.now },
  resetTokenHash: { type: String, default: null, index: true },
  resetTokenExpiresAt: { type: Date, default: null },
  consumed: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['pending', 'verified', 'consumed', 'invalidated', 'locked', 'expired', 'superseded'], default: 'pending', index: true }
}, { timestamps: true });

PasswordResetChallengeSchema.index({ email: 1, status: 1 });
PasswordResetChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

// User Session Schema for Multi-Device Session Management & Persistent Logins
const UserSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  refreshTokenHash: { type: String, default: null, index: true },
  previousRefreshTokenHash: { type: String, default: null },
  previousTokenExpiresAt: { type: Date, default: null },
  deviceSummary: { type: String, default: 'Web Browser' },
  ipAddress: { type: String, default: 'Unknown' },
  userAgent: { type: String, default: '' },
  lastActive: { type: Date, default: Date.now, index: true },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false, index: true },
  revokedAt: { type: Date, default: null },
  revokedReason: { type: String, default: '' }
}, { timestamps: true });

UserSessionSchema.index({ email: 1, revoked: 1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// User Feedback & Bug Reporting Schema
const FeedbackSchema = new mongoose.Schema({
  referenceId: { type: String, required: true, unique: true, index: true },
  reporterEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  reporterName: { type: String, default: '' },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Bug or technical issue',
      'Bug / Error',
      'Bug / Technical Issue',
      'Feature request',
      'Feature Request',
      'Improvement suggestion',
      'Improvement Suggestion',
      'UI/UX or design feedback',
      'UI / Usability',
      'UI / Design Feedback',
      'Performance or loading problem',
      'Performance / Slowness',
      'Performance Issue',
      'Login or account problem',
      'Authentication / Login Issue',
      'Login / Account Issue',
      'Upload or resource problem',
      'Resource / Material Issue',
      'Resource / Upload Issue',
      'Placement Story Issue',
      'Mobile / Responsiveness',
      'Account / Profile Issue',
      'Security or privacy concern',
      'Security / Privacy Concern',
      'Positive feedback',
      'Positive Feedback',
      'Other'
    ],
    index: true
  },
  severity: {
    type: String,
    enum: ['Minor', 'Moderate', 'Major', 'Critical', 'Low', 'Medium', 'High'],
    default: 'Moderate',
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  status: {
    type: String,
    enum: ['New', 'Acknowledged', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected'],
    default: 'New',
    index: true
  },
  expectedBehavior: { type: String, default: '' },
  actualBehavior: { type: String, default: '' },
  stepsToReproduce: { type: String, default: '' },
  route: { type: String, default: '' },
  deviceDiagnostics: {
    browser: { type: String, default: '' },
    os: { type: String, default: '' },
    viewport: { type: String, default: '' },
    appVersion: { type: String, default: '2.2.0' },
    correlationId: { type: String, default: '' }
  },
  screenshotFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
  screenshotFileName: { type: String, default: '' },
  screenshotSize: { type: Number, default: 0 },
  screenshotMime: { type: String, default: '' },
  assignedTo: { type: String, default: '' },
  adminNotes: [{
    note: String,
    authorEmail: String,
    createdAt: { type: Date, default: Date.now }
  }],
  adminResponse: { type: String, default: '' },
  statusHistory: [{
    status: String,
    changedBy: String,
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: '' }
  }]
}, { timestamps: true });

FeedbackSchema.index({ reporterEmail: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1, priority: 1, createdAt: -1 });
FeedbackSchema.index({ category: 1, createdAt: -1 });
FeedbackSchema.index({ createdAt: -1 });

// User Activity History & Security Audit Trail Schema
const ActivityLogSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  eventType: {
    type: String,
    required: true,
    enum: [
      'AUTH_LOGIN_SUCCESS',
      'AUTH_LOGIN_FAIL',
      'AUTH_LOGOUT',
      'AUTH_SESSION_REVOKED',
      'AUTH_PASSWORD_RESET_REQ',
      'AUTH_PASSWORD_RESET_SUCCESS',
      'AUTH_PASSWORD_CHANGE',
      'PROFILE_UPDATE',
      'ONBOARDING_COMPLETE',
      'CONTENT_STORY_ADD',
      'CONTENT_STORY_EDIT',
      'CONTENT_STORY_DELETE',
      'CONTENT_STORY_SUBMIT',
      'CONTENT_STORY_APPROVE',
      'CONTENT_STORY_REJECT',
      'CONTENT_RESOURCE_UPLOAD',
      'CONTENT_RESOURCE_SUBMIT',
      'CONTENT_RESOURCE_APPROVE',
      'CONTENT_RESOURCE_REJECT',
      'CONTENT_RESOURCE_DELETE',
      'CONTENT_FOLDER_CREATE',
      'FEEDBACK_SUBMIT',
      'FEEDBACK_STATUS_CHANGE',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'ADMIN_ACTION',
      'ADMIN_APPROVE_RESOURCE',
      'SECURITY_WARN'
    ],
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: ['AUTH', 'PROFILE', 'CONTENT', 'FEEDBACK', 'ADMIN', 'SECURITY', 'USER'],
    index: true
  },
  actorEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  actorRole: { type: String, default: 'Student' },
  targetUserEmail: { type: String, lowercase: true, trim: true, index: true, default: '' },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  summary: { type: String, required: true },
  outcome: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS', index: true },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

ActivityLogSchema.index({ actorEmail: 1, createdAt: -1 });
ActivityLogSchema.index({ targetUserEmail: 1, createdAt: -1 });
ActivityLogSchema.index({ category: 1, createdAt: -1 });
ActivityLogSchema.index({ eventType: 1, createdAt: -1 });
ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }); // 90-day retention

module.exports = {
  User: mongoose.model('User', UserSchema),
  Story: mongoose.model('Story', StorySchema),
  PendingStory: mongoose.model('PendingStory', PendingStorySchema),
  Resource: mongoose.model('Resource', ResourceSchema),
  PendingResource: mongoose.model('PendingResource', PendingResourceSchema),
  Achievement: mongoose.model('Achievement', AchievementSchema),
  Folder: mongoose.model('Folder', FolderSchema),
  UploadSession: mongoose.model('UploadSession', UploadSessionSchema),
  PasswordResetChallenge: mongoose.model('PasswordResetChallenge', PasswordResetChallengeSchema),
  UserSession: mongoose.model('UserSession', UserSessionSchema),
  Feedback: mongoose.model('Feedback', FeedbackSchema),
  ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema)
};
