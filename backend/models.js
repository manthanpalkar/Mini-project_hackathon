const mongoose = require('mongoose');

// User Schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true, index: true },
  status: { type: String, default: 'Active', index: true },
  password: { type: String, default: 'spit123' },
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
  type: String
}, { _id: false });

// Study Material Subschema
const StudyMaterialSchema = new mongoose.Schema({
  title: String,
  type: String,
  fileName: String,
  fileSize: String,
  url: String
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
  url: String
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
  photo: String,
  journey: JourneySchema,
  resources: [ResourceRefSchema],
  resume: String,
  resumeFile: ResumeFileSchema,
  studyMaterials: [StudyMaterialSchema],
  customSections: [CustomSectionSchema],
  uploadedByEmail: String
}, { timestamps: true });

StorySchema.index({ createdAt: -1 });
StorySchema.index({ createdAt: -1, _id: -1 });

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
  semester: { type: String, default: '' },
  year: { type: String, default: '' },
  tags: [String]
}, { timestamps: true });

ResourceSchema.index({ folderId: 1, status: 1 });
ResourceSchema.index({ folderId: 1, status: 1, createdAt: -1 });
ResourceSchema.index({ folderId: 1, status: 1, type: 1, createdAt: -1 });
ResourceSchema.index({ uploadedByEmail: 1 });
ResourceSchema.index({ ownerId: 1 });
ResourceSchema.index({ createdAt: -1 });

// Pending Study Resource Schema
const PendingResourceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
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

PendingResourceSchema.index({ createdAt: -1 });

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
  isFinalized: { type: Boolean, default: false, index: true },
  finalResourceId: { type: String, default: null },
  finalGridFsId: { type: mongoose.Schema.Types.ObjectId, default: null },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), index: { expires: 0 } }
}, { timestamps: true });

module.exports = {
  User: mongoose.model('User', UserSchema),
  Story: mongoose.model('Story', StorySchema),
  PendingStory: mongoose.model('PendingStory', PendingStorySchema),
  Resource: mongoose.model('Resource', ResourceSchema),
  PendingResource: mongoose.model('PendingResource', PendingResourceSchema),
  Achievement: mongoose.model('Achievement', AchievementSchema),
  Folder: mongoose.model('Folder', FolderSchema),
  UploadSession: mongoose.model('UploadSession', UploadSessionSchema)
};
