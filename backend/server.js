const envFile = process.env.ENV_FILE;
if (envFile) {
  require('dotenv').config({ path: envFile });
} else {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const busboy = require('busboy');
const crypto = require('crypto');
const compression = require('compression');
const { Readable } = require('stream');
const multer = require('multer');
const { User, Story, Resource, Achievement, Folder, PendingStory, PendingResource, UploadSession, PasswordResetChallenge, UserSession, Feedback, ActivityLog, SystemSetting } = require('./models');
const StorageService = require('./services/storageService');
const { ensureSystemFolders } = require('./scripts/initSystemFolders');
const { verifyGoogleToken, isSpitDomain, RESTRICTED_MESSAGE } = require('./services/googleAuth');
const { generateFullSystemHealth, recordWriteVerification } = require('./services/systemDiagnostics');
const cacheService = require('./services/cacheService');
const { sendPasswordResetEmail } = require('./services/emailService');
const sessionService = require('./services/sessionService');
const activityService = require('./services/activityService');
const BRAND = require('./config/branding');
const {
  RESUME_MAX_FILE_SIZE_BYTES,
  validateResume,
  sanitizeFilename: sanitizeStorageFilename,
  formatBytes: formatStorageBytes
} = StorageService;

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.trim().length < 32) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing or less than 32 characters.');
  process.exit(1);
}
const RESET_SECRET = process.env.RESET_SECRET || JWT_SECRET;

const RATE_LIMIT_CONFIG = {
  GLOBAL_MAX: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '1500', 10),
  LOGIN_MAX: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '10', 10),
  REGISTER_MAX: parseInt(process.env.RATE_LIMIT_REGISTER_MAX || '10', 10),
  UPLOAD_MAX: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '30', 10),
  DOWNLOAD_MAX: parseInt(process.env.RATE_LIMIT_DOWNLOAD_MAX || '60', 10),
  WINDOW_MS: 15 * 60 * 1000
};

// Define Global Rate Limiter
// Configured to 1500 requests per 15 min per IP to prevent locking out entire college labs
// or libraries sharing a single public NAT IPv4 address while still defending against unthrottled DoS floods.
const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS, 
  max: RATE_LIMIT_CONFIG.GLOBAL_MAX, 
  standardHeaders: true, 
  legacyHeaders: false, 
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { error: 'Too many requests from this IP address. Please slow down and try again after a few minutes.' }
});

// Define Login Rate Limiter (Max 10 attempts per 15 min per IP to defend against password brute force)
const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS, 
  max: RATE_LIMIT_CONFIG.LOGIN_MAX, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

// Define Registration Rate Limiter (Max 10 requests per 15 min per IP)
const registerLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration requests from this IP, please try again after 15 minutes.' }
});

// Define File Download / Streaming Rate Limiter (Max 60 requests per 15 min per IP)
const fileDownloadLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.DOWNLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => Boolean(req.headers.range), // Allow video/audio streaming range chunks without rate limit exhaustion
  message: { error: 'Too many file download requests from this IP, please try again after 15 minutes.' }
});

// Define Resource Upload Rate Limiter (Max 30 upload sessions per 15 min per IP)
const uploadLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many upload attempts from this IP, please try again after 15 minutes.' }
});

// Define Feedback Rate Limiter (Max 15 submissions per 15 min per IP)
const feedbackLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many feedback submissions from this IP, please try again after 15 minutes.' }
});

// Define OTP Verification Rate Limiter (Max 5 attempts per 15 min per IP)
const verifyOtpLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts (maximum 5 attempts). Please wait 15 minutes before trying again.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Multer memory storage for feedback screenshot attachments (max 5MB)
const feedbackUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPEG, and WebP images are permitted for screenshots.'));
    }
  }
});

// Deep file content magic bytes validator for images
function isValidImageBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  // PNG: 89 50 4E 47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // WebP: RIFF at offset 0..3 and WEBP at offset 8..11
  const isWebp = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return isPng || isJpeg || isWebp;
}

// Middlewares

// Enable CORS with restricted origin access
const DEFAULT_ALLOWED_ORIGINS = [
  'https://loop-seven-delta.vercel.app',
  'https://loop-swap15x.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

function parseConfiguredOrigins(env = process.env) {
  const singular = (env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const plural = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...singular, ...plural]));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin (mobile clients, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowed = parseConfiguredOrigins();
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  exposedHeaders: ['X-Refreshed-Token', 'Content-Disposition']
}));

// Selective HTTP Response Compression (Gzip / Deflate for JSON, skips binary file streaming)
app.use(compression({
  threshold: 1024, // Only compress payloads > 1KB
  level: 6, // Optimal balance between compression ratio and CPU usage
  memLevel: 8,
  filter: (req, res) => {
    // Skip binary files and streaming endpoints that are already compressed or chunked
    if (req.headers['x-no-compression'] || req.path.includes('/file') || req.path.includes('/storage') || req.path.includes('/chunk')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Helmet secure headers & custom Content Security Policy (CSP)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'font-src': ["'self'", "https://fonts.gstatic.com"],
      'img-src': ["'self'", "data:", "blob:", "https:"],
      'connect-src': ["'self'", "ws:", "http://localhost:5173", "http://127.0.0.1:5173", "https:"],
      'frame-src': ["'self'", "data:", "blob:", "https:"],
      'frame-ancestors': ["'self'", "https://*.vercel.app", "http://localhost:5173", "http://127.0.0.1:5173"],
      'object-src': ["'self'", "blob:", "data:"],
      'upgrade-insecure-requests': [],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false,
}));

// Custom Permissions Policy header
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), interest-cohort=()'
  );
  next();
});

// Reduce JSON body limit to 5MB to protect the single-threaded event loop against CPU-exhausting JSON.parse() attacks
// Large binary files are streamed directly via storage upload endpoints and bypass express.json
app.use(express.json({ limit: '5mb' }));

// Dedicated error-handling middleware for JSON parsing errors and oversized payloads
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({ error: 'Payload too large. Maximum allowed JSON request body size is 5MB.' });
  }
  if (err && (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  next(err);
});

// In-Memory API Performance Telemetry Tracking (Bounded, lightweight ring buffer)
const apiMetrics = {
  totalRequests: 0,
  requestsByMinute: new Map(),
  statusCounts: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  rateLimitHits: 0,
  responseTimes: [],
  endpointStats: new Map(),
  recentErrors: []
};

app.use((req, res, next) => {
  const start = process.hrtime();
  apiMetrics.totalRequests++;

  const minKey = Math.floor(Date.now() / 60000);
  apiMetrics.requestsByMinute.set(minKey, (apiMetrics.requestsByMinute.get(minKey) || 0) + 1);
  if (apiMetrics.requestsByMinute.size > 15) {
    const oldest = apiMetrics.requestsByMinute.keys().next().value;
    apiMetrics.requestsByMinute.delete(oldest);
  }

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;

    apiMetrics.responseTimes.push(durationMs);
    if (apiMetrics.responseTimes.length > 200) {
      apiMetrics.responseTimes.shift();
    }

    const code = res.statusCode;
    if (code >= 200 && code < 300) apiMetrics.statusCounts['2xx']++;
    else if (code >= 300 && code < 400) apiMetrics.statusCounts['3xx']++;
    else if (code >= 400 && code < 500) {
      apiMetrics.statusCounts['4xx']++;
      if (code === 429) apiMetrics.rateLimitHits++;
    } else if (code >= 500) {
      apiMetrics.statusCounts['5xx']++;
    }

    const rawPath = req.baseUrl || req.path || '';
    const cleanRoute = `${req.method} ${rawPath.replace(/[0-9a-fA-F]{24}/g, ':id')}`;
    let stat = apiMetrics.endpointStats.get(cleanRoute);
    if (!stat) {
      stat = { count: 0, totalTime: 0, maxTime: 0 };
      if (apiMetrics.endpointStats.size < 50) {
        apiMetrics.endpointStats.set(cleanRoute, stat);
      }
    }
    if (stat) {
      stat.count++;
      stat.totalTime += durationMs;
      if (durationMs > stat.maxTime) stat.maxTime = durationMs;
    }

    if (code >= 400 && code !== 404 && code !== 401) {
      apiMetrics.recentErrors.unshift({
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path ? req.path.slice(0, 100) : '',
        status: code,
        message: String(res.statusMessage || `HTTP ${code}`).replace(/<[^>]*>/g, '').slice(0, 150)
      });
      if (apiMetrics.recentErrors.length > 20) {
        apiMetrics.recentErrors.pop();
      }
    }
  });

  next();
});

// Apply Global Limiter to all API endpoints
app.use('/api/', globalLimiter);

// Apply strict rate limiting to login and registration routes
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register-request', registerLimiter);
app.use(['/api/auth/google', '/api/users/google', '/api/users/auth/google'], loginLimiter);
app.use([
  '/api/auth/forgot-password',
  '/api/users/forgot-password',
  '/api/auth/reset-password',
  '/api/users/reset-password'
], loginLimiter);
app.use([
  '/api/auth/verify-reset-code',
  '/api/users/verify-reset-code'
], verifyOtpLimiter);

// Apply granular rate limiting to resource downloads and file upload sessions
app.use(['/api/resources/:id/file', '/api/pending-resources/:id/file'], fileDownloadLimiter);
app.use(['/api/upload-session', '/api/resources/upload/init', '/api/pending-resources/upload/init'], uploadLimiter);

// Prevent NoSQL query injection by stripping keys starting with $ or .
app.use(mongoSanitize());

// --- Helper Functions for Security & File Uploads ---

const UPLOADS_DIR = path.join(__dirname, 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  if (err.code !== 'EACCES') {
    console.warn(`[Storage] Warning: Could not create local uploads directory: ${err.message}`);
  } else {
    console.warn(`[Storage] Warning: Permission denied creating local uploads directory (${UPLOADS_DIR}). If running in a non-root container, ensure it is pre-created.`);
  }
}
// Security Guard for Legacy /uploads/* directory
// Public assets (profile photos, achievement badges) are served statically without authentication.
// Sensitive legacy uploads (resumes, study materials, private documents) require authentication and authorization.
app.use('/uploads', async (req, res, next) => {
  const filename = path.basename(req.path);

  // Allow legitimate public assets unconditionally (photos, avatars, achievement badges with valid image extensions)
  const isImageExt = /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(filename);
  const isPublicAsset = isImageExt && (
    filename.startsWith('photo-') ||
    filename.startsWith('avatar-') ||
    filename.startsWith('achievement-') ||
    filename.startsWith('public-')
  );

  if (isPublicAsset) {
    return next();
  }

  // Sensitive legacy file (resume-*, material-*, resource-*, or arbitrary document)
  // Enforce authentication & authorization before serving
  authenticateToken(req, res, async () => {
    try {
      if (isUserAdmin(req.user)) {
        return next();
      }

      const fileUrl = `/uploads/${filename}`;
      const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filenameRegex = new RegExp(escapedFilename, 'i');
      const userEmail = (req.user?.email || '').toLowerCase().trim();

      // Check if file belongs to an approved Story (publicly accessible by authenticated users)
      const story = await Story.findOne({
        $or: [
          { 'resumeFile.url': fileUrl },
          { resume: fileUrl },
          { 'studyMaterials.url': fileUrl },
          { 'resumeFile.url': filenameRegex },
          { resume: filenameRegex },
          { 'studyMaterials.url': filenameRegex }
        ]
      }).lean();

      if (story) {
        return next();
      }

      // Check if file belongs to a PendingStory (accessible only to author or admin)
      const pendingStory = await PendingStory.findOne({
        $or: [
          { 'resumeFile.url': fileUrl },
          { resume: fileUrl },
          { 'studyMaterials.url': fileUrl },
          { 'resumeFile.url': filenameRegex },
          { resume: filenameRegex },
          { 'studyMaterials.url': filenameRegex }
        ]
      }).lean();

      if (pendingStory) {
        const isAuthor = pendingStory.uploadedByEmail &&
          (pendingStory.uploadedByEmail.toLowerCase().trim() === userEmail);
        if (!isAuthor) {
          return res.status(403).json({ error: 'Access denied to pending story file.' });
        }
        return next();
      }

      // Check if file belongs to Resource
      const resource = await Resource.findOne({
        $or: [
          { link: fileUrl },
          { url: fileUrl },
          { link: filenameRegex },
          { url: filenameRegex }
        ]
      }).lean();

      if (resource) {
        if (resource.visibility === 'private') {
          const isUploader = resource.uploadedByEmail &&
            (resource.uploadedByEmail.toLowerCase().trim() === userEmail);
          if (!isUploader) {
            return res.status(403).json({ error: 'Access denied to private file.' });
          }
        }
        return next();
      }

      // Check if file belongs to PendingResource
      const pendingResource = await PendingResource.findOne({
        $or: [
          { link: fileUrl },
          { url: fileUrl },
          { link: filenameRegex },
          { url: filenameRegex }
        ]
      }).lean();

      if (pendingResource) {
        const isUploader = pendingResource.uploadedByEmail &&
          (pendingResource.uploadedByEmail.toLowerCase().trim() === userEmail);
        if (!isUploader) {
          return res.status(403).json({ error: 'Access denied to pending resource file.' });
        }
        return next();
      }

      // Unparented or unknown sensitive file -> deny access
      return res.status(404).json({ error: 'File not found or access denied.' });
    } catch (authErr) {
      console.error('[UploadsAuth] Error:', authErr.message);
      return res.status(500).json({ error: 'Failed to authorize file access.' });
    }
  });
}, express.static(UPLOADS_DIR, {
  maxAge: '7d',
  immutable: true
}));

function saveBase64File(dataUri, prefix = 'file') {
  if (!dataUri || typeof dataUri !== 'string') return dataUri;
  if (!dataUri.startsWith('data:')) return dataUri;

  try {
    const parts = dataUri.split(',');
    if (parts.length < 2) return dataUri;
    const header = parts[0];
    const data = parts[1];

    const mimeMatch = header.match(/data:(.*?);base64/);
    if (!mimeMatch) return dataUri;
    const mime = mimeMatch[1];

    let ext = '';
    if (mime === 'application/pdf') ext = '.pdf';
    else if (mime === 'image/png') ext = '.png';
    else if (mime === 'image/jpeg' || mime === 'image/jpg') ext = '.jpg';
    else if (mime === 'image/webp') ext = '.webp';
    else if (mime === 'image/gif') ext = '.gif';
    else if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') ext = '.pptx';
    else if (mime === 'application/vnd.ms-powerpoint') ext = '.ppt';
    else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = '.docx';
    else if (mime === 'application/msword') ext = '.doc';
    else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ext = '.xlsx';
    else if (mime === 'application/vnd.ms-excel') ext = '.xls';
    else if (mime === 'video/mp4') ext = '.mp4';
    else if (mime === 'video/webm') ext = '.webm';
    else if (mime === 'text/plain') ext = '.txt';
    else if (mime === 'application/zip') ext = '.zip';
    else ext = '.bin';

    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving base64 file:', err);
    return dataUri;
  }
}

function processStoryFiles(story) {
  if (!story) return story;
  if (story.photo) {
    story.photo = saveBase64File(story.photo, 'photo');
  }
  if (story.resumeFile && story.resumeFile.url) {
    story.resumeFile.url = saveBase64File(story.resumeFile.url, 'resume');
  }
  if (story.studyMaterials && Array.isArray(story.studyMaterials)) {
    story.studyMaterials = story.studyMaterials.map(material => {
      if (material.url) {
        material.url = saveBase64File(material.url, 'material');
      }
      return material;
    });
  }
  return story;
}

function processResourceFiles(resource) {
  if (!resource) return resource;
  if (resource.link) {
    resource.link = saveBase64File(resource.link, 'resource');
  }
  return resource;
}

function processAchievementFiles(achievement) {
  if (!achievement) return achievement;
  if (achievement.image) {
    achievement.image = saveBase64File(achievement.image, 'achievement');
  }
  return achievement;
}

// HTML tag stripping to prevent Stored XSS
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

// Helper to escape regex special characters (blocks ReDoS & query injection)
function escapeRegExp(string) {
  if (typeof string !== 'string') return string;
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Deep sanitization of objects
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
  return obj;
}

// Base64 file URI validation
function validateFileUri(uri, allowedPrefixes) {
  if (!uri) return true; // Optional field is valid
  if (typeof uri !== 'string') return false;
  if (!uri.startsWith('data:')) {
    // Relative local paths or anchors are allowed, but block script injections
    if (uri.toLowerCase().startsWith('javascript:')) return false;
    return true;
  }
  return allowedPrefixes.some(prefix => uri.startsWith(prefix));
}

const ALLOWED_IMAGE_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,', 'data:image/jpg;base64,'];
const ALLOWED_PDF_PREFIXES = ['data:application/pdf;base64,'];
const ALLOWED_DOC_PREFIXES = [...ALLOWED_IMAGE_PREFIXES, ...ALLOWED_PDF_PREFIXES];

// --- In-Memory User Auth Cache for Mitigating High-Concurrency Database Amplification ---
class UserAuthCache {
  constructor(ttlMs = 45 * 1000, maxEntries = 5000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(email) {
    if (!email || typeof email !== 'string') return null;
    const key = email.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.user;
  }

  set(email, user) {
    if (!email || typeof email !== 'string' || !user) return;
    const key = email.toLowerCase().trim();
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      user,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  invalidate(email) {
    if (!email || typeof email !== 'string') return;
    const key = email.toLowerCase().trim();
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size() {
    return this.cache.size;
  }

  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) : '0.0';
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`
    };
  }
}

const userAuthCache = new UserAuthCache(45 * 1000);

// --- API Response Pagination Helpers ---
function getPaginationParams(query, defaultLimit = 20, maxLimit = 100) {
  const isPaginated = query.page !== undefined || query.limit !== undefined || query.paginate === 'true';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { isPaginated, page, limit, skip };
}

function sendPaginatedResponse(res, data, total, page, limit) {
  const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(page));
  res.set('X-Limit', String(limit));
  res.set('X-Total-Pages', String(totalPages));
  return res.json({
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  });
}

// --- JWT Verification & Authorization Middlewares ---

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token is required. Please login.', code: 'TOKEN_MISSING' });
  }

  let decoded;
  try {
    // 1. Always verify cryptographic signature and expiration first
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      error: 'Session expired or token invalid. Please sign in again.',
      code: 'TOKEN_EXPIRED'
    });
  }

  const email = (decoded.email || '').trim();
  if (!email) {
    return res.status(401).json({ error: 'User session invalid. Email claim missing.', code: 'INVALID_TOKEN' });
  }

  try {
    // 2. Check session validity if sessionId is present
    if (decoded.sessionId) {
      const isActive = await sessionService.isSessionActive(decoded.sessionId, email);
      if (!isActive) {
        return res.status(401).json({
          error: 'Your session has been terminated or expired. Please sign in again.',
          code: 'SESSION_REVOKED'
        });
      }
      sessionService.touchSession(decoded.sessionId);
    }

    // 3. Check short-lived in-memory cache before executing remote database query
    let user = userAuthCache.get(email);
    if (!user) {
      try {
        user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email) + '$', 'i') });
      } catch (dbErr) {
        console.warn('[AUTH_DB_WARN] Transient error querying user during authentication:', dbErr.message);
        return res.status(503).json({
          error: 'Authentication service temporarily busy. Please retry.',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      if (!user) {
        return res.status(401).json({ error: 'User session invalid. User not found.', code: 'USER_NOT_FOUND' });
      }
      userAuthCache.set(email, user);
    }

    // 4. Immediately enforce account suspension or deactivation
    if (user.status !== 'Active') {
      userAuthCache.invalidate(email);
      return res.status(403).json({ error: 'Your account is inactive or pending approval.', code: 'ACCOUNT_INACTIVE' });
    }

    // 5. Automatic sliding token refresh if token has less than 12 hours remaining
    if (decoded.exp) {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const remainingSeconds = decoded.exp - nowSeconds;
      if (remainingSeconds > 0 && remainingSeconds < 12 * 3600) {
        const refreshedToken = jwt.sign(
          {
            email: user.email,
            role: user.role,
            status: user.status,
            sessionId: decoded.sessionId || null
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.setHeader('X-Refreshed-Token', refreshedToken);
      }
    }

    req.user = user;
    req.user.sessionId = decoded.sessionId || null;
    req.sessionId = decoded.sessionId || null;
    next();
  } catch (err) {
    console.error('[AUTH_INTERNAL_ERROR]', err);
    return res.status(500).json({
      error: 'An unexpected internal authentication error occurred.',
      code: 'AUTH_INTERNAL_ERROR'
    });
  }
}

async function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    req.user = null;
    return next();
  }

  // If a token was provided, enforce full cryptographic verification and onboarding guards
  authenticateToken(req, res, () => {
    requireOnboarded(req, res, next);
  });
}

function isUserAdmin(user) {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const role = user.role || '';
  return email === 'admin@spit.ac.in' || role === 'Administrator' || role === 'Admin' || Boolean(user.isAdmin);
}

function requireAdmin(req, res, next) {
  if (!isUserAdmin(req.user)) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

function requireOnboarded(req, res, next) {
  // Allow administrators unconditionally
  if (isUserAdmin(req.user)) {
    return next();
  }
  // Check onboarded flag or completed profile
  const isOnboarded = Boolean(req.user && (req.user.onboarded || (req.user.name && req.user.branch)));
  if (!isOnboarded) {
    return res.status(403).json({
      error: 'Onboarding required. Please complete your profile before accessing platform resources.',
      code: 'ONBOARDING_REQUIRED'
    });
  }
  next();
}

// =========================================================================
// GLOBAL PUBLIC SECTION VISIBILITY CONTROLS
// Stories, Resources, and Achievements toggles default to OFF (false)
// =========================================================================
const DEFAULT_SECTION_VISIBILITY = Object.freeze({
  stories: false,
  resources: false,
  achievements: false
});

async function getSectionVisibility() {
  try {
    const cacheKey = cacheService.makeKey('settings', 'section_visibility');
    return await cacheService.getOrSet(cacheKey, async () => {
      if (mongoose.connection.readyState !== 1) {
        return { ...DEFAULT_SECTION_VISIBILITY };
      }
      const setting = await SystemSetting.findOne({ key: 'section_visibility' }).lean();
      if (!setting || !setting.value || typeof setting.value !== 'object') {
        return { ...DEFAULT_SECTION_VISIBILITY };
      }
      return {
        stories: Boolean(setting.value.stories),
        resources: Boolean(setting.value.resources),
        achievements: Boolean(setting.value.achievements)
      };
    }, 60);
  } catch (err) {
    console.warn('[SETTINGS_WARN] Could not retrieve section visibility:', err.message);
    return { ...DEFAULT_SECTION_VISIBILITY };
  }
}


// Database connection
const primaryUri = process.env.MONGODB_URI;
const fallbackUri = 'mongodb://127.0.0.1:27017/loop_db';
const MONGODB_MAX_POOL_SIZE = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10);
const MONGODB_MIN_POOL_SIZE = parseInt(process.env.MONGODB_MIN_POOL_SIZE || '5', 10);

// Disable buffering so that queries fail fast instead of hanging when database is offline
mongoose.set('bufferCommands', false);

async function connectWithFallback() {
  if (primaryUri && primaryUri !== fallbackUri) {
    // Staging Isolation Guard: Log warning if staging points to default database path
    if (process.env.NODE_ENV === 'staging') {
      const rawPath = primaryUri.split('?')[0].split('/').pop();
      if (!rawPath || rawPath === 'test') {
        console.warn('[STAGING ISOLATION WARNING] MONGODB_URI does not specify an explicit staging database path (e.g. /loop_staging).');
      }
    }

    console.log('Attempting to connect to primary MongoDB database...');
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 4000, // fail fast
        maxPoolSize: MONGODB_MAX_POOL_SIZE,
        minPoolSize: MONGODB_MIN_POOL_SIZE,
        autoIndex: process.env.NODE_ENV !== 'production',
        serverApi: {
          version: '1',
          strict: true,
          deprecationErrors: true
        }
      });
      console.log('Connected to primary MongoDB database successfully.');
      ensureSystemFolders().catch(e => console.error('System folders sync error:', e.message));
      return;
    } catch (err) {
      console.error('Primary MongoDB connection error:', err.message);
      if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'local_test') {
        console.error(`Failing closed: silent local fallback disabled in ${process.env.NODE_ENV} environment.`);
        return;
      }
      console.log('Falling back to local MongoDB database...');
    }
  }

  if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'local_test') {
    console.error(`Failing closed: MONGODB_URI required in ${process.env.NODE_ENV} environment. Refusing local fallback.`);
    return;
  }

  try {
    await mongoose.connect(fallbackUri, {
      serverSelectionTimeoutMS: 4000,
      maxPoolSize: MONGODB_MAX_POOL_SIZE,
      minPoolSize: MONGODB_MIN_POOL_SIZE,
      autoIndex: process.env.NODE_ENV !== 'production'
    });
    console.log('Connected to local fallback MongoDB successfully.');
    ensureSystemFolders().catch(e => console.error('System folders sync error:', e.message));
  } catch (err) {
    console.error('Local fallback MongoDB connection error:', err.message);
  }
}

if (require.main === module) {
  connectWithFallback();
}

// Root & Health Check Endpoints (Guarantees Render and Cloud health probes always pass 200 OK)
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'loop-backend',
    version: '2.2.0-gridfs-streaming',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'connecting',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Dedicated Public Diagnostic Endpoint for Route & Deployment Verification
app.get(['/api/upload-route-health', '/upload-route-health'], (req, res) => {
  res.status(200).json({
    uploadRoutes: true,
    version: '2.2.0-gridfs-streaming',
    architecture: 'MongoDB GridFS Parallel Chunk Streaming',
    maxFileSize: '200MB',
    endpoints: [
      'POST /api/resources/upload/init',
      'PUT /api/resources/upload/chunk',
      'POST /api/resources/upload/chunk',
      'GET /api/resources/upload/:uploadId',
      'POST /api/resources/upload/finalize',
      'DELETE /api/resources/upload/:uploadId'
    ],
    timestamp: new Date().toISOString()
  });
});

// Dedicated Diagnostic Endpoint for Email Provider Configuration Verification
app.get(['/api/email-provider-health', '/email-provider-health'], (req, res) => {
  const rawKey = process.env.BREVO_API_KEY || '';
  const cleanKey = rawKey.trim().replace(/^["']|["']$/g, '');
  let emailFrom = (process.env.EMAIL_FROM || '').trim().replace(/^["']|["']$/g, '');
  const hasResendStaleSender = emailFrom.toLowerCase().includes('resend.dev');
  if (!emailFrom || hasResendStaleSender) {
    emailFrom = 'swapnil.patil24@spit.ac.in';
  }

  res.status(200).json({
    status: 'ok',
    brevoKeyConfigured: Boolean(cleanKey && cleanKey.startsWith('xkeysib-')),
    emailFromConfigured: Boolean(process.env.EMAIL_FROM),
    emailFromEffective: emailFrom,
    hasResendStaleSender,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    name: BRAND.fullName,
    tagline: BRAND.tagline,
    college: BRAND.college,
    version: '2.2.0-gridfs-streaming',
    uploadRoutes: true
  });
});

// Dedicated Public robots.txt Endpoint
app.get(['/robots.txt', '/api/robots.txt'], (req, res) => {
  res.type('text/plain');
  res.send(`# robots.txt for ${BRAND.fullName}
# ${BRAND.tagline}
# Official Domain: https://loop-seven-delta.vercel.app

# Search Engine Crawlers (Googlebot, Bingbot, DuckDuckBot, etc.)
User-agent: *
Allow: /
Allow: /privacy-policy
Allow: /terms
Allow: /llms.txt
Allow: /llms-full.txt

# Disallow internal protected sections and detail routes (Require Student Login)
Disallow: /stories
Disallow: /stories/*
Disallow: /resources
Disallow: /achievements
Disallow: /achievements/*
Disallow: /admin
Disallow: /admin/*
Disallow: /onboarding
Disallow: /preview/
Disallow: /preview/*
Disallow: /api/
Disallow: /uploads/resume-
Disallow: /uploads/material-

# AI Search Engine Crawlers (ChatGPT Search, Perplexity, Claude Search)
User-agent: OAI-SearchBot
Allow: /
Allow: /llms.txt
Allow: /llms-full.txt

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

# Reference to XML Sitemap
Sitemap: https://loop-seven-delta.vercel.app/sitemap.xml
`);
});

// Dedicated Public Dynamic XML Sitemap Endpoint
app.get(['/sitemap.xml', '/api/sitemap.xml'], async (req, res) => {
  try {
    const cacheKey = cacheService.makeKey('seo', 'sitemap_xml');
    const xml = await cacheService.getOrSet(cacheKey, async () => {
      const baseUrl = 'https://loop-seven-delta.vercel.app';
      const visibility = await getSectionVisibility();
      const staticPages = [
        { path: '/', priority: '1.0', changefreq: 'daily' },
        { path: '/home', priority: '0.9', changefreq: 'daily' },
        ...(visibility.stories ? [{ path: '/stories', priority: '0.9', changefreq: 'daily' }] : []),
        ...(visibility.resources ? [{ path: '/resources', priority: '0.8', changefreq: 'weekly' }] : []),
        ...(visibility.achievements ? [{ path: '/achievements', priority: '0.7', changefreq: 'weekly' }] : []),
        { path: '/privacy-policy', priority: '0.3', changefreq: 'monthly' },
        { path: '/terms', priority: '0.3', changefreq: 'monthly' }
      ];

      // Query approved stories from MongoDB Atlas only if stories section is enabled
      let stories = [];
      if (visibility.stories) {
        try {
          stories = await Story.find({}).select('id updatedAt createdAt').lean();
        } catch (e) {
          console.warn('[SITEMAP_WARN] Could not fetch stories for sitemap:', e.message);
        }
      }

      // Query approved achievements only if achievements section is enabled
      let achievements = [];
      if (visibility.achievements) {
        try {
          achievements = await Achievement.find({}).select('id updatedAt createdAt').lean();
        } catch (e) {
          console.warn('[SITEMAP_WARN] Could not fetch achievements for sitemap:', e.message);
        }
      }

      let entries = '';
      const now = new Date().toISOString();

      for (const p of staticPages) {
        entries += `  <url>\n    <loc>${baseUrl}${p.path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
      }

      for (const s of stories) {
        if (!s.id) continue;
        const lastmod = (s.updatedAt || s.createdAt || new Date()).toISOString();
        entries += `  <url>\n    <loc>${baseUrl}/stories/${encodeURIComponent(s.id)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }

      for (const a of achievements) {
        const achId = a.id || (a._id ? a._id.toString() : null);
        if (!achId) continue;
        const lastmod = (a.updatedAt || a.createdAt || new Date()).toISOString();
        entries += `  <url>\n    <loc>${baseUrl}/achievements/${encodeURIComponent(achId)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
      }

      return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}</urlset>`;
    }, 3600);

    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    });
    return res.send(xml);
  } catch (err) {
    console.error('[SITEMAP_GEN_ERROR]', err);
    res.status(500).set('Content-Type', 'text/plain').send('Error generating XML sitemap');
  }
});

// Middleware to check database connection status before handling API requests
app.use((req, res, next) => {
  if (
    req.path === '/health' ||
    req.path === '/api/health' ||
    req.path === '/' ||
    req.path === '/robots.txt' ||
    req.path === '/api/robots.txt' ||
    req.path === '/sitemap.xml' ||
    req.path === '/api/sitemap.xml' ||
    req.path === '/api/upload-route-health' ||
    req.path === '/upload-route-health' ||
    req.path === '/api/email-provider-health' ||
    req.path === '/email-provider-health'
  ) {
    return next();
  }
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: 'Database connection is not established. Please make sure MongoDB is running locally or check your credentials in the server\'s .env file, verify network availability, and ensure your IP is whitelisted in MongoDB Atlas.' 
    });
  }
  next();
});

// Routes

// 1. Folders
app.get('/api/folders', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { category, parentId } = req.query;
    const isAdmin = isUserAdmin(req.user);
    const userEmail = req.user ? req.user.email : null;
    const userId = req.user ? req.user.id : null;

    // Base query:
    // 1. System folders: visible to all authenticated users
    // 2. Public folders: visible to all authenticated users
    // 3. Private folders: ONLY visible to Administrators
    const visibilityConditions = [
      { folderType: 'system' },
      { visibility: 'public' }
    ];

    if (isAdmin) {
      visibilityConditions.push({ visibility: 'private' });
    }

    let filter = { $or: visibilityConditions };

    if (category === 'system') {
      filter = { folderType: 'system' };
    } else if (category === 'public') {
      filter = { folderType: 'user', visibility: 'public' };
    } else if (category === 'private') {
      if (!isAdmin) {
        return res.json([]);
      }
      filter = { folderType: 'user', visibility: 'private' };
    }

    if (parentId !== undefined) {
      filter.parentId = parentId === 'null' || parentId === '' ? null : parentId;
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    const roleScope = isAdmin ? 'admin' : 'public';
    const catScope = category || 'all';
    const parentScope = parentId !== undefined ? (parentId === 'null' || parentId === '' ? 'root' : parentId) : 'any';
    const cacheKey = cacheService.makeKey('folders', `${roleScope}_cat_${catScope}_parent_${parentScope}_p_${page}_l_${limit}_pag_${isPaginated}`);

    const payload = await cacheService.getOrSet(cacheKey, async () => {
      if (isPaginated) {
        const total = await Folder.countDocuments(filter);
        const folders = await Folder.find(filter)
          .sort({ isSystemFolder: -1, createdAt: 1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        return { isPaginated: true, folders, total };
      }
      const folders = await Folder.find(filter)
        .sort({ isSystemFolder: -1, createdAt: 1, _id: -1 })
        .lean();
      return { isPaginated: false, folders, total: folders.length };
    }, cacheService.DEFAULT_TTLS.folders);

    if (payload.isPaginated) {
      return sendPaginatedResponse(res, payload.folders, payload.total, page, limit);
    }
    res.set('X-Total-Count', String(payload.folders.length));
    return res.json(payload.folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { name, description, parentId, visibility, allowContributions, isSystemFolder } = req.body;
    const isAdmin = isUserAdmin(req.user);

    if (!isAdmin) {
      return res.status(403).json({ error: 'Folder creation is restricted to administrators only.' });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Folder name cannot exceed 100 characters.' });
    }

    // Check parent folder if provided
    if (parentId) {
      const parentFolder = await Folder.findOne({ id: parentId });
      if (!parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found.' });
      }
      if (parentFolder.visibility === 'private') {
        const isParentOwner = parentFolder.ownerEmail === req.user.email || (parentFolder.ownerId && String(parentFolder.ownerId) === String(req.user.id));
        if (!isParentOwner && !isAdmin) {
          return res.status(403).json({ error: 'You do not have permission to add folders inside this private folder.' });
        }
      }
    }

    const folderType = (isAdmin && isSystemFolder) ? 'system' : 'user';
    const isSystem = (isAdmin && isSystemFolder) ? true : false;
    const folderVisibility = (isAdmin && visibility === 'public') ? 'public' : 'private';

    const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
    const folderId = `${cleanSlug}-${Date.now()}`;

    const folder = await Folder.create({
      id: folderId,
      name: name.trim(),
      description: description ? description.trim() : '',
      parentId: parentId || null,
      ownerId: req.user.id || null,
      ownerEmail: req.user.email,
      ownerName: req.user.name || req.user.email.split('@')[0],
      folderType,
      visibility: folderVisibility,
      allowContributions: allowContributions !== undefined ? Boolean(allowContributions) : true,
      isSystemFolder: isSystem
    });

    await cacheService.invalidateFolders().catch(() => {});
    res.status(201).json(folder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/folders/:id', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const folder = await Folder.findOne({ id });
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const isAdmin = isUserAdmin(req.user);
    const isOwner = folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id));

    if (folder.isSystemFolder && !isAdmin) {
      return res.status(403).json({ error: 'System folders can only be renamed or modified by an Administrator.' });
    }

    if (!folder.isSystemFolder && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to modify this folder.' });
    }

    const updates = {};
    if (req.body.name && typeof req.body.name === 'string') updates.name = req.body.name.trim();
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    if (req.body.visibility && ['public', 'private'].includes(req.body.visibility)) {
      if (req.body.visibility === 'public' && !isAdmin) {
        return res.status(403).json({ error: 'Only Administrators can change folder visibility to Public.' });
      }
      updates.visibility = req.body.visibility;
    }
    if (req.body.allowContributions !== undefined) updates.allowContributions = Boolean(req.body.allowContributions);

    const updated = await Folder.findOneAndUpdate({ id }, { $set: updates }, { new: true });
    await cacheService.invalidateFolders().catch(() => {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const folder = await Folder.findOne({ id });
    if (!folder) return res.status(404).json({ error: 'Folder not found.' });

    const isAdmin = isUserAdmin(req.user);
    const isOwner = folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id));

    // Core academic folders are protected from non-admin deletion
    const PROTECTED_SYSTEM_ROOTS = [
      'system-placement-material', 'system-cse-ce', 'system-extc',
      'cse-1st-year', 'cse-2nd-year', 'cse-3rd-year', 'cse-4th-year',
      'extc-1st-year', 'extc-2nd-year', 'extc-3rd-year', 'extc-4th-year'
    ];
    if (!isAdmin && PROTECTED_SYSTEM_ROOTS.includes(id)) {
      return res.status(403).json({ error: 'This core academic system folder is protected and cannot be deleted by non-administrators.' });
    }

    if (folder.isSystemFolder && !isAdmin) {
      return res.status(403).json({ error: 'System folders can only be deleted by an Administrator.' });
    }

    if (!folder.isSystemFolder && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to delete this folder.' });
    }

    // Safe cascading deletion: collect all subfolder IDs recursively
    const allFolderIdsToDelete = [id];
    const collectChildren = async (parentId) => {
      const children = await Folder.find({ parentId }).select('id').lean();
      for (const child of children) {
        allFolderIdsToDelete.push(child.id);
        await collectChildren(child.id);
      }
    };
    await collectChildren(id);

    // Clean up physical/cloud storage files for all resources inside deleted folders
    const resourcesToDelete = await Resource.find({ folderId: { $in: allFolderIdsToDelete } })
      .select('storageKey storageProvider')
      .lean();
    for (const resItem of resourcesToDelete) {
      if (resItem.storageKey) {
        await StorageService.deleteFile(resItem.storageKey, resItem.storageProvider);
      }
    }

    // Delete records from database
    await Resource.deleteMany({ folderId: { $in: allFolderIdsToDelete } });
    await Folder.deleteMany({ id: { $in: allFolderIdsToDelete } });

    await cacheService.invalidateFolders().catch(() => {});
    await cacheService.invalidateResources().catch(() => {});

    res.json({
      message: 'Folder and its contents deleted successfully without orphaned records.',
      deletedFoldersCount: allFolderIdsToDelete.length,
      deletedResourcesCount: resourcesToDelete.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: strip password from a user document before sending to client
function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

// Helper to detect MongoDB storage quota, server, or connection errors
function isDatabaseStorageOrConnectionError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const name = err.name || '';
  return (
    err.code === 8000 || // Atlas space quota exceeded error code
    err.code === 86 ||
    msg.includes('quota exceeded') ||
    msg.includes('space quota') ||
    msg.includes('storage quota') ||
    msg.includes('disk full') ||
    msg.includes('cannot allocate') ||
    name === 'MongoServerError' ||
    name === 'MongoError' ||
    name === 'MongooseServerSelectionError' ||
    name === 'MongoNetworkError' ||
    name === 'MongoTimeoutError'
  );
}

// Secure registration error handler that never leaks credentials or raw database internals
function handleRegistrationError(err, operation, res) {
  console.error(`[SECURE_DB_ERROR] ${operation} failed:`, {
    errorName: err.name,
    errorCode: err.code,
    errorMessage: err.message,
    timestamp: new Date().toISOString()
  });

  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  return res.status(503).json({
    error: 'Registration is temporarily unavailable. Please try again later.'
  });
}

// 2. Users
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    if (isPaginated) {
      const total = await User.countDocuments({});
      const users = await User.find({})
        .select('-password -__v')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return sendPaginatedResponse(res, users, total, page, limit);
    }

    const users = await User.find({}).select('-password -__v').sort({ createdAt: -1, _id: -1 }).lean();
    res.set('X-Total-Count', String(users.length));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { email, role, password, name, branch, currentYear, status } = req.body;

    // Required field check
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required.' });
    }
    if (typeof email !== 'string' || email.length > 200) {
      return res.status(400).json({ error: 'Invalid email.' });
    }
    if (typeof role !== 'string' || role.length > 100) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (name && (typeof name !== 'string' || name.length > 200)) {
      return res.status(400).json({ error: 'Invalid name.' });
    }
    if (branch && (typeof branch !== 'string' || branch.length > 100)) {
      return res.status(400).json({ error: 'Invalid branch.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: new RegExp('^' + escapeRegExp(cleanEmail) + '$', 'i') });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    // Set default password 'spit123' if not provided or empty, and hash with bcrypt
    const initialPassword = (password && typeof password === 'string' && password.trim()) ? password.trim() : 'spit123';
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    const isProfileFilled = Boolean(name && branch && currentYear);
    const userData = {
      email: cleanEmail,
      role: sanitizeString(role.trim()),
      password: hashedPassword,
      name: name ? sanitizeString(name.trim()) : '',
      branch: branch ? sanitizeString(branch.trim()) : '',
      currentYear: currentYear ? sanitizeString(String(currentYear).trim()) : '',
      status: status || 'Active',
      onboarded: isProfileFilled || cleanEmail === 'admin@spit.ac.in'
    };

    const user = await User.create(userData);
    userAuthCache.invalidate(cleanEmail);

    activityService.logActivity({
      eventType: 'USER_CREATE',
      category: 'ADMIN',
      actorEmail: req.user?.email || 'admin@spit.ac.in',
      actorRole: req.user?.role || 'Administrator',
      targetType: 'User',
      targetId: String(user._id),
      targetUserEmail: user.email,
      summary: `Admin created platform user ${user.email} (${user.role}) with initial credentials`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.get('user-agent') || '',
      metadata: { role: user.role, status: user.status, branch: user.branch, currentYear: user.currentYear }
    });

    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    if (isDatabaseStorageOrConnectionError(err)) {
      console.error('[SECURE_DB_ERROR] Admin User Create failed due to DB storage:', {
        errorName: err.name,
        errorCode: err.code,
        errorMessage: err.message,
        timestamp: new Date().toISOString()
      });
      return res.status(503).json({ error: 'Database storage quota reached. User creation is temporarily unavailable.' });
    }
    res.status(400).json({ error: err.message });
  }
});

function normalizeLoginIdentifier(rawIdentifier) {
  if (typeof rawIdentifier !== 'string') {
    return { valid: false, error: 'Invalid input types.' };
  }
  
  const trimmed = rawIdentifier.trim();
  if (!trimmed) {
    return { valid: false, error: 'Email and password are required.' };
  }
  
  if (trimmed.length > 100) {
    return { valid: false, error: 'Inputs exceed maximum permitted length.' };
  }

  // Reject identifiers with internal whitespace or control characters
  if (/[\s\x00-\x1F\x7F]/.test(trimmed)) {
    return { valid: false, error: 'Identifier cannot contain whitespace or control characters.' };
  }

  if (trimmed.includes('@')) {
    const atParts = trimmed.split('@');
    if (atParts.length !== 2) {
      return { valid: false, error: 'Malformed email address.' };
    }

    const [localPart, domainPart] = atParts;
    if (!localPart || !domainPart) {
      return { valid: false, error: 'Malformed email address.' };
    }

    // Validate domain structure: must have at least one period and valid domain characters
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainPart)) {
      return { valid: false, error: 'Invalid email domain format.' };
    }

    if (!/^[a-zA-Z0-9._%+-]+$/.test(localPart)) {
      return { valid: false, error: 'Malformed email address contains invalid characters.' };
    }

    const normalizedEmail = trimmed.toLowerCase();
    const normalizedUsername = localPart.toLowerCase();
    return { valid: true, email: normalizedEmail, username: normalizedUsername };
  } else {
    // No '@' present -> treat as campus username without @spit.ac.in suffix
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      return { valid: false, error: 'Invalid username format. Usernames may only contain letters, numbers, dots, hyphens, and underscores.' };
    }

    const normalizedUsername = trimmed.toLowerCase();
    const normalizedEmail = `${normalizedUsername}@spit.ac.in`;
    return { valid: true, email: normalizedEmail, username: normalizedUsername };
  }
}

app.post('/api/users/login', async (req, res) => {
  try {
    const rawIdentifier = req.body.email !== undefined ? req.body.email : (req.body.identifier || req.body.username);
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    // Type and length validation
    if (typeof rawIdentifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types.' });
    }
    if (rawIdentifier.length > 100 || password.length > 100) {
      return res.status(400).json({ error: 'Inputs exceed maximum permitted length.' });
    }

    const normResult = normalizeLoginIdentifier(rawIdentifier);
    if (!normResult.valid) {
      return res.status(400).json({ error: normResult.error });
    }

    const { email: normalizedEmail, username: normalizedUsername } = normResult;

    // Case-insensitive, trimmed, regex-escaped email and username search (prevents ReDoS)
    const user = await User.findOne({
      $or: [
        { email: new RegExp('^' + escapeRegExp(normalizedEmail) + '$', 'i') },
        { username: new RegExp('^' + escapeRegExp(normalizedUsername) + '$', 'i') }
      ]
    });
    if (!user) {
      activityService.logActivity({
        eventType: 'AUTH_LOGIN_FAIL',
        category: 'AUTH',
        actorEmail: String(rawIdentifier).slice(0, 80),
        summary: 'Failed login attempt - user not found',
        outcome: 'FAILURE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { reason: 'USER_NOT_FOUND' }
      });
      return res.status(401).json({ error: 'Invalid username/email or password. Please try again.' });
    }
    
    if (user.status === 'Pending') {
      return res.status(403).json({ error: 'Your registration request is pending administrator approval.' });
    }
    
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
    }
    
    // Verify account has a usable password hash before comparing
    if (!user.password || typeof user.password !== 'string' || !user.password.trim()) {
      return res.status(401).json({ error: 'Invalid username/email or password. Please try again.' });
    }

    // Compare bcrypt passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      activityService.logActivity({
        eventType: 'AUTH_LOGIN_FAIL',
        category: 'AUTH',
        actorEmail: user.email,
        summary: 'Failed login attempt - invalid password',
        outcome: 'FAILURE',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { reason: 'INVALID_PASSWORD' }
      });
      return res.status(401).json({ error: 'Invalid username/email or password. Please try again.' });
    }
    
    // Create persistent user session
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const session = await sessionService.createSession({
      email: user.email,
      userAgent,
      ipAddress
    });

    // Sign JWT with sessionId
    const token = jwt.sign(
      { email: user.email, role: user.role, status: user.status, sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    activityService.logActivity({
      eventType: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      actorEmail: user.email,
      actorRole: user.role,
      summary: `User logged in from ${session.deviceSummary}`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'local_password', sessionId: session.sessionId }
    });
    
    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    const isProfileFilled = Boolean(user.onboarded || (user.name && user.branch) || isUserAdmin);
    if (!user.onboarded && isProfileFilled) {
      user.onboarded = true;
      user.save().catch(() => {});
    }
    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: isProfileFilled,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'A server error occurred during login. Please try again later.' });
  }
});

// Dedicated Secure One-Click Demo Login Endpoint
app.post(['/api/auth/demo-login', '/api/users/demo-login'], loginLimiter, async (req, res) => {
  try {
    const { role } = req.body || {};
    const targetRole = role === 'admin' ? 'admin' : 'student';

    // Environment-controlled security feature flags (secure-by-default in production)
    const isProduction = process.env.NODE_ENV === 'production';
    const isDemoEnabled = isProduction
      ? process.env.ENABLE_DEMO_LOGIN === 'true'
      : process.env.ENABLE_DEMO_LOGIN !== 'false';
    const isAdminDemoEnabled = isProduction
      ? process.env.ENABLE_ADMIN_DEMO === 'true'
      : process.env.ENABLE_ADMIN_DEMO !== 'false';

    if (!isDemoEnabled) {
      return res.status(403).json({ error: 'One-click demo login is disabled in this environment.', code: 'DEMO_DISABLED' });
    }

    if (targetRole === 'admin' && !isAdminDemoEnabled) {
      return res.status(403).json({ error: 'Administrative demo login is restricted in this environment.', code: 'ADMIN_DEMO_DISABLED' });
    }

    const demoEmail = targetRole === 'admin' ? 'admin@spit.ac.in' : 'student@spit.ac.in';
    let user = await User.findOne({ email: new RegExp('^' + escapeRegExp(demoEmail) + '$', 'i') });

    if (!user) {
      const defaultHash = await bcrypt.hash(targetRole === 'admin' ? 'admin123' : 'student123', 10);
      user = await User.create({
        email: demoEmail,
        name: targetRole === 'admin' ? 'System Administrator' : 'SPIT Demo Student',
        role: targetRole === 'admin' ? 'Administrator' : 'Student',
        branch: targetRole === 'admin' ? 'COMP' : 'CSE',
        currentYear: targetRole === 'admin' ? 'Faculty' : 'TE',
        status: 'Active',
        onboarded: true,
        password: defaultHash
      });
    }

    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Demo account is currently inactive.' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const session = await sessionService.createSession({
      email: user.email,
      userAgent,
      ipAddress
    });

    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    const token = jwt.sign(
      { email: user.email, role: isUserAdmin ? 'Administrator' : user.role, status: user.status, sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    activityService.logActivity({
      eventType: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      actorEmail: user.email,
      actorRole: user.role,
      targetType: 'User',
      targetId: user._id,
      targetUserEmail: user.email,
      summary: `User authenticated via ${targetRole} demo login`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'demo_login', demoRole: targetRole, sessionId: session.sessionId }
    });

    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: true,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Internal demo authentication error: ' + err.message });
  }
});

// Google OAuth Endpoints (Supports /api/auth/google and /api/users/google)
app.post(['/api/auth/google', '/api/users/google', '/api/users/auth/google'], async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const payload = await verifyGoogleToken(idToken);
    const { sub, email, name, emailVerified } = payload;

    // Defense-in-depth: enforce email verification, institutional domain, and valid identity
    if (!emailVerified) {
      return res.status(403).json({ error: 'Google email is not verified.' });
    }
    if (!isSpitDomain(email)) {
      return res.status(403).json({ error: RESTRICTED_MESSAGE });
    }
    if (!sub || typeof sub !== 'string' || !sub.trim()) {
      return res.status(400).json({ error: 'Invalid Google identity subject.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Defense-in-depth: reject request if client explicitly supplied an email mismatching the verified token
    if (req.body.email && typeof req.body.email === 'string' && req.body.email.trim().toLowerCase() !== normalizedEmail) {
      return res.status(400).json({ error: 'Email mismatch between request body and Google identity token.' });
    }

    // 1. Check if user already exists with this googleSub
    let user = await User.findOne({ googleSub: sub });

    if (user) {
      // Reject if Google identity subject is associated with a different email address
      if (user.email.trim().toLowerCase() !== normalizedEmail) {
        return res.status(409).json({ error: 'This Google identity is associated with a different email address.' });
      }

      if (user.status === 'Pending') {
        return res.status(403).json({ error: 'Your registration request is pending administrator approval.' });
      }
      if (user.status !== 'Active') {
        return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
      }

      // Existing returning Google user - direct login without repeating signup
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const session = await sessionService.createSession({
        email: user.email,
        userAgent,
        ipAddress
      });

      const token = jwt.sign(
        { email: user.email, role: user.role, status: user.status, sessionId: session.sessionId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      activityService.logActivity({
        eventType: 'AUTH_LOGIN_SUCCESS',
        category: 'AUTH',
        actorEmail: user.email,
        actorRole: user.role,
        summary: `User logged in via Google OAuth from ${session.deviceSummary}`,
        outcome: 'SUCCESS',
        ipAddress,
        userAgent,
        metadata: { method: 'google', sessionId: session.sessionId }
      });

      const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
      const isProfileFilled = Boolean(user.onboarded || (user.name && user.branch) || isUserAdmin);
      if (!user.onboarded && isProfileFilled) {
        user.onboarded = true;
        user.save().catch(() => {});
      }
      return res.json({
        action: 'LOGIN_SUCCESS',
        email: user.email,
        role: isUserAdmin ? 'Administrator' : user.role,
        status: user.status,
        name: user.name,
        username: user.username || '',
        branch: user.branch,
        currentYear: user.currentYear,
        onboarded: isProfileFilled,
        isAdmin: isUserAdmin,
        nameColor: user.nameColor || '',
        token,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId
      });
    }

    // 2. Check if a user with this email exists without linked googleSub
    const existingByEmail = await User.findOne({ email: new RegExp('^' + escapeRegExp(normalizedEmail) + '$', 'i') });
    if (existingByEmail) {
      // Strict normalization validation
      if (existingByEmail.email.trim().toLowerCase() !== normalizedEmail) {
        return res.status(400).json({ error: 'Google identity email does not match account email.' });
      }

      // If account has an existing, different googleSub, do not overwrite silently
      if (existingByEmail.googleSub && existingByEmail.googleSub !== sub) {
        return res.status(409).json({ error: 'This account is already linked to a different Google identity.' });
      }

      // Check whether the Google subject is already associated with another account
      const conflictingSubUser = await User.findOne({ googleSub: sub, _id: { $ne: existingByEmail._id } });
      if (conflictingSubUser) {
        return res.status(409).json({ error: 'This Google identity is already linked to another account.' });
      }

      // Check account status before proceeding
      if (existingByEmail.status === 'Pending') {
        return res.status(403).json({ error: 'Your registration request is pending administrator approval.' });
      }
      if (existingByEmail.status !== 'Active') {
        return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
      }

      // Determine whether account has an established local password
      const hasLocalPassword = Boolean(
        existingByEmail.password &&
        typeof existingByEmail.password === 'string' &&
        existingByEmail.password.trim() !== ''
      );

      if (hasLocalPassword) {
        return res.json({
          action: 'LINK_REQUIRED',
          email: existingByEmail.email,
          name: existingByEmail.name,
          message: 'An account with this SPIT email already exists. Please enter your account password to securely link your Google account.'
        });
      }

      // Passwordless administrator-created account onboarding:
      // Bind verified Google identity while preserving role, permissions, status, and ID
      existingByEmail.googleSub = sub;
      if (!existingByEmail.authProvider || existingByEmail.authProvider === 'local') {
        existingByEmail.authProvider = 'google';
      }
      if ((!existingByEmail.name || !existingByEmail.name.trim()) && name && name.trim()) {
        existingByEmail.name = sanitizeString(name.trim());
      }

      if (typeof existingByEmail.save === 'function') {
        await existingByEmail.save();
      } else if (typeof User.findOneAndUpdate === 'function') {
        await User.findOneAndUpdate(
          {
            _id: existingByEmail._id,
            $and: [
              {
                $or: [
                  { password: null },
                  { password: '' },
                  { password: { $exists: false } }
                ]
              },
              {
                $or: [
                  { googleSub: null },
                  { googleSub: { $exists: false } },
                  { googleSub: sub }
                ]
              }
            ]
          },
          {
            $set: {
              googleSub: sub,
              authProvider: 'google',
              name: existingByEmail.name
            }
          }
        );
      }

      userAuthCache.invalidate(existingByEmail.email);

      // Issue session token using existing user's role and status
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
      const session = await sessionService.createSession({
        email: existingByEmail.email,
        userAgent,
        ipAddress
      });

      const token = jwt.sign(
        { email: existingByEmail.email, role: existingByEmail.role, status: existingByEmail.status, sessionId: session.sessionId },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      activityService.logActivity({
        eventType: 'AUTH_LOGIN_SUCCESS',
        category: 'AUTH',
        actorEmail: existingByEmail.email,
        actorRole: existingByEmail.role,
        summary: `User logged in via Google OAuth from ${session.deviceSummary}`,
        outcome: 'SUCCESS',
        ipAddress,
        userAgent,
        metadata: { method: 'google_linked', sessionId: session.sessionId }
      });

      const isUserAdmin = existingByEmail.email.toLowerCase() === 'admin@spit.ac.in' || existingByEmail.role === 'Administrator' || existingByEmail.role === 'Admin';
      const isProfileFilled = Boolean(existingByEmail.onboarded || (existingByEmail.name && existingByEmail.branch) || isUserAdmin);
      if (!existingByEmail.onboarded && isProfileFilled) {
        existingByEmail.onboarded = true;
        existingByEmail.save().catch(() => {});
      }
      return res.json({
        action: 'LOGIN_SUCCESS',
        email: existingByEmail.email,
        role: isUserAdmin ? 'Administrator' : existingByEmail.role,
        status: existingByEmail.status,
        name: existingByEmail.name,
        username: existingByEmail.username || '',
        branch: existingByEmail.branch,
        currentYear: existingByEmail.currentYear,
        onboarded: isProfileFilled,
        isAdmin: isUserAdmin,
        nameColor: existingByEmail.nameColor || '',
        token,
        refreshToken: session.refreshToken,
        sessionId: session.sessionId
      });
    }

    // 3. New user - needs first-time signup
    return res.json({
      action: 'NEEDS_SIGNUP',
      email,
      name
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'This Google identity is already linked to another account.' });
    }
    const status = err.status || (err.message && err.message.toLowerCase().includes('not verified') ? 403 : 500);
    return res.status(status).json({ error: err.message });
  }
});

app.post(['/api/auth/google/signup', '/api/users/google/signup', '/api/users/auth/google/signup'], async (req, res) => {
  try {
    const { idToken, name, username, password, confirmPassword } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }

    const payload = await verifyGoogleToken(idToken);
    const { sub, email } = payload;

    // Validate inputs
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ error: 'Full name exceeds maximum permitted length.' });
    }

    let trimmedUsername = null;
    if (username && typeof username === 'string' && username.trim()) {
      trimmedUsername = username.trim();
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmedUsername)) {
        return res.status(400).json({ error: 'Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens.' });
      }

      // Verify username uniqueness, appending a suffix if collision occurs
      let existingUsername = await User.findOne({ username: new RegExp('^' + escapeRegExp(trimmedUsername) + '$', 'i') });
      if (existingUsername) {
        trimmedUsername = `${trimmedUsername.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }
    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'Password must be between 6 and 100 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    // Check if user already exists with this email or googleSub
    const existingUser = await User.findOne({
      $or: [
        { email: new RegExp('^' + escapeRegExp(email) + '$', 'i') },
        { googleSub: sub }
      ]
    });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email or Google identity already exists. Please log in.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (Standard Student role, Active status, no admin privileges)
    const userData = {
      email,
      name: sanitizeString(name.trim()),
      password: hashedPassword,
      googleSub: sub,
      authProvider: 'google',
      role: 'Student',
      status: 'Active',
      onboarded: false
    };
    if (trimmedUsername) {
      userData.username = sanitizeString(trimmedUsername);
    }

    const newUser = new User(userData);

    await newUser.save();
    userAuthCache.invalidate(email);

    // Create session
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const session = await sessionService.createSession({
      email: newUser.email,
      userAgent,
      ipAddress
    });

    // Sign JWT
    const token = jwt.sign(
      { email: newUser.email, role: newUser.role, status: newUser.status, sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    activityService.logActivity({
      eventType: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      actorEmail: newUser.email,
      actorRole: newUser.role,
      summary: `New user signed up and logged in via Google OAuth from ${session.deviceSummary}`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'google_signup', sessionId: session.sessionId }
    });

    return res.status(201).json({
      action: 'LOGIN_SUCCESS',
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      name: newUser.name,
      username: newUser.username,
      branch: newUser.branch,
      currentYear: newUser.currentYear,
      onboarded: newUser.onboarded,
      isAdmin: false,
      nameColor: newUser.nameColor || '',
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId
    });
  } catch (err) {
    return handleRegistrationError(err, 'Google Registration', res);
  }
});

app.post(['/api/auth/google/link', '/api/users/google/link', '/api/users/auth/google/link'], async (req, res) => {
  try {
    const { idToken, password } = req.body;
    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Google ID token is required.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required to link your account.' });
    }

    const payload = await verifyGoogleToken(idToken);
    const { sub, email } = payload;

    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'Account not found for this SPIT email.' });
    }

    // Verify existing account has a usable password hash before comparing
    if (!user.password || typeof user.password !== 'string' || !user.password.trim()) {
      return res.status(400).json({ error: 'This account does not have a local password configured. Unable to link via password verification.' });
    }

    // Verify existing password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Unable to link Google account.' });
    }

    // Do not replace a different existing googleSub silently
    if (user.googleSub && user.googleSub !== sub) {
      return res.status(409).json({ error: 'This account is already linked to a different Google identity.' });
    }

    // Ensure googleSub is not linked to another user
    const otherUser = await User.findOne({ googleSub: sub, _id: { $ne: user._id } });
    if (otherUser) {
      return res.status(409).json({ error: 'This Google account is already linked to another user.' });
    }

    user.googleSub = sub;
    if (!user.authProvider || user.authProvider === 'local') {
      user.authProvider = 'google';
    }
    await user.save();
    userAuthCache.invalidate(email);

    // Create session
    const userAgent = req.headers['user-agent'] || '';
    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const session = await sessionService.createSession({
      email: user.email,
      userAgent,
      ipAddress
    });

    const token = jwt.sign(
      { email: user.email, role: user.role, status: user.status, sessionId: session.sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    activityService.logActivity({
      eventType: 'AUTH_LOGIN_SUCCESS',
      category: 'AUTH',
      actorEmail: user.email,
      actorRole: user.role,
      summary: `User linked Google account and logged in from ${session.deviceSummary}`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'google_linked_password', sessionId: session.sessionId }
    });

    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    const isProfileFilled = Boolean(user.onboarded || (user.name && user.branch) || isUserAdmin);
    if (!user.onboarded && isProfileFilled) {
      user.onboarded = true;
      user.save().catch(() => {});
    }
    return res.json({
      action: 'LOGIN_SUCCESS',
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: isProfileFilled,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token,
      refreshToken: session.refreshToken,
      sessionId: session.sessionId
    });
  } catch (err) {
    console.error('[SECURE_DB_ERROR] Google Account Link failed:', {
      errorName: err.name,
      errorCode: err.code,
      errorMessage: err.message,
      timestamp: new Date().toISOString()
    });
    if (err.status && err.status < 500) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(503).json({ error: 'Account linking is temporarily unavailable. Please try again later.' });
  }
});

// --- Password Recovery Endpoints ---

// 1. Request Password Reset Code
app.post(['/api/auth/forgot-password', '/api/users/forgot-password'], async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 100) {
      return res.status(400).json({ error: 'Email exceeds maximum permitted length.' });
    }

    const normalizedEmail = trimmedEmail.toLowerCase();

    // Dynamically lookup user in MongoDB User collection (supports all registered users)
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { email: trimmedEmail },
        { email: new RegExp('^' + escapeRegExp(normalizedEmail) + '$', 'i') }
      ]
    });

    if (!user) {
      return res.status(404).json({
        error: 'No account found with this email. Please sign up with Google using your SPIT email.',
        code: 'ACCOUNT_NOT_FOUND'
      });
    }

    // Only accounts with local passwords are eligible for password recovery
    const hasLocalPassword = Boolean(
      user.password && 
      typeof user.password === 'string' && 
      user.password.trim() &&
      user.password !== 'null'
    );

    // Case B: Account registered through Google only (no local password set)
    if (!hasLocalPassword && (user.googleSub || user.authProvider === 'google')) {
      return res.status(400).json({
        error: 'Password reset isn’t available for this account. If you signed up with Google, return to Login and choose Continue with Google.',
        code: 'GOOGLE_ACCOUNT_ONLY'
      });
    }

    if (!hasLocalPassword) {
      return res.status(400).json({
        error: 'This account does not have a password set. Please log in using Google with your SPIT email.',
        code: 'NO_LOCAL_PASSWORD'
      });
    }

    const targetEmail = (user.email || normalizedEmail).trim().toLowerCase();

    // Check 60-second cooldown on existing pending challenges
    const activeChallenge = await PasswordResetChallenge.findOne({
      email: targetEmail,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (activeChallenge && activeChallenge.lastIssuedAt) {
      const elapsedMs = Date.now() - new Date(activeChallenge.lastIssuedAt).getTime();
      if (elapsedMs < 60000) {
        const remainingSeconds = Math.ceil((60000 - elapsedMs) / 1000);
        return res.status(429).json({
          error: `A reset code was recently sent. Please wait ${remainingSeconds} second(s) before requesting another code.`,
          code: 'COOLDOWN_ACTIVE',
          retryAfter: remainingSeconds
        });
      }
    }

    // Invalidate existing pending or locked challenges for this email
    await PasswordResetChallenge.updateMany(
      { email: targetEmail, status: { $in: ['pending', 'locked'] } },
      { $set: { status: 'invalidated' } }
    );

    // Generate cryptographically secure 6-digit code
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHmac('sha256', RESET_SECRET).update(code).digest('hex');

    await PasswordResetChallenge.create({
      email: targetEmail,
      codeHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      lastIssuedAt: new Date(),
      status: 'pending'
    });

    // Send email via Brevo email service to registered account email
    try {
      await sendPasswordResetEmail(targetEmail, code);
    } catch (sendErr) {
      // If Brevo delivery fails, invalidate challenge and report honest failure
      await PasswordResetChallenge.updateMany(
        { email: targetEmail, status: { $in: ['pending', 'locked'] } },
        { $set: { status: 'invalidated' } }
      );
      console.error('[FORGOT_PASSWORD] Brevo dispatch error:', sendErr.message);
      const isConfigError = sendErr.message.includes('not configured');
      return res.status(502).json({
        error: isConfigError
          ? 'Failed to deliver verification code email: BREVO_API_KEY is not configured in server environment variables. Please check server settings.'
          : 'Failed to deliver verification code email. Please check your network and try again later.',
        code: 'EMAIL_DELIVERY_FAILED'
      });
    }

    activityService.logActivity({
      eventType: 'AUTH_PASSWORD_RESET_REQ',
      category: 'AUTH',
      actorEmail: targetEmail,
      actorRole: user.role || 'Student',
      targetUserEmail: targetEmail,
      summary: `Password reset verification challenge requested for ${targetEmail}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.get('user-agent') || ''
    });

    return res.json({
      success: true,
      message: 'A 6-digit recovery code has been sent to your registered SPIT email address.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'A server error occurred while processing your request. Please try again later.' });
  }
});

// 2. Verify 6-digit Reset Code
app.post(['/api/auth/verify-reset-code', '/api/users/verify-reset-code'], async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!code || (typeof code !== 'string' && typeof code !== 'number')) {
      return res.status(400).json({ error: 'Verification code is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({ error: 'Verification code must be exactly 6 digits.', code: 'INVALID_FORMAT' });
    }

    // Find active challenge
    const challenge = await PasswordResetChallenge.findOne({
      email: normalizedEmail,
      status: { $in: ['pending', 'locked'] }
    }).sort({ createdAt: -1 });

    if (!challenge) {
      return res.status(400).json({
        error: 'Verification code has expired or is invalid. Please request a new code.',
        code: 'CODE_EXPIRED'
      });
    }

    // Check if attempts already exhausted or locked
    if (challenge.status === 'locked' || challenge.attempts >= 5) {
      challenge.status = 'locked';
      await challenge.save();
      return res.status(429).json({
        error: 'Too many incorrect attempts. This code is locked. Please request a new code.',
        code: 'MAX_ATTEMPTS_EXCEEDED'
      });
    }

    // Check expiration
    if (new Date() > new Date(challenge.expiresAt)) {
      challenge.status = 'expired';
      await challenge.save();
      return res.status(400).json({
        error: 'Verification code has expired. Please request a new code.',
        code: 'CODE_EXPIRED'
      });
    }

    // Validate HMAC of code using timingSafeEqual
    const calculatedHash = crypto.createHmac('sha256', RESET_SECRET).update(cleanCode).digest('hex');
    const calcBuf = Buffer.from(calculatedHash, 'hex');
    const expBuf = Buffer.from(challenge.codeHash, 'hex');

    const isMatch = calcBuf.length === expBuf.length && crypto.timingSafeEqual(calcBuf, expBuf);

    if (!isMatch) {
      challenge.attempts += 1;
      if (challenge.attempts >= 5) {
        challenge.status = 'locked';
      }
      await challenge.save();

      const remaining = Math.max(0, 5 - challenge.attempts);
      if (remaining === 0) {
        return res.status(429).json({
          error: 'Too many incorrect attempts. This code has been locked. Please request a new code.',
          code: 'MAX_ATTEMPTS_EXCEEDED',
          remainingAttempts: 0
        });
      }
      return res.status(400).json({
        error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        code: 'INVALID_CODE',
        remainingAttempts: remaining
      });
    }

    // Code matched! Generate single-use reset authorization token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    challenge.status = 'verified';
    challenge.resetTokenHash = resetTokenHash;
    challenge.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins to set password
    await challenge.save();

    return res.json({
      message: 'Code verified successfully.',
      resetToken
    });
  } catch (err) {
    console.error('Verify reset code error:', err);
    return res.status(500).json({ error: 'A server error occurred while verifying the code. Please try again later.' });
  }
});

// 3. Reset Password with Authorized Token
app.post(['/api/auth/reset-password', '/api/users/reset-password'], async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!resetToken || typeof resetToken !== 'string' || !resetToken.trim()) {
      return res.status(400).json({ error: 'Reset authorization token is required.' });
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required.' });
    }
    if (newPassword.length < 6 || newPassword.length > 100) {
      return res.status(400).json({ error: 'Password must be between 6 and 100 characters.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanToken = resetToken.trim();
    const resetTokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    // Atomically find and consume the token to prevent race conditions or replay attacks
    const challenge = await PasswordResetChallenge.findOneAndUpdate(
      {
        email: normalizedEmail,
        resetTokenHash,
        consumed: false,
        status: 'verified',
        resetTokenExpiresAt: { $gt: new Date() }
      },
      {
        $set: {
          consumed: true,
          status: 'consumed'
        }
      },
      { new: true }
    );

    if (!challenge) {
      return res.status(400).json({
        error: 'Invalid, expired, or already used reset authorization token. Please restart password recovery.',
        code: 'INVALID_TOKEN'
      });
    }

    const user = await User.findOne({ 
      $or: [
        { email: normalizedEmail },
        { email: new RegExp('^' + escapeRegExp(normalizedEmail) + '$', 'i') }
      ]
    });
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    userAuthCache.invalidate(normalizedEmail);
    await sessionService.revokeOtherSessions(normalizedEmail, null);

    activityService.logActivity({
      eventType: 'AUTH_PASSWORD_RESET_SUCCESS',
      category: 'AUTH',
      actorEmail: normalizedEmail,
      actorRole: user.role || 'Student',
      targetUserEmail: normalizedEmail,
      summary: `Password successfully reset via recovery token for ${normalizedEmail}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.get('user-agent') || ''
    });

    return res.json({
      message: 'Password reset successfully. You may now log in with your new password.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'A server error occurred while resetting your password. Please try again later.' });
  }
});

app.post('/api/users/register-request', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    
    // Type and length validation
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input types.' });
    }
    if (email.length > 100 || password.length > 100) {
      return res.status(400).json({ error: 'Inputs exceed maximum permitted length.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    
    const existingUser = await User.findOne({ email: new RegExp('^' + escapeRegExp(trimmedEmail) + '$', 'i') });
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered. Please try logging in.' });
    }
    
    const hashedPassword = await bcrypt.hash(password.trim(), 10);

    const user = await User.create({
      email: trimmedEmail,
      password: hashedPassword,
      role: 'Student',
      status: 'Pending',
      onboarded: false
    });
    
    res.status(201).json({ message: 'Registration request submitted successfully.', user: sanitizeUser(user) });
  } catch (err) {
    return handleRegistrationError(err, 'Standard Registration', res);
  }
});

app.post('/api/users/:email/approve-registration', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    user.status = 'Active';
    await user.save();
    userAuthCache.invalidate(email);
    
    res.json({ message: 'User registration approved successfully.', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:email', authenticateToken, async (req, res) => {
  try {
    const email = req.params.email;
    
    // Authorization Check: Admin can edit anyone, users can only edit themselves
    const isUserAdmin = req.user.email.toLowerCase() === 'admin@spit.ac.in' || req.user.role === 'Administrator' || req.user.role === 'Admin';
    if (!isUserAdmin && req.user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Access denied. You can only update your own profile.' });
    }

    const { name, role, branch, currentYear, status, password, nameColor, username } = req.body;

    // Input size limits
    if (name !== undefined && (typeof name !== 'string' || name.length > 200)) {
      return res.status(400).json({ error: 'Invalid name.' });
    }
    if (role !== undefined && (typeof role !== 'string' || role.length > 100)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (branch !== undefined && (typeof branch !== 'string' || branch.length > 100)) {
      return res.status(400).json({ error: 'Invalid branch.' });
    }
    if (password !== undefined && (typeof password !== 'string' || password.length > 100)) {
      return res.status(400).json({ error: 'Invalid password.' });
    }
    if (nameColor !== undefined && typeof nameColor === 'string' && nameColor.length > 50) {
      return res.status(400).json({ error: 'Invalid name color format.' });
    }
    
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    if (username !== undefined) {
      if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Invalid username.' });
      }
      const trimmedUsername = username.trim();
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmedUsername)) {
        return res.status(400).json({ error: 'Username must be 3-30 characters and contain only letters, numbers, underscores, or hyphens.' });
      }
      const existingUserWithUsername = await User.findOne({
        username: new RegExp('^' + escapeRegExp(trimmedUsername) + '$', 'i'),
        email: { $ne: user.email }
      });
      if (existingUserWithUsername) {
        return res.status(400).json({ error: 'Username is already taken. Please choose another username.' });
      }
      user.username = sanitizeString(trimmedUsername);
    }

    if (name !== undefined) user.name = sanitizeString(name.trim());
    if (branch !== undefined) user.branch = sanitizeString(branch.trim());
    if (currentYear !== undefined) user.currentYear = sanitizeString(String(currentYear).trim());
    if (nameColor !== undefined) user.nameColor = sanitizeString(nameColor.trim());
    
    // Status can only be changed by Admin
    if (status !== undefined && isUserAdmin) {
      user.status = status;
    }
    
    // Hash password if modified
    let passwordChanged = false;
    if (password !== undefined && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
      passwordChanged = true;
    }
    
    // Prevent changing admin's role, and only allow Admins to change user roles
    if (role !== undefined) {
      if (!isUserAdmin) {
        return res.status(403).json({ error: 'Only Administrators can change user roles.' });
      }
      if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
        user.role = sanitizeString(role.trim());
      }
    }
    
    await user.save();
    userAuthCache.invalidate(email);

    if (passwordChanged) {
      await sessionService.revokeOtherSessions(user.email, req.sessionId || req.user?.sessionId || null);
    }
    if (status !== undefined && isUserAdmin && status !== 'Active') {
      await sessionService.revokeOtherSessions(user.email, null);
    }

    if (passwordChanged) {
      activityService.logActivity({
        eventType: 'AUTH_PASSWORD_CHANGE',
        category: 'AUTH',
        actorEmail: req.user.email,
        actorRole: req.user.role,
        targetType: 'User',
        targetId: user._id,
        targetUserEmail: user.email,
        summary: `${req.user.email} changed password for ${user.email}`,
        outcome: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { targetEmail: user.email }
      });
    }

    activityService.logActivity({
      eventType: isUserAdmin && email.trim().toLowerCase() !== req.user.email.toLowerCase() ? 'ADMIN_ACTION' : 'PROFILE_UPDATE',
      category: isUserAdmin && email.trim().toLowerCase() !== req.user.email.toLowerCase() ? 'ADMIN' : 'PROFILE',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'User',
      targetId: user._id,
      targetUserEmail: user.email,
      summary: `Updated profile for ${user.email}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { targetEmail: user.email, updatedFields: Object.keys(req.body).filter(k => k !== 'password') }
    });
    
    res.json({ message: 'User updated successfully.', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:email/onboard', authenticateToken, async (req, res) => {
  try {
    const email = req.params.email;
    
    // Authorization Check: A user can only onboard themselves
    if (req.user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Access denied. You can only onboard your own profile.' });
    }

    const { name, role, branch, currentYear } = req.body;
    
    if (!name || !role || !branch || !currentYear) {
      return res.status(400).json({ error: 'Name, role, branch, and current year are all required for onboarding.' });
    }
    
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    user.name = sanitizeString(name.trim());
    // Restrict onboard roles to authorized student/alumni roles to prevent privilege escalation
    const ALLOWED_ONBOARD_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];
    if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
      const sanitizedRole = sanitizeString(role.trim());
      if (!ALLOWED_ONBOARD_ROLES.includes(sanitizedRole)) {
        return res.status(400).json({ error: 'Invalid onboarding role selected. Administrative roles cannot be self-assigned.' });
      }
      user.role = sanitizedRole;
    } else {
      user.role = 'Administrator';
    }
    user.branch = sanitizeString(branch.trim());
    user.currentYear = sanitizeString(currentYear.trim());
    user.onboarded = true;
    
    await user.save();
    userAuthCache.invalidate(email);

    activityService.logActivity({
      eventType: 'ONBOARDING_COMPLETE',
      category: 'PROFILE',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'User',
      targetId: user._id,
      summary: `User completed onboarding: ${user.email} (${user.role})`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || ''
    });
    
    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    const activeToken = req.headers['authorization']?.split(' ')[1];
    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: user.onboarded,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token: activeToken || undefined,
      sessionId: req.sessionId || undefined
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    // Block deleting the root admin
    if (email.trim().toLowerCase() === 'admin@spit.ac.in') {
      return res.status(400).json({ error: 'Root administrator account cannot be deleted.' });
    }
    const cleanEmail = email.trim().toLowerCase();
    await User.deleteOne({ email: new RegExp('^' + escapeRegExp(cleanEmail) + '$', 'i') });
    userAuthCache.invalidate(cleanEmail);
    await sessionService.revokeOtherSessions(cleanEmail, null);

    activityService.logActivity({
      eventType: 'USER_DELETE',
      category: 'ADMIN',
      actorEmail: req.user?.email || 'admin@spit.ac.in',
      actorRole: req.user?.role || 'Administrator',
      targetType: 'User',
      targetId: '',
      targetUserEmail: cleanEmail,
      summary: `Admin deleted platform user ${cleanEmail}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.get('user-agent') || '',
      metadata: { deletedEmail: cleanEmail }
    });

    res.json({ message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:email/edit-request', authenticateToken, async (req, res) => {
  try {
    const email = req.params.email;
    
    // Authorization Check: A user can only submit edit request for themselves
    if (req.user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return res.status(403).json({ error: 'Access denied. You can only request edits for your own profile.' });
    }

    const { name, role, branch, currentYear, nameColor } = req.body;
    
    if (!name || !role || !branch || !currentYear) {
      return res.status(400).json({ error: 'Name, role, branch, and current year are all required.' });
    }
    
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Set pending fields
    user.pendingName = sanitizeString(name.trim());
    // Restrict requested roles to non-administrative roles to prevent privilege escalation
    const ALLOWED_REQUEST_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];
    if (email.trim().toLowerCase() !== 'admin@spit.ac.in') {
      const sanitizedRole = sanitizeString(role.trim());
      if (!ALLOWED_REQUEST_ROLES.includes(sanitizedRole)) {
        return res.status(400).json({ error: 'Invalid role requested. Administrative roles cannot be requested via profile edits.' });
      }
      user.pendingRole = sanitizedRole;
    } else {
      user.pendingRole = 'Administrator';
    }
    user.pendingBranch = sanitizeString(branch.trim());
    user.pendingCurrentYear = sanitizeString(currentYear.trim());
    if (nameColor !== undefined) {
      user.pendingNameColor = sanitizeString(nameColor.trim());
    }
    user.hasPendingEdit = true;
    
    await user.save();
    
    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: user.onboarded,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor,
      pendingName: user.pendingName,
      pendingRole: user.pendingRole,
      pendingBranch: user.pendingBranch,
      pendingCurrentYear: user.pendingCurrentYear,
      pendingNameColor: user.pendingNameColor,
      hasPendingEdit: user.hasPendingEdit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:email/approve-edit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    if (!user.hasPendingEdit) {
      return res.status(400).json({ error: 'No pending edit request found for this user.' });
    }
    
    // Copy pending fields to active fields
    user.name = user.pendingName;
    user.role = user.pendingRole;
    user.branch = user.pendingBranch;
    user.currentYear = user.pendingCurrentYear;
    if (user.pendingNameColor !== undefined) {
      user.nameColor = user.pendingNameColor;
    }
    
    // Clear pending fields
    user.pendingName = '';
    user.pendingRole = '';
    user.pendingBranch = '';
    user.pendingCurrentYear = '';
    user.pendingNameColor = '';
    user.hasPendingEdit = false;
    
    await user.save();
    userAuthCache.invalidate(email);
    
    res.json({ message: 'User profile edit approved successfully.', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:email/reject-edit', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const email = req.params.email;
    
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Clear pending fields
    user.pendingName = '';
    user.pendingRole = '';
    user.pendingBranch = '';
    user.pendingCurrentYear = '';
    user.pendingNameColor = '';
    user.hasPendingEdit = false;
    
    await user.save();
    userAuthCache.invalidate(email);
    
    res.json({ message: 'User profile edit rejected successfully.', user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to validate story payload files
function validateStoryFiles(payload) {
  if (payload.photo && !validateFileUri(payload.photo, ALLOWED_IMAGE_PREFIXES)) {
    return 'Invalid story profile photo file format. Only JPEG, PNG, and WebP images are allowed.';
  }
  if (payload.resumeFile && payload.resumeFile.url && !validateFileUri(payload.resumeFile.url, ALLOWED_PDF_PREFIXES)) {
    return 'Invalid resume file format. Only PDF documents are allowed.';
  }
  if (payload.studyMaterials && Array.isArray(payload.studyMaterials)) {
    for (const material of payload.studyMaterials) {
      if (material.url && !validateFileUri(material.url, ALLOWED_DOC_PREFIXES)) {
        return `Invalid study material file format for "${material.title || 'unnamed'}". Only PDF and images are allowed.`;
      }
    }
  }
  return null;
}

// 3. Stories
app.get('/api/stories', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    if (!isUserAdmin(req.user)) {
      const visibility = await getSectionVisibility();
      if (!visibility.stories) {
        return res.status(404).json({ error: 'Stories section is currently unavailable', code: 'SECTION_DISABLED' });
      }
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    if (isPaginated) {
      const cacheKey = cacheService.makeKey('stories:list', `p_${page}_l_${limit}`);
      const payload = await cacheService.getOrSet(cacheKey, async () => {
        const total = await Story.countDocuments({});
        const stories = await Story.find({})
          .sort({ createdAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .select('-journey -resumeFile -studyMaterials -customSections -photo -resume')
          .lean();
        return { stories, total };
      }, cacheService.DEFAULT_TTLS.stories);

      // Redact private email if unauthenticated
      if (!req.user && payload && Array.isArray(payload.stories)) {
        payload.stories.forEach(s => { delete s.uploadedByEmail; });
      }

      return sendPaginatedResponse(res, payload.stories, payload.total, page, limit);
    }

    // Exclude heavy fields from the listing payload and sort newest first with deterministic order
    const cacheKey = cacheService.makeKey('stories:list', 'all');
    let stories = await cacheService.getOrSet(cacheKey, async () => {
      return await Story.find({})
        .sort({ createdAt: -1, _id: -1 })
        .select('-journey -resumeFile -studyMaterials -customSections -photo -resume')
        .lean();
    }, cacheService.DEFAULT_TTLS.stories);

    // Redact private email if unauthenticated
    if (!req.user && Array.isArray(stories)) {
      stories = stories.map(s => {
        const copy = { ...s };
        delete copy.uploadedByEmail;
        return copy;
      });
    }

    res.set('X-Total-Count', String(stories.length));
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/stories/:id', '/api/pending-stories/:id'], authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeString(id);
    const isPendingRoute = req.path.includes('/pending-stories/');

    const cacheKey = cacheService.makeKey('stories:detail', sanitizedId);

    const story = await cacheService.getOrSet(cacheKey, async () => {
      const query = mongoose.Types.ObjectId.isValid(sanitizedId)
        ? { $or: [{ id: sanitizedId }, { _id: sanitizedId }] }
        : { id: sanitizedId };
      let doc = await Story.findOne(query).lean();
      if (!doc) {
        doc = await PendingStory.findOne(query).lean();
      }
      return doc;
    }, cacheService.DEFAULT_TTLS.storyDetail);

    if (!story) {
      return res.status(404).json({ error: 'Story not found.' });
    }

    if (!isPendingRoute && story.status !== 'pending' && !isUserAdmin(req.user)) {
      const visibility = await getSectionVisibility();
      if (!visibility.stories) {
        return res.status(404).json({ error: 'Stories section is currently unavailable', code: 'SECTION_DISABLED' });
      }
    }

    if (story.status === 'pending' || isPendingRoute) {
      if (!req.user) {
        return res.status(401).json({ error: 'Access token is required. Please login.', code: 'TOKEN_MISSING' });
      }
      const isAdmin = isUserAdmin(req.user);
      const isAuthor = story.uploadedByEmail && req.user && (story.uploadedByEmail.toLowerCase() === req.user.email.toLowerCase());
      if (!isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Access denied to pending story.' });
      }
    }

    // If request is unauthenticated, redact private contact and protect raw resume download
    if (!req.user) {
      const publicDoc = { ...story };
      delete publicDoc.uploadedByEmail;
      delete publicDoc.resume;
      if (publicDoc.resumeFile) {
        publicDoc.resumeFile = {
          fileName: publicDoc.resumeFile.fileName,
          fileSize: publicDoc.resumeFile.fileSize,
          requiresAuth: true
        };
      }
      return res.json(publicDoc);
    }

    res.json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stories', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    const { name, branch } = req.body;
    // Required field check
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Story name is required.' });
    }
    if (name.length > 300) {
      return res.status(400).json({ error: 'Story name is too long.' });
    }
    if (branch && (typeof branch !== 'string' || branch.length > 100)) {
      return res.status(400).json({ error: 'Invalid branch value.' });
    }

    // MIME type check
    const fileError = validateStoryFiles(req.body);
    if (fileError) {
      return res.status(400).json({ error: fileError });
    }

    const processedBody = processStoryFiles(req.body);
    const sanitizedBody = sanitizeObject({ ...processedBody });
    sanitizedBody.name = name.trim();
    if (!sanitizedBody.id) sanitizedBody.id = String(Date.now());

    const story = await Story.create(sanitizedBody);
    await cacheService.invalidateStories().catch(() => {});
    res.status(201).json(story);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/stories/:id', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    const fileError = validateStoryFiles(req.body);
    if (fileError) {
      return res.status(400).json({ error: fileError });
    }

    const processedBody = processStoryFiles(req.body);
    const sanitizedBody = sanitizeObject({ ...processedBody });
    const story = await Story.findOneAndUpdate({ id: req.params.id }, sanitizedBody, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found.' });
    await cacheService.invalidateStories(req.params.id).catch(() => {});
    res.json(story);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/stories/:id', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    await Story.deleteOne({ id: req.params.id });
    await cacheService.invalidateStories(req.params.id).catch(() => {});
    res.json({ message: 'Story deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Pending Stories
app.get('/api/pending-stories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await PendingStory.find({}).sort({ createdAt: -1 }).lean();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-stories', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const fileError = validateStoryFiles(req.body);
    if (fileError) {
      return res.status(400).json({ error: fileError });
    }

    const processedBody = processStoryFiles(req.body);
    const pendingData = sanitizeObject({ ...processedBody });
    if (!pendingData.id) pendingData.id = String(Date.now());
    
    // Set uploadedByEmail early
    pendingData.uploadedByEmail = req.user.email;

    // Prevent duplicate submissions of the same story by the same user
    if (pendingData.requestType === 'add') {
      const existing = await PendingStory.findOne({
        name: pendingData.name,
        company: pendingData.company,
        uploadedByEmail: pendingData.uploadedByEmail,
        status: 'pending'
      });
      if (existing) {
        return res.status(400).json({ error: 'You have already submitted a placement story for this company that is pending approval.' });
      }
    }

    if (pendingData.requestType === 'edit' || pendingData.requestType === 'delete') {
      pendingData.activeId = pendingData.id;
      // Assign a temporary new ID for the pending entry so it doesn't conflict
      pendingData.id = String(Date.now());
    }

    const pending = await PendingStory.create(pendingData);

    activityService.logActivity({
      eventType: 'CONTENT_STORY_SUBMIT',
      category: 'CONTENT',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Story',
      targetId: pending.id,
      targetUserEmail: req.user.email,
      summary: `Submitted story for ${pending.company || 'Company'} (${pending.name || 'Placement'})`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { company: pending.company, role: pending.role, requestType: pending.requestType }
    });

    res.status(201).json(pending);
  } catch (err) {
    console.error("Error in POST /api/pending-stories:", err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/pending-stories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const pending = await PendingStory.findOne(query);
    await PendingStory.deleteOne(query);

    await cacheService.invalidateStories(pending?.activeId || pending?.id || id).catch(() => {});
    if (pending?._id) {
      await cacheService.del(cacheService.makeKey('stories:detail', String(pending._id))).catch(() => {});
    }

    if (pending) {
      activityService.logActivity({
        eventType: 'CONTENT_STORY_REJECT',
        category: 'ADMIN',
        actorEmail: req.user.email,
        actorRole: req.user.role,
        targetType: 'Story',
        targetId: pending.id || id,
        targetUserEmail: pending.uploadedByEmail || '',
        summary: `Admin rejected pending story for ${pending.company || 'Company'} by ${pending.uploadedByEmail || 'user'}`,
        outcome: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { company: pending.company, uploadedByEmail: pending.uploadedByEmail }
      });
    }

    res.json({ message: 'Pending story rejected/deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-stories/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const pending = await PendingStory.findOne(query);
    if (!pending) return res.status(404).json({ error: 'Pending story not found.' });

    if (pending.requestType === 'delete') {
      await Story.deleteOne({ id: pending.activeId });
    } else if (pending.requestType === 'edit') {
      const storyObj = pending.toObject();
      const activeId = storyObj.activeId;
      
      delete storyObj._id;
      delete storyObj.__v;
      delete storyObj.status;
      delete storyObj.requestType;
      delete storyObj.activeId;
      
      storyObj.id = activeId;
      await Story.findOneAndUpdate({ id: activeId }, storyObj, { new: true });
    } else {
      const storyObj = pending.toObject();
      
      delete storyObj._id;
      delete storyObj.__v;
      delete storyObj.status;
      
      await Story.create(storyObj);
    }

    await PendingStory.deleteOne({ _id: pending._id });
    await cacheService.invalidateStories(pending.activeId || pending.id || id).catch(() => {});
    if (pending._id) {
      await cacheService.del(cacheService.makeKey('stories:detail', String(pending._id))).catch(() => {});
    }

    activityService.logActivity({
      eventType: 'CONTENT_STORY_APPROVE',
      category: 'ADMIN',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Story',
      targetId: pending.activeId || pending.id,
      targetUserEmail: pending.uploadedByEmail || '',
      summary: `Admin approved story for ${pending.company || 'Company'} (${pending.name || 'Placement'})`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { company: pending.company, uploadedByEmail: pending.uploadedByEmail }
    });

    res.json({ message: 'Story approved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Administrator System Diagnostics & Health Endpoints ---
app.get('/api/admin/diagnostics/system-health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const forceFresh = req.query.fresh === 'true';
    const healthReport = await generateFullSystemHealth(apiMetrics, userAuthCache, forceFresh);
    res.json(healthReport);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate system diagnostics: ' + err.message });
  }
});

app.post('/api/admin/diagnostics/db-probe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const probeStart = Date.now();
    const verifiedAt = recordWriteVerification();
    const hasDb = mongoose.connection && mongoose.connection.db;
    const pingResult = hasDb ? await mongoose.connection.db.admin().ping().catch(e => ({ ok: 0, error: e.message })) : { ok: 1 };
    const durationMs = Date.now() - probeStart;
    res.json({
      success: pingResult.ok === 1 || pingResult.ok === true,
      verifiedAt,
      durationMs,
      message: 'Database write verification probe completed.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Database probe failed: ' + err.message });
  }
});

// Admin Resources Statistics
app.get('/api/admin/resources-stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalFolders = await Folder.countDocuments({});
    const systemFolders = await Folder.countDocuments({ folderType: 'system' });
    const publicFolders = await Folder.countDocuments({ folderType: 'user', visibility: 'public' });
    const privateFolders = await Folder.countDocuments({ folderType: 'user', visibility: 'private' });
    
    const totalResources = await Resource.countDocuments({});
    const pendingResources = await PendingResource.countDocuments({ status: 'pending' });

    // Aggregate total storage used
    const storageAgg = await Resource.aggregate([
      { $group: { _id: null, totalBytes: { $sum: '$size' } } }
    ]);
    const totalBytes = storageAgg.length > 0 ? storageAgg[0].totalBytes : 0;

    res.json({
      totalFolders,
      systemFolders,
      publicFolders,
      privateFolders,
      totalResources,
      pendingResources,
      totalBytes,
      totalStorageFormatted: StorageService.formatBytes(totalBytes)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// SECTION VISIBILITY CONTROLS API
// Public fetch & Admin update with audit logging and cache invalidation
// =========================================================================

// Public endpoint to retrieve current global section visibility
app.get('/api/settings/visibility', optionalAuthenticateToken, async (req, res) => {
  try {
    const visibility = await getSectionVisibility();
    res.json(visibility);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve visibility settings: ' + err.message });
  }
});

// Admin-only endpoint to update section visibility toggles
app.put('/api/admin/settings/visibility', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { stories, resources, achievements } = req.body || {};
    if (typeof stories !== 'boolean' || typeof resources !== 'boolean' || typeof achievements !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid input. stories, resources, and achievements must all be boolean values.'
      });
    }

    const updated = await SystemSetting.findOneAndUpdate(
      { key: 'section_visibility' },
      { key: 'section_visibility', value: { stories, resources, achievements } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Invalidate cached visibility & sitemap
    await cacheService.del(cacheService.makeKey('settings', 'section_visibility')).catch(() => {});
    await cacheService.del(cacheService.makeKey('seo', 'sitemap_xml')).catch(() => {});

    activityService.logActivity({
      eventType: 'ADMIN_SETTING_UPDATE',
      category: 'ADMIN',
      actorEmail: req.user.email,
      actorRole: req.user.role || 'Administrator',
      summary: `Updated section visibility: Stories=${stories ? 'ON' : 'OFF'}, Resources=${resources ? 'ON' : 'OFF'}, Achievements=${achievements ? 'ON' : 'OFF'}`,
      metadata: { stories, resources, achievements }
    });

    res.json({
      message: 'Public section visibility updated successfully',
      visibility: {
        stories: Boolean(updated.value.stories),
        resources: Boolean(updated.value.resources),
        achievements: Boolean(updated.value.achievements)
      }
    });
  } catch (err) {
    console.error('[SETTINGS_UPDATE_ERROR]', err);
    res.status(500).json({ error: 'Failed to update visibility settings: ' + err.message });
  }
});

// =========================================================================
// MONGODB GRIDFS PARALLEL CHUNKED UPLOAD ARCHITECTURE (Up to 200 MB)
// Explicit routes registered BEFORE any generic /api/resources/:id routes
// =========================================================================

const handleUploadInit = async (req, res) => {
  try {
    const { fileName, fileSize, mimeType, folderId, title, description, category, semester, year, tags } = req.body;

    if (!fileName || !fileSize) {
      return res.status(400).json({ error: 'fileName and fileSize are required.' });
    }

    const numSize = Number(fileSize);
    if (isNaN(numSize) || numSize <= 0) {
      return res.status(400).json({ error: 'Invalid file size.' });
    }

    if (numSize > StorageService.MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File exceeds the maximum allowed size of 200 MB.' });
    }

    if (!StorageService.isAllowedFile({ filename: fileName, mimeType })) {
      return res.status(400).json({
        error: 'Unsupported file type. Please upload an educational document (PDF, DOCX, TXT), spreadsheet, presentation, image, archive (ZIP), or code file.'
      });
    }

    const resolvedFolderId = folderId || 'system-placement-material';
    const folder = await Folder.findOne({ id: resolvedFolderId });
    if (!folder) {
      return res.status(404).json({ error: 'Selected destination folder does not exist.' });
    }

    const isAdmin = req.user && (req.user.role === 'Admin' || req.user.role === 'Administrator' || req.user.email.toLowerCase() === 'admin@spit.ac.in');
    const isOwner = folder && (folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id)));

    if (folder.visibility === 'private' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You cannot upload to another user private folder.' });
    }

    const isPending = !isAdmin;
    const chunkSize = StorageService.calculateOptimalChunkSize(numSize);
    const totalChunks = Math.ceil(numSize / chunkSize);
    const uploadId = `up_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    const session = await UploadSession.create({
      uploadId,
      fileName,
      fileSize: numSize,
      mimeType: mimeType || 'application/octet-stream',
      chunkSize,
      totalChunks,
      folderId: resolvedFolderId,
      title: (title && title.trim()) || fileName.replace(/\.[^/.]+$/, ''),
      description: description || '',
      category: category || 'General',
      semester: semester || '',
      year: year || '',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : []),
      ownerId: req.user.id,
      uploadedBy: req.user.name || req.user.email,
      uploadedByEmail: req.user.email,
      isPending
    });

    res.status(200).json({
      success: true,
      uploadId: session.uploadId,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      concurrency: StorageService.GRIDFS_UPLOAD_CONCURRENCY,
      message: 'Upload session initialized successfully'
    });
  } catch (err) {
    console.error('Upload init error:', err);
    res.status(500).json({ error: err.message || 'Failed to initialize upload session.' });
  }
};

const handleUploadChunkPut = async (req, res) => {
  try {
    const uploadId = req.headers['x-upload-id'] || req.query.uploadId;
    const chunkIndex = parseInt(req.headers['x-chunk-index'] ?? req.query.chunkIndex, 10);
    const expectedSize = req.headers['x-chunk-size'] ? parseInt(req.headers['x-chunk-size'], 10) : undefined;

    if (!uploadId || isNaN(chunkIndex)) {
      return res.status(400).json({ error: 'x-upload-id and x-chunk-index headers are required.' });
    }

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found or expired.' });
    }

    if (session.isFinalized) {
      return res.status(400).json({ error: 'Upload session is already finalized.' });
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      return res.status(400).json({ error: `Invalid chunk index ${chunkIndex}. Expected 0 to ${session.totalChunks - 1}.` });
    }

    const result = await StorageService.saveTempChunk({
      uploadId,
      chunkIndex,
      chunkStream: req,
      expectedSize
    });

    res.status(200).json({
      success: true,
      chunkIndex: result.chunkIndex,
      size: result.size,
      duplicate: result.duplicate
    });
  } catch (err) {
    console.error('Chunk upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to store upload chunk.' });
  }
};

const handleUploadChunkPost = async (req, res) => {
  if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
    try {
      const bb = busboy({ headers: req.headers, highWaterMark: 4 * 1024 * 1024 });
      let uploadId = req.headers['x-upload-id'] || req.query.uploadId;
      let chunkIndex = req.headers['x-chunk-index'] ? parseInt(req.headers['x-chunk-index'], 10) : undefined;
      let chunkPromise = null;

      bb.on('field', (name, val) => {
        if (name === 'uploadId') uploadId = val;
        if (name === 'chunkIndex') chunkIndex = parseInt(val, 10);
      });

      bb.on('file', (name, fileStream) => {
        if (!uploadId || chunkIndex === undefined || isNaN(chunkIndex)) {
          fileStream.resume();
          return;
        }
        chunkPromise = StorageService.saveTempChunk({
          uploadId,
          chunkIndex,
          chunkStream: fileStream
        });
      });

      bb.on('finish', async () => {
        if (!chunkPromise) {
          return res.status(400).json({ error: 'No chunk file received or missing uploadId/chunkIndex.' });
        }
        try {
          const result = await chunkPromise;
          res.status(200).json({ success: true, chunkIndex: result.chunkIndex, size: result.size });
        } catch (err) {
          res.status(500).json({ error: err.message });
        }
      });

      req.pipe(bb);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } else {
    return handleUploadChunkPut(req, res);
  }
};

const handleUploadStatus = async (req, res) => {
  try {
    const { uploadId } = req.params;
    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found.' });
    }

    if (session.isFinalized) {
      const Model = session.isPending ? PendingResource : Resource;
      const resource = await Model.findOne({ id: session.finalResourceId });
      return res.status(200).json({
        uploadId,
        isFinalized: true,
        resource
      });
    }

    const { uploadedChunks, totalUploadedBytes } = await StorageService.getUploadedChunkIndexes(uploadId);
    res.status(200).json({
      uploadId,
      isFinalized: false,
      totalChunks: session.totalChunks,
      chunkSize: session.chunkSize,
      uploadedChunks,
      totalUploadedBytes,
      fileName: session.fileName,
      fileSize: session.fileSize
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const FINALIZATION_LEASE_MS = 60 * 1000; // 60-second time-limited lease for recovery after crashes

/**
 * Safely delete a GridFS file only if it is genuinely orphaned and not adopted
 * by a newer worker generation or referenced by any active/pending resource, story, or session.
 */
async function safeDeleteGridFSFileIfOrphaned(fileId, uploadId) {
  if (!fileId) return false;
  try {
    const rawId = String(fileId).replace(/^gridfs:/, '');
    if (!mongoose.Types.ObjectId.isValid(rawId)) return false;
    const oid = new mongoose.Types.ObjectId(rawId);

    // 1. Check if the latest UploadSession in the database has adopted or is actively using this file
    if (uploadId) {
      const currentSession = await UploadSession.findOne({ uploadId }).lean();
      if (currentSession) {
        // If adopted as finalGridFsId by any generation -> never delete!
        if (currentSession.finalGridFsId && String(currentSession.finalGridFsId) === String(rawId)) {
          return false;
        }
        // If the session is still active/unfinalized, check if this is a complete, valid assembled file
        // that a newer worker generation can adopt via Crash Window C recovery
        if (!currentSession.isFinalized && currentSession.expiresAt && new Date(currentSession.expiresAt) > new Date()) {
          const finalBucket = StorageService.getGridFSBucket();
          const files = await finalBucket.find({ _id: oid }).limit(1).toArray();
          if (files.length > 0 && currentSession.fileSize && files[0].length === currentSession.fileSize) {
            return false; // Valid complete file matching uploadId - preserve for newer worker
          }
        }
      }
    }

    // 2. Check if referenced by any Resource
    const inResource = await Resource.exists({
      $or: [{ gridFsFileId: oid }, { storageKey: `gridfs:${rawId}` }, { storageKey: rawId }]
    });
    if (inResource) return false;

    // 3. Check if referenced by any PendingResource
    const inPendingResource = await PendingResource.exists({
      $or: [{ gridFsFileId: oid }, { storageKey: `gridfs:${rawId}` }, { storageKey: rawId }]
    });
    if (inPendingResource) return false;

    // 4. Check if referenced by any Story
    const inStory = await Story.exists({
      $or: [
        { 'resumeFile.gridFsFileId': oid },
        { 'resumeFile.storageKey': `gridfs:${rawId}` },
        { 'studyMaterials.gridFsFileId': oid },
        { 'studyMaterials.storageKey': `gridfs:${rawId}` }
      ]
    });
    if (inStory) return false;

    // 5. Check if referenced by any PendingStory
    const inPendingStory = await PendingStory.exists({
      $or: [
        { 'resumeFile.gridFsFileId': oid },
        { 'resumeFile.storageKey': `gridfs:${rawId}` },
        { 'studyMaterials.gridFsFileId': oid },
        { 'studyMaterials.storageKey': `gridfs:${rawId}` }
      ]
    });
    if (inPendingStory) return false;

    // 6. Check if referenced by any Feedback attachment
    const inFeedback = await Feedback.exists({ screenshotFileId: rawId });
    if (inFeedback) return false;

    // Truly unreferenced and orphaned: safely delete
    const finalBucket = StorageService.getGridFSBucket();
    await finalBucket.delete(oid).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[SafeDeleteGridFS] Error during orphan check:', err.message);
    return false;
  }
}

const handleUploadFinalize = async (req, res) => {
  let acquiredGeneration = null;
  let activeUploadId = null;
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required.' });
    }
    activeUploadId = uploadId;

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found.' });
    }

    // 1. Idempotency: if already finalized, return existing record immediately
    if (session.isFinalized && session.finalResourceId) {
      const Model = session.isPending ? PendingResource : Resource;
      const existingResource = await Model.findOne({ id: session.finalResourceId });
      if (existingResource) {
        return res.status(200).json({
          success: true,
          uploadId: session.uploadId,
          resourceId: existingResource.id,
          fileId: session.finalGridFsId || existingResource.gridFsFileId,
          message: 'Upload completed successfully',
          resource: existingResource,
          alreadyFinalized: true
        });
      }
    }

    const now = new Date();
    // 2. Concurrency protection: if another request holds an active, unexpired lease, wait briefly for completion
    const hasActiveLease = session.isFinalizing && session.leaseExpiresAt && new Date(session.leaseExpiresAt) > now;
    if (hasActiveLease) {
      let waitAttempts = 0;
      while (waitAttempts < 6) {
        await new Promise(r => setTimeout(r, 500));
        const refreshed = await UploadSession.findOne({ uploadId });
        if (refreshed && refreshed.isFinalized && refreshed.finalResourceId) {
          const Model = refreshed.isPending ? PendingResource : Resource;
          const resDoc = await Model.findOne({ id: refreshed.finalResourceId });
          if (resDoc) {
            return res.status(200).json({
              success: true,
              uploadId: refreshed.uploadId,
              resourceId: resDoc.id,
              fileId: refreshed.finalGridFsId || resDoc.gridFsFileId,
              message: 'Upload completed successfully',
              resource: resDoc,
              alreadyFinalized: true
            });
          }
        }
        // If lease expired during waiting, exit loop to allow immediate recovery acquisition
        if (!refreshed || !refreshed.isFinalizing || (refreshed.leaseExpiresAt && new Date(refreshed.leaseExpiresAt) <= new Date())) {
          break;
        }
        waitAttempts++;
      }
    }

    // 3. Atomically acquire or recover lease using Compare-And-Set + Generation Counter (Fencing Token)
    const leaseStartTime = new Date();
    const leaseExpiresAt = new Date(leaseStartTime.getTime() + FINALIZATION_LEASE_MS);

    const acquired = await UploadSession.findOneAndUpdate(
      {
        uploadId,
        isFinalized: false,
        $or: [
          { isFinalizing: false },
          { leaseExpiresAt: { $lt: leaseStartTime } },
          { isFinalizing: true, leaseExpiresAt: null }
        ]
      },
      {
        $set: {
          isFinalizing: true,
          finalizingAt: leaseStartTime,
          leaseExpiresAt: leaseExpiresAt
        },
        $inc: { finalizeGeneration: 1 }
      },
      { new: true }
    );

    if (!acquired) {
      // Recheck if finalized concurrently
      const checkFinal = await UploadSession.findOne({ uploadId });
      if (checkFinal && checkFinal.isFinalized && checkFinal.finalResourceId) {
        const Model = checkFinal.isPending ? PendingResource : Resource;
        const resDoc = await Model.findOne({ id: checkFinal.finalResourceId });
        if (resDoc) {
          return res.status(200).json({
            success: true,
            uploadId: checkFinal.uploadId,
            resourceId: resDoc.id,
            fileId: checkFinal.finalGridFsId || resDoc.gridFsFileId,
            message: 'Upload completed successfully',
            resource: resDoc,
            alreadyFinalized: true
          });
        }
      }
      return res.status(409).json({ error: 'Finalization already in progress with an active lease. Please retry shortly.' });
    }

    acquiredGeneration = acquired.finalizeGeneration;

    // 4. Check if final GridFS file was already assembled by a previous attempt that died before writing metadata
    let assembledFile = null;
    const finalBucket = StorageService.getGridFSBucket();

    if (acquired.finalGridFsId) {
      try {
        const existingFiles = await finalBucket.find({ _id: new mongoose.Types.ObjectId(acquired.finalGridFsId) }).limit(1).toArray();
        if (existingFiles && existingFiles.length > 0 && (!acquired.fileSize || existingFiles[0].length === acquired.fileSize)) {
          assembledFile = {
            storageKey: `gridfs:${acquired.finalGridFsId.toString()}`,
            gridFsFileId: acquired.finalGridFsId,
            fileId: acquired.finalGridFsId,
            fileName: existingFiles[0].filename || acquired.fileName,
            size: existingFiles[0].length || acquired.fileSize,
            contentType: existingFiles[0].contentType || acquired.mimeType
          };
        }
      } catch (checkErr) {}
    }

    // Recovery for Crash Window C: If a prior attempt assembled a complete file matching uploadId but crashed before recording finalGridFsId
    if (!assembledFile) {
      try {
        const priorAssembledFiles = await finalBucket.find({ 'metadata.uploadId': uploadId }).sort({ uploadDate: -1 }).toArray();
        if (priorAssembledFiles && priorAssembledFiles.length > 0) {
          for (const candidate of priorAssembledFiles) {
            if (!acquired.fileSize || candidate.length === acquired.fileSize) {
              assembledFile = {
                storageKey: `gridfs:${candidate._id.toString()}`,
                gridFsFileId: candidate._id,
                fileId: candidate._id,
                fileName: candidate.filename || acquired.fileName,
                size: candidate.length || acquired.fileSize,
                contentType: candidate.contentType || acquired.mimeType
              };
              break;
            } else {
              // Delete incomplete/corrupted file left behind by crashed attempt
              await finalBucket.delete(candidate._id).catch(() => {});
            }
          }
        }
      } catch (findErr) {}
    }

    // Assemble final GridFS file in exact chunk index order if not already assembled
    if (!assembledFile) {
      assembledFile = await StorageService.assembleFinalGridFSFile({
        uploadId,
        totalChunks: acquired.totalChunks,
        expectedFileSize: acquired.fileSize,
        fileName: acquired.fileName,
        mimeType: acquired.mimeType,
        metadata: {
          uploadId,
          finalizeGeneration: acquiredGeneration,
          uploadedBy: acquired.uploadedBy,
          uploadedByEmail: acquired.uploadedByEmail
        }
      });
    }

    // 5. Durably record finalGridFsId in UploadSession protected by current finalizeGeneration fencing token
    const sessionWithFile = await UploadSession.findOneAndUpdate(
      {
        uploadId,
        finalizeGeneration: acquiredGeneration,
        isFinalized: false
      },
      {
        $set: {
          finalGridFsId: assembledFile.gridFsFileId,
          assemblyCompletedAt: new Date()
        }
      },
      { new: true }
    );

    if (!sessionWithFile) {
      // Lease was superseded by a newer generation! Fenced non-destruction:
      // A superseded worker has lost its fencing token and must NEVER delete shared GridFS files during rollback,
      // because a newer worker may have already adopted or will adopt this complete file via Crash Window C recovery.
      // Truly orphaned files are safely cleaned up post-commit by the winning worker or by background pruning.

      // Check if finalized by winning generation
      const checkWinner = await UploadSession.findOne({ uploadId });
      if (checkWinner && checkWinner.isFinalized && checkWinner.finalResourceId) {
        const Model = checkWinner.isPending ? PendingResource : Resource;
        const resDoc = await Model.findOne({ id: checkWinner.finalResourceId });
        if (resDoc) {
          return res.status(200).json({
            success: true,
            uploadId: checkWinner.uploadId,
            resourceId: resDoc.id,
            fileId: checkWinner.finalGridFsId || resDoc.gridFsFileId,
            message: 'Upload completed successfully',
            resource: resDoc,
            alreadyFinalized: true
          });
        }
      }
      return res.status(409).json({ error: 'Finalization lease expired and was superseded by another attempt.' });
    }

    // 6. Persist final Resource or PendingResource (Idempotent & Concurrency-Safe)
    const targetModel = acquired.isPending ? PendingResource : Resource;

    // Check if an existing record was already created for this uploadId or gridFsFileId by an earlier attempt
    let createdRecord = await targetModel.findOne({
      $or: [
        { uploadId: acquired.uploadId },
        ...(assembledFile.gridFsFileId ? [{ gridFsFileId: assembledFile.gridFsFileId }] : [])
      ]
    });

    let wasReused = Boolean(createdRecord);

    if (!createdRecord) {
      const resourceId = String(Date.now());
      const detectedType = StorageService.getFileTypeCategory(acquired.mimeType, acquired.fileName);
      const resourceUrl = `/api/resources/${resourceId}/file`;
      const recordPayload = {
        id: resourceId,
        uploadId: acquired.uploadId,
        title: acquired.title || acquired.fileName.replace(/\.[^/.]+$/, ''),
        description: acquired.description || '',
        category: acquired.category || 'General',
        type: detectedType,
        originalFileName: acquired.fileName,
        mimeType: acquired.mimeType,
        size: assembledFile.size || acquired.fileSize,
        fileSizeFormatted: StorageService.formatBytes(assembledFile.size || acquired.fileSize),
        storageProvider: 'gridfs',
        storageKey: assembledFile.storageKey,
        gridFsFileId: assembledFile.gridFsFileId,
        url: resourceUrl,
        folderId: acquired.folderId,
        ownerId: acquired.ownerId,
        uploadedBy: acquired.uploadedBy,
        uploadedByEmail: acquired.uploadedByEmail,
        date: new Date().toISOString().split('T')[0],
        status: acquired.isPending ? 'pending' : 'approved',
        semester: acquired.semester,
        year: acquired.year,
        ...(acquired.isPending ? {} : { tags: acquired.tags || [] })
      };

      try {
        createdRecord = await targetModel.create(recordPayload);
      } catch (createErr) {
        // Concurrency protection: if another worker created it concurrently,
        // catch the duplicate key (E11000) and load the winning canonical record
        if (createErr.code === 11000 || (createErr.name === 'MongoServerError' && createErr.message.includes('E11000'))) {
          createdRecord = await targetModel.findOne({
            $or: [
              { uploadId: acquired.uploadId },
              ...(assembledFile.gridFsFileId ? [{ gridFsFileId: assembledFile.gridFsFileId }] : [])
            ]
          });
          if (!createdRecord) throw createErr;
          wasReused = true;
        } else {
          throw createErr;
        }
      }
    }

    const resourceId = createdRecord.id;

    // 7. Atomic fenced completion update
    const finalizedSession = await UploadSession.findOneAndUpdate(
      {
        uploadId,
        finalizeGeneration: acquiredGeneration,
        isFinalized: false
      },
      {
        $set: {
          isFinalized: true,
          isFinalizing: false,
          finalResourceId: resourceId,
          finalGridFsId: assembledFile.gridFsFileId,
          leaseExpiresAt: null
        }
      },
      { new: true }
    );

    if (!finalizedSession) {
      // Rollback created record ONLY if it was newly created by this worker and not reused from a previous/other worker
      if (!wasReused) {
        const Model = acquired.isPending ? PendingResource : Resource;
        await Model.deleteOne({ id: resourceId, uploadId: acquired.uploadId }).catch(() => {});
      }
      // Fenced non-destruction: do not delete assembled GridFS file during rollback.
      // The superseding generation may adopt or has adopted this file. Preserving for background/post-commit cleanup avoids TOCTOU race.
      return res.status(409).json({ error: 'Finalization generation superseded at commit.' });
    }

    // 8. Safely cleanup temporary chunks now that finalization is committed and published
    await StorageService.cleanupTempChunks(uploadId).catch((cleanErr) => {
      console.warn('[Finalize Cleanup Temp Chunks] Warning:', cleanErr.message);
    });

    // Prune any unreferenced duplicate GridFS files created for this uploadId that were not selected as final
    try {
      const finalBucket = StorageService.getGridFSBucket();
      const duplicateFiles = await finalBucket.find({
        'metadata.uploadId': uploadId,
        _id: { $ne: new mongoose.Types.ObjectId(assembledFile.gridFsFileId) }
      }).toArray();
      for (const dup of duplicateFiles) {
        await safeDeleteGridFSFileIfOrphaned(dup._id, uploadId);
      }
    } catch (dupErr) {
      console.warn('[Finalize Cleanup Duplicates] Warning:', dupErr.message);
    }

    const isModerated = Boolean(acquired.isPending);

    activityService.logActivity({
      eventType: 'CONTENT_RESOURCE_UPLOAD',
      category: 'CONTENT',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: isModerated ? 'PendingResource' : 'Resource',
      targetId: resourceId,
      summary: `Uploaded resource: ${acquired.fileName} (${isModerated ? 'Pending Moderation' : 'Approved'})`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { resourceId, fileName: acquired.fileName, size: assembledFile.size || acquired.fileSize, isModerated, finalizeGeneration: acquiredGeneration }
    });

    await cacheService.invalidateResources(resourceId).catch(() => {});

    res.status(200).json({
      success: true,
      uploadId,
      resourceId,
      fileId: assembledFile.gridFsFileId,
      message: 'Upload completed successfully',
      resource: createdRecord
    });
  } catch (err) {
    if (activeUploadId && acquiredGeneration) {
      await UploadSession.updateOne(
        { uploadId: activeUploadId, finalizeGeneration: acquiredGeneration, isFinalized: false },
        { $set: { isFinalizing: false, leaseExpiresAt: null } }
      ).catch(() => {});
    }
    console.error('Finalize error:', err);
    res.status(500).json({ error: err.message || 'Failed to finalize upload.' });
  }
};

const handleUploadCancel = async (req, res) => {
  try {
    const { uploadId } = req.params;
    await StorageService.cleanupTempChunks(uploadId);
    await UploadSession.deleteOne({ uploadId });
    res.status(200).json({ success: true, message: 'Upload cancelled and temporary chunks cleaned up.' });
  } catch (err) {
    console.error('Cancel upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to cleanup upload session.' });
  }
};

// 1. Initialize Chunked Upload
app.post('/api/resources/upload/init', authenticateToken, requireOnboarded, handleUploadInit);
app.post('/api/pending-resources/upload/init', authenticateToken, requireOnboarded, handleUploadInit);
app.post(['/api/resources/upload/init', '/api/pending-resources/upload/init'], authenticateToken, requireOnboarded, handleUploadInit);

// 2. Parallel Chunk Transfer (PUT and POST)
app.put('/api/resources/upload/chunk', authenticateToken, requireOnboarded, handleUploadChunkPut);
app.put('/api/pending-resources/upload/chunk', authenticateToken, requireOnboarded, handleUploadChunkPut);
app.post('/api/resources/upload/chunk', authenticateToken, requireOnboarded, handleUploadChunkPost);
app.post('/api/pending-resources/upload/chunk', authenticateToken, requireOnboarded, handleUploadChunkPost);

// 3. Finalize Chunked Upload
app.post('/api/resources/upload/finalize', authenticateToken, requireOnboarded, handleUploadFinalize);
app.post('/api/pending-resources/upload/finalize', authenticateToken, requireOnboarded, handleUploadFinalize);
app.post(['/api/resources/upload/finalize', '/api/pending-resources/upload/finalize'], authenticateToken, requireOnboarded, handleUploadFinalize);

// 4. Query Upload State / Resumability
app.get('/api/resources/upload/:uploadId', authenticateToken, requireOnboarded, handleUploadStatus);
app.get('/api/pending-resources/upload/:uploadId', authenticateToken, requireOnboarded, handleUploadStatus);

// 5. Cancel / Abort Upload Session
app.delete('/api/resources/upload/:uploadId', authenticateToken, requireOnboarded, handleUploadCancel);
app.delete('/api/pending-resources/upload/:uploadId', authenticateToken, requireOnboarded, handleUploadCancel);

// List Resources with folder privacy & permission checks
app.get('/api/resources', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    if (!isUserAdmin(req.user)) {
      const sectionVisibility = await getSectionVisibility();
      if (!sectionVisibility.resources) {
        return res.status(404).json({
          error: 'Resources section is currently unavailable',
          code: 'SECTION_DISABLED'
        });
      }
    }

    const { folderId, search, type, visibility } = req.query;
    const isAdmin = isUserAdmin(req.user);
    const userEmail = req.user ? req.user.email : null;
    const userId = req.user ? req.user.id : null;

    let filter = {};

    if (folderId) {
      // Privacy enforcement (IDOR protection)
      const targetFolder = await Folder.findOne({ id: folderId });
      if (targetFolder && targetFolder.visibility === 'private') {
        const isOwner = targetFolder.ownerEmail === userEmail || (targetFolder.ownerId && String(targetFolder.ownerId) === String(userId));
        if (!isOwner && !isAdmin) {
          return res.status(403).json({ error: 'This folder is private. You do not have permission to access its resources.' });
        }
      }
      filter.folderId = folderId;
    }

    if (search && typeof search === 'string') {
      const trimmedSearch = search.trim().slice(0, 100);
      if (trimmedSearch) {
        const escaped = escapeRegExp(sanitizeString(trimmedSearch));
        filter.$or = [
          { title: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } },
          { uploadedBy: { $regex: escaped, $options: 'i' } },
          { originalFileName: { $regex: escaped, $options: 'i' } }
        ];
      }
    }

    if (type && type !== 'all') {
      filter.type = type;
    }

    if (visibility) {
      filter.visibility = visibility;
    }

    // Normal users only see approved resources unless they uploaded it
    if (!isAdmin) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { status: 'approved' },
          ...(userEmail ? [{ uploadedByEmail: userEmail }] : [])
        ]
      });
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    // Cache public system folder resources where results are strictly uniform across users
    const isPublicSystemQuery = !search && (!visibility || visibility === 'public') && (!folderId || folderId.startsWith('system-'));
    if (isPublicSystemQuery) {
      const cacheKey = cacheService.makeKey('resources:public', `${folderId || 'all'}_${type || 'all'}_p_${page}_l_${limit}_pag_${isPaginated}`);
      const payload = await cacheService.getOrSet(cacheKey, async () => {
        if (isPaginated) {
          const total = await Resource.countDocuments(filter);
          const resources = await Resource.find(filter)
            .select('-link')
            .sort({ createdAt: -1, _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
          return { isPaginated: true, resources, total };
        }
        const resources = await Resource.find(filter)
          .select('-link')
          .sort({ createdAt: -1, _id: -1 })
          .lean();
        return { isPaginated: false, resources, total: resources.length };
      }, cacheService.DEFAULT_TTLS.resources);

      if (payload.isPaginated) {
        return sendPaginatedResponse(res, payload.resources, payload.total, page, limit);
      }
      res.set('X-Total-Count', String(payload.resources.length));
      return res.json(payload.resources);
    }

    if (isPaginated) {
      const total = await Resource.countDocuments(filter);
      const resources = await Resource.find(filter)
        .select('-link')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      return sendPaginatedResponse(res, resources, total, page, limit);
    }

    const resources = await Resource.find(filter)
      .select('-link')
      .sort({ createdAt: -1, _id: -1 })
      .lean();

    res.set('X-Total-Count', String(resources.length));
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Resource Metadata
app.get(['/api/resources/:id', '/api/pending-resources/:id'], authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeString(id);
    const query = mongoose.Types.ObjectId.isValid(sanitizedId)
      ? { $or: [{ id: sanitizedId }, { _id: sanitizedId }] }
      : { id: sanitizedId };

    const cacheKey = cacheService.makeKey('resources:detail', sanitizedId);
    let resource = await cacheService.getOrSet(cacheKey, async () => {
      let doc = await Resource.findOne(query).lean();
      if (!doc) {
        doc = await PendingResource.findOne(query).lean();
      }
      return doc;
    }, cacheService.DEFAULT_TTLS.resourceDetail);

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    // Verify folder privacy
    const folder = await Folder.findOne({ id: resource.folderId }).lean();
    const isAdmin = isUserAdmin(req.user);
    const isUploader = resource.uploadedByEmail && req.user && (resource.uploadedByEmail.toLowerCase() === req.user.email.toLowerCase());

    const isPendingDoc = resource.status === 'pending';
    if (isPendingDoc && (!req.user || (!isAdmin && !isUploader))) {
      return res.status(req.user ? 403 : 401).json({ error: 'Access denied to pending resource.' });
    }

    if (!isPendingDoc && !isAdmin) {
      const sectionVisibility = await getSectionVisibility();
      if (!sectionVisibility.resources) {
        return res.status(404).json({ error: 'Resources section is currently unavailable', code: 'SECTION_DISABLED' });
      }
    }

    if (folder && folder.visibility === 'private') {
      const isFolderOwner = req.user && (folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id)));
      if (!req.user || (!isFolderOwner && !isUploader && !isAdmin)) {
        return res.status(req.user ? 403 : 401).json({ error: 'Access denied to private resource.' });
      }
    }

    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Secure File Streaming / Download / Preview
app.get(['/api/resources/:id/file', '/api/pending-resources/:id/file'], authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeString(id);
    const idQuery = mongoose.Types.ObjectId.isValid(sanitizedId)
      ? { $or: [{ id: sanitizedId }, { _id: sanitizedId }, { gridFsFileId: sanitizedId }, { storageKey: `gridfs:${sanitizedId}` }, { storageKey: sanitizedId }] }
      : { id: sanitizedId };

    let resource = await Resource.findOne(idQuery);
    if (!resource) {
      resource = await PendingResource.findOne(idQuery);
    }

    let parentStory = null;
    let isStoryPending = false;
    if (!resource) {
      const storyIdQuery = mongoose.Types.ObjectId.isValid(sanitizedId)
        ? {
            $or: [
              { id: sanitizedId },
              { _id: sanitizedId },
              { 'resumeFile.gridFsFileId': sanitizedId },
              { 'resumeFile.storageKey': `gridfs:${sanitizedId}` },
              { 'studyMaterials.gridFsFileId': sanitizedId },
              { 'studyMaterials.storageKey': `gridfs:${sanitizedId}` }
            ]
          }
        : {
            $or: [
              { id: sanitizedId },
              { 'resumeFile.fileName': sanitizedId }
            ]
          };

      parentStory = await Story.findOne(storyIdQuery).lean();
      if (!parentStory) {
        parentStory = await PendingStory.findOne(storyIdQuery).lean();
        if (parentStory) isStoryPending = true;
      }
    }

    if (!resource && !parentStory) {
      // Do NOT expose unparented/orphaned GridFS files to arbitrary callers
      return res.status(404).json({ error: 'Resource or file not found.' });
    }

    if (parentStory) {
      const isAdmin = isUserAdmin(req.user);
      const isAuthor = parentStory.uploadedByEmail && req.user && (parentStory.uploadedByEmail.toLowerCase() === req.user.email.toLowerCase());

      if (isStoryPending && !isAdmin && !isAuthor) {
        return res.status(403).json({ error: 'Access denied to pending story file.' });
      }

      if (!isStoryPending && !isAdmin) {
        const visibility = await getSectionVisibility();
        if (!visibility.stories) {
          return res.status(404).json({ error: 'Stories section is currently unavailable', code: 'SECTION_DISABLED' });
        }
      }

      // Stream story resume or study material from GridFS
      if (parentStory.resumeFile && (parentStory.resumeFile.gridFsFileId || parentStory.resumeFile.storageKey)) {
        const gfsKey = parentStory.resumeFile.gridFsFileId ? `gridfs:${parentStory.resumeFile.gridFsFileId}` : parentStory.resumeFile.storageKey;
        return await StorageService.streamFromGridFS(
          gfsKey,
          req,
          res,
          parentStory.resumeFile.fileName || `${parentStory.name}_Resume.pdf`,
          'application/pdf',
          false
        );
      }

      const storyLink = parentStory.resumeFile?.url || parentStory.resume;
      if (storyLink && typeof storyLink === 'string' && storyLink.startsWith('/uploads/')) {
        const sanitizedFilename = path.basename(storyLink);
        const uploadsDirResolved = path.resolve(UPLOADS_DIR);
        const localPath = path.resolve(uploadsDirResolved, sanitizedFilename);
        if (localPath.startsWith(uploadsDirResolved + path.sep) && fs.existsSync(localPath)) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(parentStory.resumeFile?.fileName || `${parentStory.name}_Resume.pdf`)}"`);
          return fs.createReadStream(localPath).pipe(res);
        }
      }

      return res.status(404).json({ error: 'Story resume file not found in storage.' });
    }

    // Verify privacy
    const folder = resource.folderId ? await Folder.findOne({ id: resource.folderId }) : null;
    const isAdmin = isUserAdmin(req.user);
    const isUploader = resource.uploadedByEmail && req.user && (resource.uploadedByEmail.toLowerCase() === req.user.email.toLowerCase());

    const isPendingDoc = resource.status === 'pending';
    if (isPendingDoc && !isAdmin && !isUploader) {
      return res.status(403).json({ error: 'Access denied to pending resource file.' });
    }

    if (!isPendingDoc && !isAdmin) {
      const visibility = await getSectionVisibility();
      if (!visibility.resources) {
        return res.status(404).json({ error: 'Resources section is currently unavailable', code: 'SECTION_DISABLED' });
      }
    }

    if (folder && folder.visibility === 'private') {
      const isFolderOwner = folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id));
      if (!isFolderOwner && !isUploader && !isAdmin) {
        return res.status(403).json({ error: 'Access denied to private file.' });
      }
    }

    const isPrivate = Boolean(folder && folder.visibility === 'private');

    // 1. GridFS Streaming (Primary Storage)
    if (resource.storageKey && resource.storageKey.startsWith('gridfs:')) {
      return await StorageService.streamFromGridFS(
        resource.storageKey,
        req,
        res,
        resource.originalFileName || `${resource.title}.${resource.type === 'PDF' ? 'pdf' : 'bin'}`,
        resource.mimeType,
        isPrivate
      );
    }

    // 2. Fallback: if gridFsFileId exists or storageKey is raw ObjectId string without prefix
    if (resource.gridFsFileId || (resource.storageKey && resource.storageKey.length === 24)) {
      const gfsKey = resource.gridFsFileId ? `gridfs:${resource.gridFsFileId}` : `gridfs:${resource.storageKey}`;
      return await StorageService.streamFromGridFS(
        gfsKey,
        req,
        res,
        resource.originalFileName || resource.title,
        resource.mimeType,
        isPrivate
      );
    }

    // 3. Local Disk Fallback (Path traversal safe)
    const localLink = resource.link || resource.url || (resource.fileUrl && !resource.fileUrl.startsWith('http') ? resource.fileUrl : null);
    if (localLink && (localLink.startsWith('/uploads/') || localLink.includes('sample-document') || localLink.endsWith('.pdf'))) {
      const sanitizedFilename = path.basename(localLink);
      const uploadsDirResolved = path.resolve(UPLOADS_DIR);
      let localPath = path.resolve(uploadsDirResolved, sanitizedFilename);

      if (!fs.existsSync(localPath)) {
        // Check frontend public directory for sample files
        const publicDir = path.resolve(__dirname, '../frontend/public');
        const candidate = path.resolve(publicDir, sanitizedFilename);
        if (candidate.startsWith(publicDir + path.sep) && fs.existsSync(candidate)) {
          localPath = candidate;
        }
      }

      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', resource.mimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalFileName || resource.title || sanitizedFilename)}"`);
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    res.status(404).json({ error: 'File content not found in storage.' });
  } catch (err) {
    console.error('File stream error:', err);
    res.status(500).json({ error: 'Failed to stream file.' });
  }
});

// Backward-compatible redirect for download-url
app.get('/api/resources/:id/download-url', authenticateToken, requireOnboarded, async (req, res) => {
  if (!isUserAdmin(req.user)) {
    const visibility = await getSectionVisibility();
    if (!visibility.resources) {
      return res.status(404).json({ error: 'Resources section is currently unavailable', code: 'SECTION_DISABLED' });
    }
  }
  res.json({ url: `/api/resources/${req.params.id}/file`, provider: 'gridfs' });
});

// Direct Resource Creation Endpoint (Backward compatible with JSON/Base64 and direct posting)
app.post('/api/resources', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { title, folderId, link, category, semester, year, tags, description } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Resource title is required.' });
    }
    const resolvedFolderId = folderId || 'system-placement-material';
    const folder = await Folder.findOne({ id: resolvedFolderId });
    const isAdmin = isUserAdmin(req.user);
    const isOwner = folder && (folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id)));
    if (folder && folder.visibility === 'private' && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You cannot upload to another user private folder.' });
    }

    const processedBody = processResourceFiles(req.body);
    const resourceData = sanitizeObject({ ...processedBody });
    resourceData.title = title.trim();
    if (!resourceData.id) resourceData.id = String(Date.now());
    if (!resourceData.date) resourceData.date = new Date().toISOString().split('T')[0];
    resourceData.uploadedBy = req.user.name || req.user.email;
    resourceData.uploadedByEmail = req.user.email;
    resourceData.folderId = resolvedFolderId;
    if (category) resourceData.category = category;
    if (semester) resourceData.semester = semester;
    if (year) resourceData.year = year;
    if (description) resourceData.description = description;
    if (tags) resourceData.tags = Array.isArray(tags) ? tags : [tags];
    resourceData.status = isAdmin ? 'approved' : 'pending';

    const resource = await Resource.create(resourceData);
    if (resource.status === 'approved') {
      await cacheService.invalidateResources(resource.id).catch(() => {});
    }
    res.status(201).json(resource);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// =========================================================================
// OPTIMIZED MONGODB GRIDFS STREAMING UPLOAD ARCHITECTURE (Up to 200 MB)
// =========================================================================

const handleStreamingUpload = (req, res, { isPending = false } = {}) => {
  try {
    const bb = busboy({
      headers: req.headers,
      highWaterMark: 4 * 1024 * 1024, // 4 MB buffer for maximum streaming performance
      limits: {
        fileSize: StorageService.MAX_FILE_SIZE, // 200 MB limit
        files: 1
      }
    });

    const fields = {};
    let uploadPromise = null;
    let fileLimitHit = false;
    let activeUploadStream = null;
    let isAborted = false;

    // Handle client disconnect / cancellation
    req.on('aborted', async () => {
      isAborted = true;
      if (activeUploadStream && activeUploadStream.id) {
        try {
          const bucket = StorageService.getGridFSBucket();
          await bucket.delete(activeUploadStream.id);
        } catch (cleanupErr) {
          // Stream already closed or file deleted
        }
      }
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, fileStream, info) => {
      const { filename, mimeType } = info;

      if (!StorageService.isAllowedFile({ filename, mimeType })) {
        fileStream.resume();
        return res.status(400).json({
          error: 'Unsupported file type. Please upload an educational document (PDF, DOCX, TXT), spreadsheet, presentation, image, archive (ZIP), or code file.'
        });
      }

      fileStream.on('limit', () => {
        fileLimitHit = true;
        if (activeUploadStream && activeUploadStream.id) {
          try {
            activeUploadStream.destroy();
            const bucket = StorageService.getGridFSBucket();
            bucket.delete(activeUploadStream.id).catch(() => {});
          } catch (e) {}
        }
        fileStream.resume();
      });

      // Stream directly into GridFSBucket without buffering into memory
      uploadPromise = new Promise((resolve, reject) => {
        try {
          const bucket = StorageService.getGridFSBucket();
          const uploadStream = bucket.openUploadStream(filename, {
            chunkSizeBytes: StorageService.CHUNK_SIZE_BYTES,
            contentType: mimeType || 'application/octet-stream',
            metadata: {
              uploadedBy: req.user.name || req.user.email,
              uploadedByEmail: req.user.email,
              uploadedAt: new Date()
            }
          });
          activeUploadStream = uploadStream;

          fileStream.pipe(uploadStream)
            .on('error', (err) => {
              if (activeUploadStream && activeUploadStream.id) {
                bucket.delete(activeUploadStream.id).catch(() => {});
              }
              reject(err);
            })
            .on('finish', (savedFile) => {
              resolve({
                storageKey: `gridfs:${uploadStream.id.toString()}`,
                gridFsFileId: uploadStream.id,
                filename: uploadStream.filename,
                size: uploadStream.length || savedFile?.length || 0,
                contentType: mimeType
              });
            });
        } catch (err) {
          reject(err);
        }
      });
    });

    bb.on('error', (err) => {
      console.error('Busboy stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error during upload.' });
      }
    });

    bb.on('finish', async () => {
      if (isAborted) return;
      if (fileLimitHit) {
        return res.status(400).json({ error: 'File exceeds the maximum allowed size of 200 MB.' });
      }
      if (!uploadPromise) {
        return res.status(400).json({ error: 'No file received in upload stream.' });
      }

      try {
        const uploadResult = await uploadPromise;
        const resolvedFolderId = fields.folderId || 'system-placement-material';
        const folder = await Folder.findOne({ id: resolvedFolderId });

        const isAdmin = isUserAdmin(req.user);
        const isOwner = folder && (folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id)));

        // Strict folder permission verification
        if (folder && folder.visibility === 'private' && !isOwner && !isAdmin) {
          await StorageService.deleteFile(uploadResult.storageKey, 'gridfs');
          return res.status(403).json({ error: 'You cannot upload to another user private folder.' });
        }
        if (folder && folder.folderType === 'user' && !folder.allowContributions && !isOwner && !isAdmin) {
          await StorageService.deleteFile(uploadResult.storageKey, 'gridfs');
          return res.status(403).json({ error: 'Community contributions are disabled for this folder.' });
        }

        const title = (fields.title && fields.title.trim()) || uploadResult.filename.replace(/\.[^/.]+$/, '');
        const category = fields.category || 'General';
        const detectedType = StorageService.getFileTypeCategory(uploadResult.contentType, uploadResult.filename);
        const resourceId = String(Date.now());
        const resourceUrl = `/api/resources/${resourceId}/file`;

        if (isPending) {
          const pendingResource = await PendingResource.create({
            id: resourceId,
            title,
            description: fields.description || '',
            category,
            type: detectedType,
            originalFileName: uploadResult.filename,
            mimeType: uploadResult.contentType || 'application/pdf',
            size: uploadResult.size,
            fileSizeFormatted: StorageService.formatBytes(uploadResult.size),
            storageProvider: 'gridfs',
            storageKey: uploadResult.storageKey,
            gridFsFileId: uploadResult.gridFsFileId,
            url: resourceUrl,
            folderId: resolvedFolderId,
            ownerId: req.user.id || null,
            uploadedBy: req.user.name || req.user.email.split('@')[0],
            uploadedByEmail: req.user.email,
            date: new Date().toISOString().split('T')[0],
            visibility: folder?.visibility || 'public',
            status: 'pending',
            semester: fields.semester || '',
            year: fields.year || ''
          });
          return res.status(201).json(pendingResource);
        }

        const newResource = await Resource.create({
          id: resourceId,
          title,
          description: fields.description || '',
          category,
          type: detectedType,
          originalFileName: uploadResult.filename,
          mimeType: uploadResult.contentType || 'application/pdf',
          size: uploadResult.size,
          fileSizeFormatted: StorageService.formatBytes(uploadResult.size),
          storageProvider: 'gridfs',
          storageKey: uploadResult.storageKey,
          gridFsFileId: uploadResult.gridFsFileId,
          url: resourceUrl,
          folderId: resolvedFolderId,
          ownerId: req.user.id || null,
          uploadedBy: req.user.name || req.user.email.split('@')[0],
          uploadedByEmail: req.user.email,
          date: new Date().toISOString().split('T')[0],
          visibility: folder?.visibility || 'public',
          status: 'approved',
          semester: fields.semester || '',
          year: fields.year || '',
          tags: fields.tags ? fields.tags.split(',').map(t => t.trim()) : []
        });

        await cacheService.invalidateResources(newResource.id).catch(() => {});

        res.status(201).json(newResource);
      } catch (err) {
        console.error('Save resource error:', err);
        res.status(500).json({ error: err.message || 'Failed to save resource record.' });
      }
    });

    req.pipe(bb);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Direct Resource Upload Endpoints (Single-file multipart fallback)
app.post('/api/resources/upload', authenticateToken, requireOnboarded, (req, res) => {
  const isAdmin = isUserAdmin(req.user);
  handleStreamingUpload(req, res, { isPending: !isAdmin });
});

// Student & Community Resource Submission Upload Endpoints (Single-file multipart fallback)
app.post('/api/pending-resources/upload', authenticateToken, requireOnboarded, (req, res) => {
  handleStreamingUpload(req, res, { isPending: true });
});

// --- MongoDB GridFS Storage Routes for Resumes and Study Materials ---

// 1. Storage Configuration Limits
app.get('/api/storage/limits', (req, res) => {
  res.json({
    provider: 'gridfs',
    database: 'mongodb_atlas',
    resumeMaxSizeBytes: RESUME_MAX_FILE_SIZE_BYTES, // 10 MiB (10,485,760 bytes)
    resumeMaxSizeFormatted: '10 MB',
    resumeAllowedTypes: ['application/pdf'],
    studyMaterialMaxSizeBytes: null,
    studyMaterialLimitType: 'unbounded_atlas_capacity',
    chunkSizeBytes: StorageService.FINAL_CHUNK_SIZE_BYTES
  });
});

// 2. Resume Upload to MongoDB GridFS (Max 10 MiB, PDF only)
app.post('/api/storage/upload/resume', authenticateToken, requireOnboarded, (req, res) => {
  try {
    const bb = busboy({
      headers: req.headers,
      highWaterMark: 1024 * 1024,
      limits: {
        fileSize: RESUME_MAX_FILE_SIZE_BYTES,
        files: 1
      }
    });

    let uploadPromise = null;
    let fileLimitHit = false;
    let activeUploadStream = null;
    let validationError = null;
    let isAborted = false;
    let bytesCount = 0;

    req.on('aborted', async () => {
      isAborted = true;
      if (activeUploadStream && activeUploadStream.id) {
        try {
          const bucket = StorageService.getGridFSBucket();
          await bucket.delete(activeUploadStream.id);
        } catch (e) {}
      }
    });

    bb.on('file', (name, fileStream, info) => {
      const { filename, mimeType } = info;
      const cleanFilename = sanitizeStorageFilename(filename);

      const val = validateResume({ filename: cleanFilename, mimeType });
      if (!val.valid) {
        validationError = val;
        fileStream.resume();
        return;
      }

      const drainAndClean = () => {
        if (activeUploadStream) {
          try {
            fileStream.unpipe(activeUploadStream);
            activeUploadStream.destroy();
            const bucket = StorageService.getGridFSBucket();
            if (activeUploadStream.id) {
              bucket.delete(activeUploadStream.id).catch(() => {});
            }
          } catch (e) {}
        }
        fileStream.resume();
      };

      fileStream.on('limit', () => {
        fileLimitHit = true;
        drainAndClean();
      });

      uploadPromise = new Promise((resolve, reject) => {
        try {
          const bucket = StorageService.getGridFSBucket();
          const uploadStream = bucket.openUploadStream(cleanFilename, {
            chunkSizeBytes: StorageService.FINAL_CHUNK_SIZE_BYTES,
            contentType: 'application/pdf',
            metadata: {
              type: 'resume',
              originalFileName: cleanFilename,
              uploadedBy: req.user.name || req.user.email,
              uploadedByEmail: req.user.email,
              uploadedAt: new Date()
            }
          });
          activeUploadStream = uploadStream;

          fileStream.on('data', (chunk) => {
            bytesCount += chunk.length;
            if (bytesCount > RESUME_MAX_FILE_SIZE_BYTES) {
              fileLimitHit = true;
              drainAndClean();
            }
          });

          fileStream.pipe(uploadStream)
            .on('error', (err) => {
              if (activeUploadStream && activeUploadStream.id) {
                bucket.delete(activeUploadStream.id).catch(() => {});
              }
              reject(err);
            })
            .on('finish', (savedFile) => {
              resolve({
                gridFsFileId: uploadStream.id,
                fileId: uploadStream.id,
                filename: cleanFilename,
                size: uploadStream.length || savedFile?.length || bytesCount,
                contentType: 'application/pdf'
              });
            });
        } catch (err) {
          reject(err);
        }
      });
    });

    bb.on('error', (err) => {
      console.error('[Resume Upload Stream Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error during resume upload.' });
      }
    });

    bb.on('finish', async () => {
      if (isAborted) return;

      if (validationError) {
        return res.status(400).json({ error: validationError.error, code: validationError.code });
      }

      if (fileLimitHit) {
        return res.status(413).json({
          error: 'Resume size exceeds the 10 MB limit. Please compress your PDF and try again.',
          code: 'FILE_TOO_LARGE'
        });
      }

      if (!uploadPromise) {
        return res.status(400).json({ error: 'No resume file uploaded.', code: 'FILE_MISSING' });
      }

      try {
        const uploadResult = await uploadPromise;
        const fileIdStr = uploadResult.gridFsFileId.toString();
        const fileUrl = `/api/storage/files/${fileIdStr}`;

        return res.status(201).json({
          success: true,
          gridFsFileId: uploadResult.gridFsFileId,
          fileId: uploadResult.gridFsFileId,
          fileName: uploadResult.filename,
          fileSize: StorageService.formatBytes(uploadResult.size),
          sizeBytes: uploadResult.size,
          mimeType: 'application/pdf',
          storageProvider: 'gridfs',
          url: fileUrl,
          uploadedByEmail: req.user.email,
          uploadedAt: new Date()
        });
      } catch (err) {
        console.error('[GridFS Resume Upload Error]', err);
        return res.status(500).json({ error: err.message || 'Failed to upload resume to GridFS storage.' });
      }
    });

    req.pipe(bb);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Study Material Upload to MongoDB GridFS (Unbounded / Atlas Capacity, Streamed)
app.post('/api/storage/upload/study-material', authenticateToken, requireOnboarded, (req, res) => {
  try {
    const bb = busboy({
      headers: req.headers,
      highWaterMark: 4 * 1024 * 1024,
      limits: {
        files: 1
      }
    });

    const fields = {};
    let uploadPromise = null;
    let activeUploadStream = null;
    let validationError = null;
    let isAborted = false;
    let bytesCount = 0;

    req.on('aborted', async () => {
      isAborted = true;
      if (activeUploadStream && activeUploadStream.id) {
        try {
          const bucket = StorageService.getGridFSBucket();
          await bucket.delete(activeUploadStream.id);
        } catch (e) {}
      }
    });

    bb.on('field', (name, val) => {
      fields[name] = val;
    });

    bb.on('file', (name, fileStream, info) => {
      const { filename, mimeType } = info;
      const cleanFilename = sanitizeStorageFilename(filename);

      if (!StorageService.isAllowedFile({ filename: cleanFilename, mimeType })) {
        validationError = {
          error: 'Unsupported file type. Please upload a PDF, Word document, presentation, spreadsheet, image, or text file.',
          code: 'INVALID_FILE_TYPE'
        };
        fileStream.resume();
        return;
      }

      uploadPromise = new Promise((resolve, reject) => {
        try {
          const bucket = StorageService.getGridFSBucket();
          const uploadStream = bucket.openUploadStream(cleanFilename, {
            chunkSizeBytes: StorageService.FINAL_CHUNK_SIZE_BYTES,
            contentType: mimeType || 'application/octet-stream',
            metadata: {
              type: 'study-material',
              originalFileName: cleanFilename,
              title: fields.title || cleanFilename,
              category: fields.category || 'DSA Preparation',
              uploadedBy: req.user.name || req.user.email,
              uploadedByEmail: req.user.email,
              uploadedAt: new Date()
            }
          });
          activeUploadStream = uploadStream;

          fileStream.on('data', (chunk) => {
            bytesCount += chunk.length;
          });

          fileStream.pipe(uploadStream)
            .on('error', (err) => {
              if (activeUploadStream && activeUploadStream.id) {
                bucket.delete(activeUploadStream.id).catch(() => {});
              }
              reject(err);
            })
            .on('finish', (savedFile) => {
              resolve({
                gridFsFileId: uploadStream.id,
                fileId: uploadStream.id,
                filename: cleanFilename,
                size: uploadStream.length || savedFile?.length || bytesCount,
                contentType: mimeType || 'application/octet-stream'
              });
            });
        } catch (err) {
          reject(err);
        }
      });
    });

    bb.on('error', (err) => {
      console.error('[Study Material Upload Stream Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error during study material upload.' });
      }
    });

    bb.on('finish', async () => {
      if (isAborted) return;

      if (validationError) {
        return res.status(400).json({ error: validationError.error, code: validationError.code });
      }

      if (!uploadPromise) {
        return res.status(400).json({ error: 'No study material file uploaded.', code: 'FILE_MISSING' });
      }

      try {
        const uploadResult = await uploadPromise;
        const fileIdStr = uploadResult.gridFsFileId.toString();
        const fileUrl = `/api/storage/files/${fileIdStr}`;
        const determinedType = StorageService.getFileTypeCategory(uploadResult.contentType, uploadResult.filename);

        return res.status(201).json({
          success: true,
          title: fields.title || uploadResult.filename.substring(0, uploadResult.filename.lastIndexOf('.')) || uploadResult.filename,
          type: determinedType,
          category: fields.category || 'DSA Preparation',
          gridFsFileId: uploadResult.gridFsFileId,
          fileId: uploadResult.gridFsFileId,
          fileName: uploadResult.filename,
          fileSize: StorageService.formatBytes(uploadResult.size),
          sizeBytes: uploadResult.size,
          mimeType: uploadResult.contentType,
          storageProvider: 'gridfs',
          url: fileUrl,
          uploadedByEmail: req.user.email,
          uploadedAt: new Date()
        });
      } catch (err) {
        console.error('[GridFS Study Material Upload Error]', err);
        return res.status(500).json({ error: err.message || 'Failed to upload study material to GridFS storage.' });
      }
    });

    req.pipe(bb);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dual-token Authentication helper (handles Authorization header or ?token= query parameter)
const authenticateStorageAccess = (req, res, next) => {
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  authenticateToken(req, res, next);
};

// 4. Secure File Access & Streaming Endpoint from GridFS
app.get(['/api/storage/files/:id', '/api/storage/files/:bucket/*'], authenticateStorageAccess, async (req, res) => {
  try {
    let rawId = req.params.id;
    if (!rawId && req.params.bucket) {
      rawId = req.params[0] || req.params.bucket;
    }

    if (!rawId) {
      return res.status(400).json({ error: 'File identifier is required.' });
    }

    // Path traversal check
    if (rawId.includes('..') || rawId.startsWith('/')) {
      return res.status(400).json({ error: 'Path traversal attempt rejected.' });
    }

    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const isAdmin = isUserAdmin(req.user);

    // Security & Authorization: Check if file belongs to a PendingStory
    const pendingConditions = [];
    if (mongoose.Types.ObjectId.isValid(rawId) && rawId.length === 24) {
      const oid = new mongoose.Types.ObjectId(rawId);
      pendingConditions.push(
        { 'resumeFile.gridFsFileId': oid },
        { 'studyMaterials.gridFsFileId': oid }
      );
    }
    const escapedRawId = rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pendingConditions.push(
      { 'resumeFile.url': { $regex: escapedRawId, $options: 'i' } },
      { 'studyMaterials.url': { $regex: escapedRawId, $options: 'i' } },
      { 'resumeFile.fileName': path.basename(rawId) },
      { 'studyMaterials.fileName': path.basename(rawId) }
    );

    let pendingStory = null;
    try {
      const res = PendingStory.findOne({ $or: pendingConditions });
      if (res && typeof res.lean === 'function') {
        pendingStory = await res.lean();
      } else if (res && typeof res.then === 'function') {
        pendingStory = await res;
      }
    } catch (dbErr) {
      // Disconnected or unmocked DB in test environment
    }
    if (pendingStory && !isAdmin) {
      const isOwner = pendingStory.uploadedByEmail && (pendingStory.uploadedByEmail.toLowerCase().trim() === userEmail);
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied to pending story document.' });
      }
    }

    // Stream directly from GridFS
    return await StorageService.streamFromGridFS(rawId, req, res, null, null, false);
  } catch (err) {
    console.error('[Storage File Access Error]', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error streaming file from storage.' });
    }
  }
});

// 5. Delete File from GridFS Storage (Authorized to uploader or admin)
app.delete(['/api/storage/files/:id', '/api/storage/files/:bucket/*'], authenticateToken, async (req, res) => {
  try {
    let rawId = req.params.id;
    if (!rawId && req.params.bucket) {
      rawId = req.params[0] || req.params.bucket;
    }

    if (!rawId) {
      return res.status(400).json({ error: 'File identifier is required.' });
    }

    if (rawId.includes('..')) {
      return res.status(400).json({ error: 'Path traversal attempt rejected.' });
    }

    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const isAdmin = isUserAdmin(req.user);

    // Verify ownership in GridFS metadata if not admin
    if (!isAdmin) {
      const bucket = StorageService.getGridFSBucket();
      let fileDoc = null;
      if (mongoose.Types.ObjectId.isValid(rawId) && rawId.length === 24) {
        const files = await bucket.find({ _id: new mongoose.Types.ObjectId(rawId) }).toArray();
        if (files && files.length > 0) fileDoc = files[0];
      }
      if (!fileDoc) {
        const files = await bucket.find({ filename: path.basename(rawId) }).toArray();
        if (files && files.length > 0) fileDoc = files[0];
      }

      if (fileDoc) {
        const uploader = (fileDoc.metadata?.uploadedByEmail || '').toLowerCase().trim();
        if (uploader && uploader !== userEmail) {
          return res.status(403).json({ error: 'You are only authorized to delete files you uploaded.' });
        }
      }
    }

    const deleted = await StorageService.deleteFile(rawId, 'gridfs');
    if (!deleted) {
      return res.status(404).json({ error: 'File not found or already deleted.' });
    }

    return res.json({ success: true, message: 'File deleted from storage.' });
  } catch (err) {
    console.error('[Storage Delete Error]', err);
    return res.status(500).json({ error: err.message || 'Failed to delete file from storage.' });
  }
});



// Edit Resource Metadata (Rename, Move folder, Description, Tags)
const handleUpdateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findOne({ id: sanitizeString(id) });
    if (!resource) return res.status(404).json({ error: 'Resource not found.' });

    const isAdmin = isUserAdmin(req.user);
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const uploaderEmail = (resource.uploadedByEmail || '').toLowerCase().trim();
    const isOwner = (uploaderEmail && uploaderEmail === userEmail) || 
                    (resource.ownerId && String(resource.ownerId) === String(req.user.id || req.user._id));

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to edit this resource.' });
    }

    const updates = {};
    if (req.body.title) updates.title = req.body.title.trim();
    if (req.body.description !== undefined) updates.description = req.body.description.trim();
    if (req.body.category) updates.category = req.body.category;
    if (req.body.semester !== undefined) updates.semester = req.body.semester;
    if (req.body.year !== undefined) updates.year = req.body.year;
    if (req.body.tags) updates.tags = Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map(t => t.trim());
    
    // Moving file to another folder
    if (req.body.folderId && req.body.folderId !== resource.folderId) {
      const targetFolder = await Folder.findOne({ id: req.body.folderId });
      if (!targetFolder) return res.status(404).json({ error: 'Target destination folder not found.' });
      
      const isTargetOwner = (targetFolder.ownerEmail || '').toLowerCase().trim() === userEmail || 
                            (targetFolder.ownerId && String(targetFolder.ownerId) === String(req.user.id || req.user._id));
      if (targetFolder.visibility === 'private' && !isTargetOwner && !isAdmin) {
        return res.status(403).json({ error: 'Cannot move file into private folder of another user.' });
      }
      updates.folderId = req.body.folderId;
      updates.visibility = targetFolder.visibility;
    }

    const updated = await Resource.findOneAndUpdate({ id: resource.id }, { $set: updates }, { new: true });
    await cacheService.invalidateResources(resource.id).catch(() => {});
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

app.patch('/api/resources/:id', authenticateToken, requireOnboarded, handleUpdateResource);
app.put('/api/resources/:id', authenticateToken, requireOnboarded, handleUpdateResource);

// Delete Resource (Safe Deletion with Cloud/GridFS cleanup)
app.delete('/api/resources/:id', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findOne({ id: sanitizeString(id) });
    if (!resource) return res.status(404).json({ error: 'Resource not found.' });

    const isAdmin = isUserAdmin(req.user);
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const uploaderEmail = (resource.uploadedByEmail || '').toLowerCase().trim();
    const isOwner = (uploaderEmail && uploaderEmail === userEmail) || 
                    (resource.ownerId && String(resource.ownerId) === String(req.user.id || req.user._id));

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'You do not have permission to delete this resource.' });
    }

    await Resource.deleteOne({ id: resource.id });
    await cacheService.invalidateResources(resource.id).catch(() => {});

    // Clean up physical file in GridFS only if no other record references it (e.g. pending moderation edit)
    const fileIdToClean = resource.gridFsFileId || resource.storageKey;
    if (fileIdToClean && (String(fileIdToClean).startsWith('gridfs:') || mongoose.Types.ObjectId.isValid(String(fileIdToClean).replace(/^gridfs:/, '')))) {
      await safeDeleteGridFSFileIfOrphaned(fileIdToClean).catch(() => {});
    } else if (resource.storageKey || resource.url) {
      await StorageService.deleteFile(resource.storageKey || resource.url, resource.storageProvider).catch(() => {});
    }

    activityService.logActivity({
      eventType: 'CONTENT_RESOURCE_DELETE',
      category: 'CONTENT',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Resource',
      targetId: resource.id,
      summary: `Deleted resource: ${resource.title || resource.id}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { resourceId: resource.id, title: resource.title }
    });

    res.json({ message: 'Resource permanently deleted.' });
  } catch (err) {
    console.error('Error in DELETE /api/resources/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Pending Resources
app.get('/api/pending-resources', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await PendingResource.find({}).sort({ createdAt: -1 }).lean();
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-resources', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const processedBody = processResourceFiles(req.body);
    const pendingData = sanitizeObject({ ...processedBody });
    if (!pendingData.id) pendingData.id = String(Date.now());
    if (!pendingData.date) pendingData.date = new Date().toISOString().split('T')[0];
    
    if (pendingData.requestType === 'edit' || pendingData.requestType === 'delete') {
      pendingData.activeId = pendingData.id;
      pendingData.id = String(Date.now());
    }
    
    // Automatically bind the user details from current JWT session
    pendingData.uploadedBy = req.user.name || req.user.email;
    pendingData.uploadedByEmail = req.user.email;

    const pending = await PendingResource.create(pendingData);

    activityService.logActivity({
      eventType: 'CONTENT_RESOURCE_SUBMIT',
      category: 'CONTENT',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Resource',
      targetId: pending.id,
      targetUserEmail: req.user.email,
      summary: `Submitted resource for moderation: ${pending.title || pending.id}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { resourceId: pending.id, title: pending.title, requestType: pending.requestType }
    });

    res.status(201).json(pending);
  } catch (err) {
    console.error("Error in POST /api/pending-resources:", err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/pending-resources/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const pending = await PendingResource.findOne(query);
    await PendingResource.deleteOne(query);

    await cacheService.invalidateResources(pending?.activeId || pending?.id || id).catch(() => {});
    if (pending?._id) {
      await cacheService.del(cacheService.makeKey('resources:detail', String(pending._id))).catch(() => {});
    }

    if (pending) {
      activityService.logActivity({
        eventType: 'CONTENT_RESOURCE_REJECT',
        category: 'ADMIN',
        actorEmail: req.user.email,
        actorRole: req.user.role,
        targetType: 'Resource',
        targetId: pending.id || id,
        targetUserEmail: pending.uploadedByEmail || '',
        summary: `Admin rejected pending resource: ${pending.title || pending.id}`,
        outcome: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { pendingId: id, title: pending.title, uploadedByEmail: pending.uploadedByEmail }
      });
    }

    res.json({ message: 'Pending resource rejected/deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-resources/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ id }, { _id: id }] }
      : { id };
    const pending = await PendingResource.findOne(query);
    if (!pending) return res.status(404).json({ error: 'Pending resource not found.' });

    if (pending.requestType === 'delete') {
      await Resource.deleteOne({ id: pending.activeId });
    } else if (pending.requestType === 'edit') {
      const resourceObj = pending.toObject();
      const activeId = resourceObj.activeId;
      
      delete resourceObj._id;
      delete resourceObj.__v;
      delete resourceObj.status;
      delete resourceObj.requestType;
      delete resourceObj.activeId;
      
      resourceObj.id = activeId;
      await Resource.findOneAndUpdate({ id: activeId }, resourceObj, { new: true });
    } else {
      const resourceObj = pending.toObject();
      
      delete resourceObj._id;
      delete resourceObj.__v;
      delete resourceObj.status;
      
      await Resource.create(resourceObj);
    }

    await PendingResource.deleteOne({ _id: pending._id });
    await cacheService.invalidateResources(pending.activeId || pending.id || req.params.id).catch(() => {});
    if (pending._id) {
      await cacheService.del(cacheService.makeKey('resources:detail', String(pending._id))).catch(() => {});
    }

    activityService.logActivity({
      eventType: 'ADMIN_APPROVE_RESOURCE',
      category: 'ADMIN',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Resource',
      targetId: pending.activeId || req.params.id,
      targetUserEmail: pending.uploadedByEmail || '',
      summary: `Admin approved resource: ${pending.title || pending.id}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { pendingId: req.params.id, title: pending.title, uploadedByEmail: pending.uploadedByEmail }
    });

    res.json({ message: 'Resource approved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Achievements
app.get('/api/achievements', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    if (!isUserAdmin(req.user)) {
      const visibility = await getSectionVisibility();
      if (!visibility.achievements) {
        return res.status(404).json({
          error: 'Achievements section is currently unavailable',
          code: 'SECTION_DISABLED'
        });
      }
    }

    const cacheKey = cacheService.makeKey('achievements:list');
    const achievements = await cacheService.getOrSet(cacheKey, async () => {
      return await Achievement.find({}).sort({ createdAt: -1, _id: -1 }).lean();
    }, cacheService.DEFAULT_TTLS.achievements);

    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/achievements', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    const { title, description, image } = req.body;
    // Required field check
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Achievement title is required.' });
    }
    if (title.length > 500) {
      return res.status(400).json({ error: 'Achievement title is too long.' });
    }
    if (description && (typeof description !== 'string' || description.length > 5000)) {
      return res.status(400).json({ error: 'Achievement description is too long (max 5000 chars).' });
    }
    if (image && !validateFileUri(image, ALLOWED_IMAGE_PREFIXES)) {
      return res.status(400).json({ error: 'Invalid achievement image file format. Only JPEG, PNG, and WebP images are allowed.' });
    }

    const processedBody = processAchievementFiles(req.body);
    const achievementData = sanitizeObject({ ...processedBody });
    achievementData.title = title.trim();
    if (!achievementData.id) achievementData.id = String(Date.now());
    if (!achievementData.date) achievementData.date = new Date().toISOString().split('T')[0];
    
    const achievement = await Achievement.create(achievementData);
    await cacheService.invalidateAchievements(achievement.id).catch(() => {});
    res.status(201).json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/achievements/:id', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    const { image } = req.body;
    if (image && !validateFileUri(image, ALLOWED_IMAGE_PREFIXES)) {
      return res.status(400).json({ error: 'Invalid achievement image file format. Only JPEG, PNG, and WebP images are allowed.' });
    }
    const processedBody = processAchievementFiles(req.body);
    const sanitizedBody = sanitizeObject({ ...processedBody });
    const achievement = await Achievement.findOneAndUpdate({ id: req.params.id }, sanitizedBody, { new: true });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });
    await cacheService.invalidateAchievements(req.params.id).catch(() => {});
    res.json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/achievements/:id', authenticateToken, requireOnboarded, requireAdmin, async (req, res) => {
  try {
    await Achievement.deleteOne({ id: req.params.id });
    await cacheService.invalidateAchievements(req.params.id).catch(() => {});
    res.json({ message: 'Achievement deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AUTHENTICATION & MULTI-DEVICE SESSIONS API
// ==========================================

// Logout - revokes current session
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    if (req.sessionId) {
      await sessionService.revokeSession(req.sessionId, req.user.email, 'User explicit logout');
    }
    activityService.logActivity({
      eventType: 'AUTH_LOGOUT',
      category: 'AUTH',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      summary: 'User logged out',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { sessionId: req.sessionId }
    });
    res.json({ message: 'Successfully logged out.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete logout.' });
  }
});

// List active sessions for authenticated user
app.get('/api/sessions/my', authenticateToken, async (req, res) => {
  try {
    const sessions = await sessionService.listUserSessions(req.user.email, req.sessionId);
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve active sessions.' });
  }
});

// Revoke a specific session
app.delete('/api/sessions/my/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }
    await sessionService.revokeSession(sessionId, req.user.email, 'User revoked individual session');
    activityService.logActivity({
      eventType: 'AUTH_SESSION_REVOKED',
      category: 'AUTH',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      summary: `User terminated session ${sessionId}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { targetSessionId: sessionId }
    });
    res.json({ message: 'Session revoked successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke session.' });
  }
});

// Revoke all other sessions except current
app.post('/api/sessions/my/revoke-others', authenticateToken, async (req, res) => {
  try {
    const result = await sessionService.revokeOtherSessions(req.user.email, req.sessionId);
    activityService.logActivity({
      eventType: 'AUTH_SESSION_REVOKED',
      category: 'AUTH',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      summary: 'User revoked all other active sessions',
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: { modifiedCount: result.modifiedCount || 0 }
    });
    res.json({
      message: 'All other active sessions have been terminated.',
      revokedCount: result.modifiedCount || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke other sessions.' });
  }
});

// Session Refresh Endpoint (Exchanges valid 30-day refresh token for a fresh access token)
app.post(['/api/auth/refresh', '/api/users/refresh'], async (req, res) => {
  try {
    const { sessionId, refreshToken } = req.body || {};
    if (!sessionId || !refreshToken) {
      return res.status(400).json({
        error: 'Both sessionId and refreshToken are required.',
        code: 'MISSING_REFRESH_CREDENTIALS'
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';

    const refreshResult = await sessionService.refreshSession({
      sessionId,
      refreshToken,
      userAgent,
      ipAddress
    });

    if (!refreshResult.success) {
      return res.status(401).json({
        error: refreshResult.error,
        code: refreshResult.code
      });
    }

    // Authoritative account status check: always query database during token refresh
    userAuthCache.invalidate(refreshResult.email);
    const email = refreshResult.email;
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email) + '$', 'i') });
    if (!user) {
      return res.status(401).json({
        error: 'User account not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.status !== 'Active') {
      userAuthCache.invalidate(email);
      return res.status(403).json({
        error: 'Your account is inactive or pending approval.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    const newAccessToken = jwt.sign(
      {
        email: user.email,
        role: isUserAdmin ? 'Administrator' : user.role,
        status: user.status,
        sessionId: refreshResult.sessionId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    activityService.logActivity({
      eventType: 'AUTH_SESSION_REFRESHED',
      category: 'AUTH',
      actorEmail: user.email,
      actorRole: user.role,
      summary: `User session refreshed successfully`,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { sessionId: refreshResult.sessionId }
    });

    const isProfileFilled = Boolean(user.onboarded || (user.name && user.branch) || isUserAdmin);
    if (!user.onboarded && isProfileFilled) {
      user.onboarded = true;
      user.save().catch(() => {});
    }

    return res.json({
      token: newAccessToken,
      refreshToken: refreshResult.refreshToken,
      sessionId: refreshResult.sessionId,
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: isProfileFilled,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || ''
    });
  } catch (err) {
    console.error('[AUTH_REFRESH_ERROR]', err);
    return res.status(500).json({
      error: 'An internal error occurred while refreshing session.',
      code: 'REFRESH_INTERNAL_ERROR'
    });
  }
});

// ==========================================
// USER FEEDBACK & BUG REPORTING API
// ==========================================

const FEEDBACK_CATEGORY_MAP = {
  'Bug / Technical Issue': 'Bug / Error',
  'UI / Design Feedback': 'UI / Usability',
  'Improvement Suggestion': 'Feature Request',
  'Login / Account Issue': 'Authentication / Login Issue',
  'Resource / Upload Issue': 'Resource / Material Issue',
  'Performance Issue': 'Performance / Slowness',
  'Security / Privacy Concern': 'Other',
  'Positive Feedback': 'Other',
  'Other': 'Other'
};

const FEEDBACK_VALID_CATEGORIES = [
  'Bug / Error',
  'Bug / Technical Issue',
  'UI / Usability',
  'UI / Design Feedback',
  'Placement Story Issue',
  'Resource / Material Issue',
  'Resource / Upload Issue',
  'Authentication / Login Issue',
  'Login / Account Issue',
  'Performance / Slowness',
  'Performance Issue',
  'Mobile / Responsiveness',
  'Feature Request',
  'Improvement Suggestion',
  'Security / Privacy Concern',
  'Positive Feedback',
  'Account / Profile Issue',
  'Other'
];

const FEEDBACK_VALID_SEVERITIES = ['Minor', 'Moderate', 'Major', 'Critical'];
const FEEDBACK_VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

// Submit feedback or bug report with optional screenshot
app.post('/api/feedback', feedbackLimiter, authenticateToken, requireOnboarded, (req, res) => {
  feedbackUpload.single('screenshot')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Error processing attachment.' });
    }

    let screenshotFileId = null;
    try {
      const {
        title,
        category,
        severity = 'Moderate',
        priority = 'Medium',
        description,
        expectedBehavior = '',
        actualBehavior = '',
        stepsToReproduce = '',
        route = '',
        deviceDiagnostics = '{}'
      } = req.body;

      if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'Feedback description is required.' });
      }

      // Automatically generate summary title from user text if not explicitly provided
      let cleanTitle = (title && typeof title === 'string' && title.trim()) ? title.trim() : '';
      if (!cleanTitle) {
        const firstLine = description.trim().split(/\r?\n/)[0].trim();
        const sentenceMatch = firstLine.match(/^[^.!?]+[.!?]?/);
        const snippet = sentenceMatch ? sentenceMatch[0].trim() : firstLine;
        cleanTitle = snippet.length > 70 ? snippet.slice(0, 67) + '...' : snippet;
        if (!cleanTitle) cleanTitle = 'User Feedback Report';
      }

      // Enforce mandatory feedback category
      const rawCategory = (category && typeof category === 'string' && category.trim()) ? category.trim() : '';
      if (!rawCategory) {
        return res.status(400).json({ error: 'Feedback category is required.' });
      }
      const cleanCategory = FEEDBACK_CATEGORY_MAP[rawCategory] || (FEEDBACK_VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null);
      if (!cleanCategory) {
        return res.status(400).json({ error: 'Invalid feedback category selected.' });
      }

      const cleanSeverity = FEEDBACK_VALID_SEVERITIES.includes(severity) ? severity : 'Moderate';
      const cleanPriority = FEEDBACK_VALID_PRIORITIES.includes(priority) ? priority : 'Medium';

      // Parse diagnostics safely
      let parsedDiagnostics = {};
      try {
        parsedDiagnostics = typeof deviceDiagnostics === 'string' ? JSON.parse(deviceDiagnostics) : (deviceDiagnostics || {});
      } catch (parseErr) {
        parsedDiagnostics = {};
      }

      // Prevent rapid duplicate submissions (within 30 seconds for same user and title)
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const recentDup = await Feedback.findOne({
          reporterEmail: req.user.email.toLowerCase().trim(),
          title: sanitizeString(cleanTitle.slice(0, 200)),
          createdAt: { $gt: new Date(Date.now() - 30 * 1000) }
        }).catch(() => null);
        if (recentDup) {
          return res.status(409).json({
            error: 'A feedback report with this title was already submitted recently. Please check your feedback history.',
            code: 'DUPLICATE_FEEDBACK',
            referenceId: recentDup.referenceId
          });
        }
      }

      // Generate reference ID FB-YYYYMMDD-XXXX
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = crypto.randomBytes(3).toString('hex').toUpperCase();
      const referenceId = `FB-${datePart}-${randPart}`;

      screenshotFileId = null;
      let screenshotFileName = '';
      let screenshotSize = 0;
      let screenshotMime = '';

      // If user uploaded a screenshot, validate content magic bytes and store safely in GridFS
      if (req.file) {
        if (!isValidImageBuffer(req.file.buffer)) {
          return res.status(400).json({
            error: 'Invalid file content. Screenshot must be a genuine PNG, JPEG, or WebP image.',
            code: 'INVALID_IMAGE_SIGNATURE'
          });
        }

        const sanitizedFilename = `feedback-${referenceId}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fileStream = Readable.from(req.file.buffer);
        const uploadResult = await StorageService.uploadToGridFS(
          fileStream,
          sanitizedFilename,
          req.file.mimetype,
          {
            uploadedBy: req.user.email,
            referenceId,
            isFeedbackAttachment: true
          }
        );
        screenshotFileId = uploadResult.gridFsFileId;
        screenshotFileName = sanitizedFilename;
        screenshotSize = req.file.size;
        screenshotMime = req.file.mimetype;
      }

      const feedback = new Feedback({
        referenceId,
        reporterEmail: req.user.email.toLowerCase().trim(),
        reporterName: req.user.name || '',
        category: cleanCategory,
        severity: cleanSeverity,
        priority: cleanPriority,
        status: 'New',
        title: sanitizeString(cleanTitle.slice(0, 200)),
        description: sanitizeString(description.trim().slice(0, 5000)),
        expectedBehavior: sanitizeString((expectedBehavior || '').trim().slice(0, 2000)),
        actualBehavior: sanitizeString((actualBehavior || '').trim().slice(0, 2000)),
        stepsToReproduce: sanitizeString((stepsToReproduce || '').trim().slice(0, 2000)),
        route: sanitizeString((route || '').trim().slice(0, 200)),
        deviceDiagnostics: {
          browser: sanitizeString((parsedDiagnostics.browser || '').slice(0, 100)),
          os: sanitizeString((parsedDiagnostics.os || '').slice(0, 100)),
          viewport: sanitizeString((parsedDiagnostics.viewport || '').slice(0, 50)),
          appVersion: sanitizeString((parsedDiagnostics.appVersion || '2.2.0').slice(0, 50)),
          correlationId: sanitizeString((parsedDiagnostics.correlationId || '').slice(0, 100))
        },
        screenshotFileId,
        screenshotFileName,
        screenshotSize,
        screenshotMime,
        statusHistory: [{
          status: 'New',
          changedBy: req.user.email,
          timestamp: new Date(),
          reason: 'Initial report submission'
        }]
      });

      await feedback.save();

      // Log in audit trail
      activityService.logActivity({
        eventType: 'FEEDBACK_SUBMIT',
        category: 'FEEDBACK',
        actorEmail: req.user.email,
        actorRole: req.user.role,
        targetType: 'Feedback',
        targetId: feedback._id,
        summary: `Submitted feedback: [${cleanCategory}] ${cleanTitle.slice(0, 60)}`,
        outcome: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { referenceId, category: cleanCategory, severity: cleanSeverity }
      });

      res.status(201).json({
        message: 'Feedback submitted successfully. Thank you for helping us improve LOOP!',
        referenceId,
        feedbackId: feedback._id,
        feedback
      });
    } catch (err) {
      if (screenshotFileId) {
        await StorageService.deleteFile(`gridfs:${screenshotFileId}`).catch(() => {});
      }
      console.error('[FEEDBACK_POST_ERROR]', err);
      res.status(500).json({ error: 'Failed to process feedback submission.' });
    }
  });
});

// View authenticated user's own feedback history (internal adminNotes strictly redacted)
app.get('/api/feedback/my', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const list = await Feedback.find({ reporterEmail: req.user.email.toLowerCase().trim() })
      .select('-adminNotes')
      .sort({ createdAt: -1 })
      .lean();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load feedback history.' });
  }
});

// Stream feedback screenshot attachment with permission check
app.get('/api/feedback/attachments/:id', authenticateToken, requireOnboarded, async (req, res) => {
  try {
    const feedback = await Feedback.findOne({ screenshotFileId: req.params.id }).lean();
    if (!feedback) {
      return res.status(404).json({ error: 'Attachment not found.' });
    }

    const isAdmin = isUserAdmin(req.user);
    const isOwner = feedback.reporterEmail.toLowerCase().trim() === req.user.email.toLowerCase().trim();
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied to this attachment.' });
    }

    return await StorageService.streamFromGridFS(
      `gridfs:${req.params.id}`,
      req,
      res,
      feedback.screenshotFileName,
      feedback.screenshotMime || 'image/png'
    );
  } catch (err) {
    console.error('[FEEDBACK_ATTACHMENT_ERROR]', err);
    res.status(500).json({ error: 'Failed to stream screenshot.' });
  }
});

// Admin: Query and filter all feedback submissions
app.get('/api/admin/feedback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      severity,
      priority,
      search
    } = req.query;

    const query = {};
    if (status && status !== 'All') query.status = status;
    if (category && category !== 'All') query.category = category;
    if (severity && severity !== 'All') query.severity = severity;
    if (priority && priority !== 'All') query.priority = priority;

    if (search && typeof search === 'string' && search.trim()) {
      const escaped = escapeRegExp(search.trim());
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { referenceId: { $regex: escaped, $options: 'i' } },
        { reporterEmail: { $regex: escaped, $options: 'i' } }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total, countsByStatus, totalCritical] = await Promise.all([
      Feedback.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Feedback.countDocuments(query),
      Feedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Feedback.countDocuments({ severity: 'Critical', status: { $nin: ['Resolved', 'Closed', 'Rejected'] } })
    ]);

    const statusMetrics = {};
    countsByStatus.forEach(c => { statusMetrics[c._id] = c.count; });

    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      metrics: {
        totalAll: Object.values(statusMetrics).reduce((a, b) => a + b, 0),
        statusCounts: statusMetrics,
        criticalOpen: totalCritical
      }
    });
  } catch (err) {
    console.error('[ADMIN_FEEDBACK_GET_ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve feedback list.' });
  }
});

// Admin: Update feedback status, priority, admin response, notes
app.patch('/api/admin/feedback/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, adminResponse, note, reason } = req.body;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    const updates = {};
    let statusChanged = false;

    if (status && status !== feedback.status) {
      const validStatuses = ['New', 'Acknowledged', 'In Progress', 'Waiting for Information', 'Resolved', 'Closed', 'Rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status value.' });
      }
      updates.status = status;
      statusChanged = true;
      feedback.statusHistory.push({
        status,
        changedBy: req.user.email,
        timestamp: new Date(),
        reason: sanitizeString(reason || '')
      });
    }

    if (priority && FEEDBACK_VALID_PRIORITIES.includes(priority)) {
      updates.priority = priority;
    }
    if (assignedTo !== undefined) {
      updates.assignedTo = sanitizeString(assignedTo.trim());
    }
    if (adminResponse !== undefined) {
      updates.adminResponse = sanitizeString(adminResponse.trim());
    }
    if (note && typeof note === 'string' && note.trim()) {
      feedback.adminNotes.push({
        note: sanitizeString(note.trim()),
        authorEmail: req.user.email,
        createdAt: new Date()
      });
    }

    Object.assign(feedback, updates);
    await feedback.save();

    if (statusChanged) {
      activityService.logActivity({
        eventType: 'FEEDBACK_STATUS_CHANGE',
        category: 'FEEDBACK',
        actorEmail: req.user.email,
        actorRole: req.user.role,
        targetType: 'Feedback',
        targetId: feedback._id,
        summary: `Changed feedback [${feedback.referenceId}] status to ${status}`,
        outcome: 'SUCCESS',
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
        metadata: { referenceId: feedback.referenceId, oldStatus: feedback.status, newStatus: status, reason }
      });
    }

    res.json({ message: 'Feedback updated successfully.', feedback });
  } catch (err) {
    console.error('[ADMIN_FEEDBACK_PATCH_ERROR]', err);
    res.status(500).json({ error: 'Failed to update feedback record.' });
  }
});

// Admin: Delete feedback record and its associated screenshot attachment
app.delete('/api/admin/feedback/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback record not found.' });
    }

    if (feedback.screenshotFileId) {
      await StorageService.deleteFile(`gridfs:${feedback.screenshotFileId}`).catch((delErr) => {
        console.warn(`[FEEDBACK_DELETE] Could not delete GridFS screenshot ${feedback.screenshotFileId}:`, delErr.message);
      });
    }

    await Feedback.findByIdAndDelete(id);

    activityService.logActivity({
      eventType: 'FEEDBACK_DELETE',
      category: 'FEEDBACK',
      actorEmail: req.user.email,
      actorRole: req.user.role,
      targetType: 'Feedback',
      targetId: feedback._id,
      summary: `Permanently deleted feedback [${feedback.referenceId}]: ${feedback.title ? feedback.title.slice(0, 60) : ''}`,
      outcome: 'SUCCESS',
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
      metadata: {
        referenceId: feedback.referenceId,
        title: feedback.title,
        category: feedback.category,
        reporterEmail: feedback.reporterEmail
      }
    });

    res.json({ message: 'Feedback record permanently deleted.', feedbackId: id });
  } catch (err) {
    console.error('[ADMIN_FEEDBACK_DELETE_ERROR]', err);
    res.status(500).json({ error: 'Failed to delete feedback record.' });
  }
});

// ==========================================
// AUDIT TRAILS & USER ACTIVITY INTELLIGENCE
// ==========================================

// Authenticated user's recent activity stream
app.get('/api/users/me/activity', authenticateToken, async (req, res) => {
  try {
    const logs = await ActivityLog.find({ actorEmail: req.user.email.toLowerCase().trim() })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve personal activity history.' });
  }
});

// Admin: Comprehensive, filterable, paginated audit logs
app.get('/api/admin/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page, limit, category, eventType, actorEmail, outcome, search, startDate, endDate } = req.query;
    const result = await activityService.getAuditLogs({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 25,
      category,
      eventType,
      actorEmail,
      outcome,
      search,
      startDate,
      endDate
    });
    res.json(result);
  } catch (err) {
    console.error('[ADMIN_AUDIT_LOGS_GET_ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

// Helper to resolve user by userId param (accepts MongoDB _id or email)
async function resolveUserFromParam(userParam) {
  if (!userParam || typeof userParam !== 'string') return null;
  const trimmed = userParam.trim();
  
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const byIdQuery = User.findById(trimmed);
    const byId = typeof byIdQuery?.lean === 'function' ? await byIdQuery.lean() : await byIdQuery;
    if (byId) return byId;
  }
  
  const byEmailQuery = User.findOne({
    email: new RegExp('^' + escapeRegExp(trimmed.toLowerCase()) + '$', 'i')
  });
  const byEmail = typeof byEmailQuery?.lean === 'function' ? await byEmailQuery.lean() : await byEmailQuery;
  if (byEmail) return byEmail;

  const byUsernameQuery = User.findOne({
    username: new RegExp('^' + escapeRegExp(trimmed.toLowerCase()) + '$', 'i')
  });
  const byUsername = typeof byUsernameQuery?.lean === 'function' ? await byUsernameQuery.lean() : await byUsernameQuery;
  return byUsername;
}

// Admin: Individual User Activity Audit Trail (Actions BY and ON user)
app.get('/api/admin/users/:userId/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userParam = req.params.userId;
    const targetUser = await resolveUserFromParam(userParam);

    const userEmail = targetUser ? targetUser.email : (userParam.includes('@') ? userParam.toLowerCase().trim() : '');
    const userId = targetUser ? String(targetUser._id) : (mongoose.Types.ObjectId.isValid(userParam) ? userParam : '');

    if (!userEmail && !userId) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { page, limit, category, search } = req.query;
    const result = await activityService.getUserActivity({
      userEmail,
      userId,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      category,
      search
    });

    res.json({
      user: targetUser ? sanitizeUser(targetUser) : { email: userEmail, role: 'Unknown', status: 'Deleted / Inactive' },
      events: result.events,
      pagination: result.pagination
    });
  } catch (err) {
    console.error('[ADMIN_USER_ACTIVITY_ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve user activity history.' });
  }
});

// Admin: Individual User Activity Intelligence Summary
app.get('/api/admin/users/:userId/activity/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userParam = req.params.userId;
    const targetUser = await resolveUserFromParam(userParam);

    const userEmail = targetUser ? targetUser.email : (userParam.includes('@') ? userParam.toLowerCase().trim() : '');
    const userId = targetUser ? String(targetUser._id) : (mongoose.Types.ObjectId.isValid(userParam) ? userParam : '');

    if (!userEmail && !userId) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const summary = await activityService.getUserActivitySummary({
      userEmail,
      userId
    });

    res.json({
      user: targetUser ? sanitizeUser(targetUser) : { email: userEmail, role: 'Unknown', status: 'Deleted / Inactive' },
      summary
    });
  } catch (err) {
    console.error('[ADMIN_USER_ACTIVITY_SUMMARY_ERROR]', err);
    res.status(500).json({ error: 'Failed to retrieve user activity summary.' });
  }
});

let server = null;
const HOST = process.env.HOST || '0.0.0.0';

function setupGracefulShutdown(httpServer) {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[SHUTDOWN] Received ${signal}. Closing server and connections gracefully...`);

    if (httpServer && typeof httpServer.close === 'function') {
      httpServer.close(async () => {
        console.log('[SHUTDOWN] HTTP server closed.');
        try {
          await cacheService.shutdown();
          console.log('[SHUTDOWN] Redis cache connection closed.');
        } catch (err) {
          console.error('[SHUTDOWN] Error closing Redis:', err.message);
        }

        try {
          await mongoose.disconnect();
          console.log('[SHUTDOWN] MongoDB connection closed.');
        } catch (err) {
          console.error('[SHUTDOWN] Error closing MongoDB:', err.message);
        }

        process.exit(0);
      });

      // Force termination if connections linger beyond 10s
      setTimeout(() => {
        console.error('[SHUTDOWN] Forcing shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) {
  server = app.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}.`);
    console.log('[UPLOAD ROUTES] chunked upload routes loaded');
    console.log('[UPLOAD ROUTES] GridFS parallel streaming active (200MB limit)');

    // Initial startup cleanup of stale temporary upload chunks
    StorageService.purgeStaleTempUploads(2).catch(() => {});

    // Periodic automatic purge every 60 minutes
    const purgeInterval = setInterval(() => {
      StorageService.purgeStaleTempUploads(2).catch(() => {});
    }, 60 * 60 * 1000);
    purgeInterval.unref();

    setupGracefulShutdown(server);
  });
}

module.exports = {
  app,
  server,
  PORT,
  HOST,
  RATE_LIMIT_CONFIG,
  userAuthCache,
  UserAuthCache,
  normalizeLoginIdentifier,
  getPaginationParams,
  sendPaginatedResponse,
  apiMetrics,
  globalLimiter,
  loginLimiter,
  registerLimiter,
  uploadLimiter,
  fileDownloadLimiter,
  requireOnboarded,
  parseConfiguredOrigins,
  DEFAULT_ALLOWED_ORIGINS,
  RESET_SECRET,
  JWT_SECRET,
  handleUploadFinalize,
  safeDeleteGridFSFileIfOrphaned,
  RESUME_MAX_FILE_SIZE_BYTES,
  getSectionVisibility,
  DEFAULT_SECTION_VISIBILITY
};
