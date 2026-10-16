require('dotenv').config();
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
const { User, Story, Resource, Achievement, Folder, PendingStory, PendingResource, UploadSession } = require('./models');
const StorageService = require('./services/storageService');
const { ensureSystemFolders } = require('./scripts/initSystemFolders');
const { verifyGoogleToken } = require('./services/googleAuth');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5001;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.trim().length < 32) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is missing or less than 32 characters.');
  process.exit(1);
}

const RATE_LIMIT_CONFIG = {
  GLOBAL_MAX: 1500,
  LOGIN_MAX: 10,
  REGISTER_MAX: 10,
  UPLOAD_MAX: 30,
  DOWNLOAD_MAX: 60,
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

// Middlewares

// Enable CORS with restricted origin access
const DEFAULT_ALLOWED_ORIGINS = [
  'https://loop-seven-delta.vercel.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
];

const envAllowed = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...envAllowed]));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests with no origin (mobile clients, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
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
// Large binary files are streamed directly via GridFS/busboy chunk endpoints and bypass express.json
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

// Apply Global Limiter to all API endpoints
app.use('/api/', globalLimiter);

// Apply strict rate limiting to login and registration routes
app.use('/api/users/login', loginLimiter);
app.use('/api/users/register-request', registerLimiter);
app.use(['/api/auth/google', '/api/users/google', '/api/users/auth/google'], loginLimiter);

// Apply granular rate limiting to resource downloads and file upload sessions
app.use(['/api/resources/:id/file', '/api/pending-resources/:id/file'], fileDownloadLimiter);
app.use(['/api/upload-session', '/api/resources/upload/init', '/api/pending-resources/upload/init'], uploadLimiter);

// Prevent NoSQL query injection by stripping keys starting with $ or .
app.use(mongoSanitize());

// --- Helper Functions for Security & File Uploads ---

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

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
  }

  get(email) {
    if (!email || typeof email !== 'string') return null;
    const key = email.toLowerCase().trim();
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
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
  }

  size() {
    return this.cache.size;
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
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is required. Please login.' });
  }

  try {
    // 1. Always verify cryptographic signature and expiration first
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = (decoded.email || '').trim();
    if (!email) {
      return res.status(401).json({ error: 'User session invalid. Email claim missing.' });
    }

    // 2. Check short-lived in-memory cache before executing remote database query
    let user = userAuthCache.get(email);
    if (!user) {
      user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email) + '$', 'i') });
      if (!user) {
        return res.status(401).json({ error: 'User session invalid. User not found.' });
      }
      userAuthCache.set(email, user);
    }

    // 3. Immediately enforce account suspension or deactivation
    if (user.status !== 'Active') {
      userAuthCache.invalidate(email);
      return res.status(403).json({ error: 'Your account is inactive or pending approval.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Session expired or token invalid. Please sign in again.' });
  }
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


// Database connection
const primaryUri = process.env.MONGODB_URI;
const fallbackUri = 'mongodb://127.0.0.1:27017/loop_db';

// Disable buffering so that queries fail fast instead of hanging when database is offline
mongoose.set('bufferCommands', false);

async function connectWithFallback() {
  if (primaryUri && primaryUri !== fallbackUri) {
    console.log('Attempting to connect to primary MongoDB database...');
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 4000, // fail fast
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
      console.log('Falling back to local MongoDB database...');
    }
  }

  try {
    await mongoose.connect(fallbackUri, {
      serverSelectionTimeoutMS: 4000
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

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    name: 'LOOP Backend API',
    version: '2.2.0-gridfs-streaming',
    uploadRoutes: true
  });
});

// Middleware to check database connection status before handling API requests
app.use((req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/' || req.path === '/api/upload-route-health' || req.path === '/upload-route-health') {
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
app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    const { category, parentId } = req.query;
    const isAdmin = isUserAdmin(req.user);
    const userEmail = req.user ? req.user.email : null;
    const userId = req.user ? req.user.id : null;

    // Base query:
    // 1. System folders: visible to all authenticated users
    // 2. Public folders: visible to all authenticated users
    // 3. Private folders: ONLY visible to owner or Admin
    const visibilityConditions = [
      { folderType: 'system' },
      { visibility: 'public' }
    ];

    if (isAdmin) {
      visibilityConditions.push({ visibility: 'private' });
    } else if (userEmail || userId) {
      visibilityConditions.push({
        visibility: 'private',
        $or: [
          ...(userEmail ? [{ ownerEmail: userEmail }] : []),
          ...(userId ? [{ ownerId: userId }] : [])
        ]
      });
    }

    let filter = { $or: visibilityConditions };

    if (category === 'system') {
      filter = { folderType: 'system' };
    } else if (category === 'public') {
      filter = { folderType: 'user', visibility: 'public' };
    } else if (category === 'private') {
      if (isAdmin) {
        filter = { folderType: 'user', visibility: 'private' };
      } else {
        filter = {
          folderType: 'user',
          visibility: 'private',
          $or: [
            ...(userEmail ? [{ ownerEmail: userEmail }] : []),
            ...(userId ? [{ ownerId: userId }] : [])
          ]
        };
      }
    }

    if (parentId !== undefined) {
      filter.parentId = parentId === 'null' || parentId === '' ? null : parentId;
    }

    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    if (isPaginated) {
      const total = await Folder.countDocuments(filter);
      const folders = await Folder.find(filter)
        .sort({ isSystemFolder: -1, createdAt: 1, _id: -1 })
        .skip(skip)
        .limit(limit);

      return sendPaginatedResponse(res, folders, total, page, limit);
    }

    const folders = await Folder.find(filter).sort({ isSystemFolder: -1, createdAt: 1, _id: -1 });
    res.set('X-Total-Count', String(folders.length));
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const { name, description, parentId, visibility, allowContributions, isSystemFolder } = req.body;
    const isAdmin = isUserAdmin(req.user);

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

    res.status(201).json(folder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/folders/:id', authenticateToken, async (req, res) => {
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
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
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
      const children = await Folder.find({ parentId });
      for (const child of children) {
        allFolderIdsToDelete.push(child.id);
        await collectChildren(child.id);
      }
    };
    await collectChildren(id);

    // Clean up physical/cloud storage files for all resources inside deleted folders
    const resourcesToDelete = await Resource.find({ folderId: { $in: allFolderIdsToDelete } });
    for (const resItem of resourcesToDelete) {
      if (resItem.storageKey) {
        await StorageService.deleteFile(resItem.storageKey, resItem.storageProvider);
      }
    }

    // Delete records from database
    await Resource.deleteMany({ folderId: { $in: allFolderIdsToDelete } });
    await Folder.deleteMany({ id: { $in: allFolderIdsToDelete } });

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
        .limit(limit);

      return sendPaginatedResponse(res, users, total, page, limit);
    }

    const users = await User.find({}).select('-password -__v').sort({ createdAt: -1, _id: -1 });
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

    const passwordVal = (password && typeof password === 'string') ? password.trim() : 'spit123';
    const hashedPassword = await bcrypt.hash(passwordVal, 10);

    const userData = {
      email: email.trim().toLowerCase(),
      role: sanitizeString(role.trim()),
      password: hashedPassword,
      name: name ? sanitizeString(name.trim()) : '',
      branch: branch ? sanitizeString(branch.trim()) : '',
      currentYear: currentYear ? sanitizeString(String(currentYear).trim()) : '',
      status: status || 'Active',
    };

    const user = await User.create(userData);
    userAuthCache.invalidate(email);
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

app.post('/api/users/login', async (req, res) => {
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

    // Case-insensitive, trimmed, regex-escaped email search (prevents ReDoS)
    const user = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (!user) {
      return res.status(401).json({ error: 'User not found in the database. Please contact an administrator.' });
    }
    
    if (user.status === 'Pending') {
      return res.status(403).json({ error: 'Your registration request is pending administrator approval.' });
    }
    
    if (user.status !== 'Active') {
      return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
    }
    
    // Compare bcrypt passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }
    
    // Sign JWT
    const token = jwt.sign(
      { email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: isUserAdmin ? true : user.onboarded,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { sub, email, name } = payload;

    // 1. Check if user already exists with this googleSub
    let user = await User.findOne({ googleSub: sub });

    if (user) {
      if (user.status === 'Pending') {
        return res.status(403).json({ error: 'Your registration request is pending administrator approval.' });
      }
      if (user.status !== 'Active') {
        return res.status(403).json({ error: 'Your account is currently inactive. Please contact an administrator.' });
      }

      // Existing returning Google user - direct login without repeating signup
      const token = jwt.sign(
        { email: user.email, role: user.role, status: user.status },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
      return res.json({
        action: 'LOGIN_SUCCESS',
        email: user.email,
        role: isUserAdmin ? 'Administrator' : user.role,
        status: user.status,
        name: user.name,
        username: user.username || '',
        branch: user.branch,
        currentYear: user.currentYear,
        onboarded: isUserAdmin ? true : user.onboarded,
        isAdmin: isUserAdmin,
        nameColor: user.nameColor || '',
        token
      });
    }

    // 2. Check if a user with this email exists without linked googleSub
    const existingByEmail = await User.findOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    if (existingByEmail) {
      return res.json({
        action: 'LINK_REQUIRED',
        email: existingByEmail.email,
        name: existingByEmail.name,
        message: 'An account with this SPIT email already exists. Please enter your account password to securely link your Google account.'
      });
    }

    // 3. New user - needs first-time signup
    return res.json({
      action: 'NEEDS_SIGNUP',
      email,
      name
    });
  } catch (err) {
    const status = err.status || 500;
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

    // Sign JWT
    const token = jwt.sign(
      { email: newUser.email, role: newUser.role, status: newUser.status },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

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
      token
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

    // Verify existing password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password. Unable to link Google account.' });
    }

    // Ensure googleSub is not linked to another user
    const otherUser = await User.findOne({ googleSub: sub, _id: { $ne: user._id } });
    if (otherUser) {
      return res.status(400).json({ error: 'This Google account is already linked to another user.' });
    }

    user.googleSub = sub;
    if (!user.authProvider || user.authProvider === 'local') {
      user.authProvider = 'google';
    }
    await user.save();
    userAuthCache.invalidate(email);

    const token = jwt.sign(
      { email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    return res.json({
      action: 'LOGIN_SUCCESS',
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      username: user.username || '',
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: isUserAdmin ? true : user.onboarded,
      isAdmin: isUserAdmin,
      nameColor: user.nameColor || '',
      token
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
    if (!trimmedEmail.endsWith('@spit.ac.in')) {
      return res.status(400).json({ error: 'Please use your official SPIT email address (@spit.ac.in).' });
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
    if (password !== undefined && password.trim()) {
      user.password = await bcrypt.hash(password.trim(), 10);
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
    
    const isUserAdmin = user.email.toLowerCase() === 'admin@spit.ac.in' || user.role === 'Administrator' || user.role === 'Admin';
    res.json({
      email: user.email,
      role: isUserAdmin ? 'Administrator' : user.role,
      status: user.status,
      name: user.name,
      branch: user.branch,
      currentYear: user.currentYear,
      onboarded: user.onboarded,
      isAdmin: isUserAdmin
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
    await User.deleteOne({ email: new RegExp('^' + escapeRegExp(email.trim()) + '$', 'i') });
    userAuthCache.invalidate(email);
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
app.get('/api/stories', authenticateToken, async (req, res) => {
  try {
    const { isPaginated, page, limit, skip } = getPaginationParams(req.query, 20, 100);

    if (isPaginated) {
      const total = await Story.countDocuments({});
      const stories = await Story.find({})
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select('-journey -resumeFile -studyMaterials -customSections -photo -resume');

      return sendPaginatedResponse(res, stories, total, page, limit);
    }

    // Exclude heavy fields from the listing payload and sort newest first with deterministic order
    const stories = await Story.find({})
      .sort({ createdAt: -1, _id: -1 })
      .select('-journey -resumeFile -studyMaterials -customSections -photo -resume');
    res.set('X-Total-Count', String(stories.length));
    res.json(stories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stories/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sanitizedId = sanitizeString(id);
    const story = await Story.findOne({ id: sanitizedId });
    if (!story) {
      return res.status(404).json({ error: 'Story not found.' });
    }
    res.json(story);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stories', authenticateToken, requireAdmin, async (req, res) => {
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
    res.status(201).json(story);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/stories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fileError = validateStoryFiles(req.body);
    if (fileError) {
      return res.status(400).json({ error: fileError });
    }

    const processedBody = processStoryFiles(req.body);
    const sanitizedBody = sanitizeObject({ ...processedBody });
    const story = await Story.findOneAndUpdate({ id: req.params.id }, sanitizedBody, { new: true });
    if (!story) return res.status(404).json({ error: 'Story not found.' });
    res.json(story);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/stories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Story.deleteOne({ id: req.params.id });
    res.json({ message: 'Story deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Pending Stories
app.get('/api/pending-stories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await PendingStory.find({});
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-stories', authenticateToken, async (req, res) => {
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
    await PendingStory.deleteOne(query);
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
    res.json({ message: 'Story approved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Resources

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
    const chunkSize = StorageService.CHUNK_SIZE_BYTES; // Configurable, default 8 MB
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

const handleUploadFinalize = async (req, res) => {
  try {
    const { uploadId } = req.body;
    if (!uploadId) {
      return res.status(400).json({ error: 'uploadId is required.' });
    }

    const session = await UploadSession.findOne({ uploadId });
    if (!session) {
      return res.status(404).json({ error: 'Upload session not found.' });
    }

    // Idempotency: if already finalized, return existing record immediately
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

    // Assemble final GridFS file in exact chunk index order
    const assembledFile = await StorageService.assembleFinalGridFSFile({
      uploadId,
      totalChunks: session.totalChunks,
      expectedFileSize: session.fileSize,
      fileName: session.fileName,
      mimeType: session.mimeType,
      metadata: {
        uploadedBy: session.uploadedBy,
        uploadedByEmail: session.uploadedByEmail
      }
    });

    const resourceId = String(Date.now());
    const detectedType = StorageService.getFileTypeCategory(session.mimeType, session.fileName);
    const resourceUrl = `/api/resources/${resourceId}/file`;

    let createdRecord;
    if (session.isPending) {
      createdRecord = await PendingResource.create({
        id: resourceId,
        title: session.title || session.fileName.replace(/\.[^/.]+$/, ''),
        description: session.description || '',
        category: session.category || 'General',
        type: detectedType,
        originalFileName: session.fileName,
        mimeType: session.mimeType,
        size: assembledFile.size || session.fileSize,
        fileSizeFormatted: StorageService.formatBytes(assembledFile.size || session.fileSize),
        storageProvider: 'gridfs',
        storageKey: assembledFile.storageKey,
        gridFsFileId: assembledFile.gridFsFileId,
        url: resourceUrl,
        folderId: session.folderId,
        ownerId: session.ownerId,
        uploadedBy: session.uploadedBy,
        uploadedByEmail: session.uploadedByEmail,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        semester: session.semester,
        year: session.year
      });
    } else {
      createdRecord = await Resource.create({
        id: resourceId,
        title: session.title || session.fileName.replace(/\.[^/.]+$/, ''),
        description: session.description || '',
        category: session.category || 'General',
        type: detectedType,
        originalFileName: session.fileName,
        mimeType: session.mimeType,
        size: assembledFile.size || session.fileSize,
        fileSizeFormatted: StorageService.formatBytes(assembledFile.size || session.fileSize),
        storageProvider: 'gridfs',
        storageKey: assembledFile.storageKey,
        gridFsFileId: assembledFile.gridFsFileId,
        url: resourceUrl,
        folderId: session.folderId,
        ownerId: session.ownerId,
        uploadedBy: session.uploadedBy,
        uploadedByEmail: session.uploadedByEmail,
        date: new Date().toISOString().split('T')[0],
        status: 'approved',
        semester: session.semester,
        year: session.year,
        tags: session.tags || []
      });
    }

    // Update session as finalized
    session.isFinalized = true;
    session.finalResourceId = resourceId;
    session.finalGridFsId = assembledFile.gridFsFileId;
    await session.save();

    res.status(200).json({
      success: true,
      uploadId,
      resourceId,
      fileId: assembledFile.gridFsFileId,
      message: 'Upload completed successfully',
      resource: createdRecord
    });
  } catch (err) {
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
app.post('/api/resources/upload/init', authenticateToken, handleUploadInit);
app.post('/api/pending-resources/upload/init', authenticateToken, handleUploadInit);
app.post(['/api/resources/upload/init', '/api/pending-resources/upload/init'], authenticateToken, handleUploadInit);

// 2. Parallel Chunk Transfer (PUT and POST)
app.put('/api/resources/upload/chunk', authenticateToken, handleUploadChunkPut);
app.put('/api/pending-resources/upload/chunk', authenticateToken, handleUploadChunkPut);
app.post('/api/resources/upload/chunk', authenticateToken, handleUploadChunkPost);
app.post('/api/pending-resources/upload/chunk', authenticateToken, handleUploadChunkPost);

// 3. Finalize Chunked Upload
app.post('/api/resources/upload/finalize', authenticateToken, handleUploadFinalize);
app.post('/api/pending-resources/upload/finalize', authenticateToken, handleUploadFinalize);
app.post(['/api/resources/upload/finalize', '/api/pending-resources/upload/finalize'], authenticateToken, handleUploadFinalize);

// 4. Query Upload State / Resumability
app.get('/api/resources/upload/:uploadId', authenticateToken, handleUploadStatus);
app.get('/api/pending-resources/upload/:uploadId', authenticateToken, handleUploadStatus);

// 5. Cancel / Abort Upload Session
app.delete('/api/resources/upload/:uploadId', authenticateToken, handleUploadCancel);
app.delete('/api/pending-resources/upload/:uploadId', authenticateToken, handleUploadCancel);

// List Resources with folder privacy & permission checks
app.get('/api/resources', authenticateToken, async (req, res) => {
  try {
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

    if (isPaginated) {
      const total = await Resource.countDocuments(filter);
      const resources = await Resource.find(filter)
        .select('-link')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit);

      return sendPaginatedResponse(res, resources, total, page, limit);
    }

    const resources = await Resource.find(filter)
      .select('-link')
      .sort({ createdAt: -1, _id: -1 });

    res.set('X-Total-Count', String(resources.length));
    res.json(resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single Resource Metadata
app.get('/api/resources/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await Resource.findOne({ id: sanitizeString(id) });
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    // Verify folder privacy
    const folder = await Folder.findOne({ id: resource.folderId });
    const isAdmin = isUserAdmin(req.user);
    const isUploader = resource.uploadedByEmail === req.user.email;

    if (folder && folder.visibility === 'private') {
      const isFolderOwner = folder.ownerEmail === req.user.email || (folder.ownerId && String(folder.ownerId) === String(req.user.id));
      if (!isFolderOwner && !isUploader && !isAdmin) {
        return res.status(403).json({ error: 'Access denied to private resource.' });
      }
    }

    res.json(resource);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Secure File Streaming / Download / Preview
app.get(['/api/resources/:id/file', '/api/pending-resources/:id/file'], authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let resource = await Resource.findOne({ id: sanitizeString(id) });
    if (!resource) {
      resource = await PendingResource.findOne({ id: sanitizeString(id) });
    }
    if (!resource) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    // Verify privacy
    const folder = await Folder.findOne({ id: resource.folderId });
    const isAdmin = isUserAdmin(req.user);
    const isUploader = resource.uploadedByEmail === req.user.email;

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

    // 2. Legacy Local Disk Fallback (Path traversal safe)
    if (resource.link && resource.link.startsWith('/uploads/')) {
      const sanitizedFilename = path.basename(resource.link);
      const uploadsDirResolved = path.resolve(UPLOADS_DIR);
      const localPath = path.resolve(uploadsDirResolved, sanitizedFilename);

      if (localPath.startsWith(uploadsDirResolved + path.sep) && fs.existsSync(localPath)) {
        res.setHeader('Content-Type', resource.mimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalFileName || resource.title)}"`);
        return fs.createReadStream(localPath).pipe(res);
      }
    }

    // 3. Fallback: if gridFsFileId exists or storageKey is raw ObjectId string without prefix
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

    res.status(404).json({ error: 'File content not found in storage.' });
  } catch (err) {
    console.error('File stream error:', err);
    res.status(500).json({ error: 'Failed to stream file.' });
  }
});

// Backward-compatible redirect for download-url
app.get('/api/resources/:id/download-url', authenticateToken, async (req, res) => {
  res.json({ url: `/api/resources/${req.params.id}/file`, provider: 'gridfs' });
});

// Direct Resource Creation Endpoint (Backward compatible with JSON/Base64 and direct posting)
app.post('/api/resources', authenticateToken, async (req, res) => {
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
app.post('/api/resources/upload', authenticateToken, (req, res) => {
  const isAdmin = isUserAdmin(req.user);
  handleStreamingUpload(req, res, { isPending: !isAdmin });
});

// Student & Community Resource Submission Upload Endpoints (Single-file multipart fallback)
app.post('/api/pending-resources/upload', authenticateToken, (req, res) => {
  handleStreamingUpload(req, res, { isPending: true });
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
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

app.patch('/api/resources/:id', authenticateToken, handleUpdateResource);
app.put('/api/resources/:id', authenticateToken, handleUpdateResource);

// Delete Resource (Safe Deletion with Cloud/GridFS cleanup)
app.delete('/api/resources/:id', authenticateToken, async (req, res) => {
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

    // Clean up physical file in GridFS or legacy storage
    if (resource.storageKey) {
      await StorageService.deleteFile(resource.storageKey, resource.storageProvider);
    } else if (resource.gridFsFileId) {
      await StorageService.deleteFile(`gridfs:${resource.gridFsFileId}`);
    } else if (resource.url) {
      await StorageService.deleteFile(resource.url);
    }

    await Resource.deleteOne({ id: resource.id });
    res.json({ message: 'Resource permanently deleted.' });
  } catch (err) {
    console.error('Error in DELETE /api/resources/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Pending Resources
app.get('/api/pending-resources', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const pending = await PendingResource.find({});
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pending-resources', authenticateToken, async (req, res) => {
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
    await PendingResource.deleteOne(query);
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
    res.json({ message: 'Resource approved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Achievements
app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    const achievements = await Achievement.find({});
    res.json(achievements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/achievements', authenticateToken, requireAdmin, async (req, res) => {
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
    res.status(201).json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/achievements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { image } = req.body;
    if (image && !validateFileUri(image, ALLOWED_IMAGE_PREFIXES)) {
      return res.status(400).json({ error: 'Invalid achievement image file format. Only JPEG, PNG, and WebP images are allowed.' });
    }
    const processedBody = processAchievementFiles(req.body);
    const sanitizedBody = sanitizeObject({ ...processedBody });
    const achievement = await Achievement.findOneAndUpdate({ id: req.params.id }, sanitizedBody, { new: true });
    if (!achievement) return res.status(404).json({ error: 'Achievement not found.' });
    res.json(achievement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/achievements/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Achievement.deleteOne({ id: req.params.id });
    res.json({ message: 'Achievement deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

let server = null;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
    console.log('[UPLOAD ROUTES] chunked upload routes loaded');
    console.log('[UPLOAD ROUTES] GridFS parallel streaming active (200MB limit)');

    // Initial startup cleanup of stale temporary upload chunks
    StorageService.purgeStaleTempUploads(2).catch(() => {});

    // Periodic automatic purge every 60 minutes
    setInterval(() => {
      StorageService.purgeStaleTempUploads(2).catch(() => {});
    }, 60 * 60 * 1000);
  });
}

module.exports = {
  app,
  server,
  RATE_LIMIT_CONFIG,
  userAuthCache,
  UserAuthCache,
  getPaginationParams,
  sendPaginatedResponse,
  globalLimiter,
  loginLimiter,
  registerLimiter,
  uploadLimiter,
  fileDownloadLimiter
};
