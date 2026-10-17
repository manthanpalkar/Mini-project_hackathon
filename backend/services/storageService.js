const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

// 200 MB maximum upload limit (209,715,200 bytes)
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// Configurable chunk size and concurrency
const GRIDFS_CHUNK_SIZE_MB = Math.max(1, Math.min(32, parseInt(process.env.GRIDFS_CHUNK_SIZE_MB || '8', 10)));
const CHUNK_SIZE_BYTES = GRIDFS_CHUNK_SIZE_MB * 1024 * 1024; // Default: 8 MB
const GRIDFS_UPLOAD_CONCURRENCY = Math.max(2, Math.min(12, parseInt(process.env.GRIDFS_UPLOAD_CONCURRENCY || '6', 10))); // Default: 6

// Final storage GridFS chunk size (4 MB)
const FINAL_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;

// Supported file formats whitelist
const SUPPORTED_EXTENSIONS = new Set([
  // Documents
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
  // Spreadsheets
  'xls', 'xlsx', 'csv', 'ods',
  // Presentations
  'ppt', 'pptx', 'odp',
  // Images
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
  // Archives
  'zip', 'rar', '7z',
  // Code / Text
  'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'c', 'cpp', 'h',
  'css', 'html', 'json', 'xml', 'sql', 'md'
]);

// Explicitly blocked dangerous executable formats
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'com', 'scr', 'vbs', 'app', 'bin', 'ps1', 'jar'
]);

// Allowed MIME prefixes & specific types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed', 'application/x-7z-compressed',
  'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'application/json', 'application/xml', 'text/markdown'
]);

/**
 * Check if a file extension and MIME type are permitted
 */
function isAllowedFile({ filename = '', mimeType = '' }) {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase().trim() : '';

  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return false;
  }

  if (ext && SUPPORTED_EXTENSIONS.has(ext)) {
    return true;
  }

  if (mimeType) {
    const cleanMime = mimeType.toLowerCase().split(';')[0].trim();
    if (ALLOWED_MIME_TYPES.has(cleanMime)) return true;
    if (cleanMime.startsWith('image/') || cleanMime.startsWith('text/')) return true;
    if (cleanMime.includes('pdf') || cleanMime.includes('document') || cleanMime.includes('sheet') || cleanMime.includes('presentation')) {
      return true;
    }
  }

  return false;
}

/**
 * Classify file into human-readable category for UI badges
 */
function getFileTypeCategory(mimeType = '', filename = '') {
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase().trim() : '';
  const cleanMime = (mimeType || '').toLowerCase();

  if (ext === 'pdf' || cleanMime.includes('pdf')) return 'PDF';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || cleanMime.startsWith('image/')) return 'Image';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || cleanMime.includes('spreadsheet') || cleanMime.includes('excel') || cleanMime.includes('csv')) return 'Sheet';
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext) || cleanMime.includes('word') || cleanMime.includes('officedocument.word')) return 'Document';
  if (['ppt', 'pptx', 'odp'].includes(ext) || cleanMime.includes('presentation') || cleanMime.includes('powerpoint')) return 'Presentation';
  if (['zip', 'rar', '7z'].includes(ext) || cleanMime.includes('zip') || cleanMime.includes('compressed')) return 'Archive';
  if (['java', 'py', 'js', 'jsx', 'ts', 'tsx', 'c', 'cpp', 'h', 'css', 'html', 'json', 'xml', 'sql', 'md'].includes(ext)) return 'Code';

  return 'Document';
}

/**
 * Format bytes to readable string
 */
function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get or initialize main GridFSBucket instance ('loop_resources')
 */
let gridFsBucket = null;
function getGridFSBucket() {
  if (!gridFsBucket) {
    if (!mongoose.connection || !mongoose.connection.db) {
      throw new Error('MongoDB connection is not established.');
    }
    gridFsBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'loop_resources',
      chunkSizeBytes: FINAL_CHUNK_SIZE_BYTES
    });
  }
  return gridFsBucket;
}

/**
 * Get or initialize temporary chunks GridFSBucket ('loop_temp_chunks')
 */
let tempChunksBucket = null;
function getTempChunksBucket() {
  if (!tempChunksBucket) {
    if (!mongoose.connection || !mongoose.connection.db) {
      throw new Error('MongoDB connection is not established.');
    }
    tempChunksBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'loop_temp_chunks',
      chunkSizeBytes: 2 * 1024 * 1024
    });
  }
  return tempChunksBucket;
}

/**
 * Save an individual temporary chunk
 * Idempotent: if chunk already exists with expected size, returns existing info.
 */
async function saveTempChunk({ uploadId, chunkIndex, chunkStream, expectedSize }) {
  const bucket = getTempChunksBucket();
  const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;

  // Check if chunk already exists (idempotency protection)
  const existingFiles = await bucket.find({
    filename: chunkFileName,
    'metadata.uploadId': uploadId,
    'metadata.chunkIndex': chunkIndex
  }).toArray();

  if (existingFiles.length > 0) {
    const existing = existingFiles[0];
    if (expectedSize === undefined || existing.length === expectedSize) {
      // Drain input stream so socket doesn't hang
      chunkStream.resume();
      return {
        chunkIndex,
        size: existing.length,
        duplicate: true
      };
    }
    // Size mismatch: delete corrupt chunk before rewriting
    for (const file of existingFiles) {
      await bucket.delete(file._id).catch(() => {});
    }
  }

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(chunkFileName, {
      metadata: {
        uploadId,
        chunkIndex,
        createdAt: new Date()
      }
    });

    chunkStream.pipe(uploadStream)
      .on('error', (err) => {
        bucket.delete(uploadStream.id).catch(() => {});
        reject(err);
      })
      .on('finish', (savedFile) => {
        resolve({
          chunkIndex,
          size: uploadStream.length || savedFile?.length || 0,
          duplicate: false
        });
      });
  });
}

/**
 * Query uploaded chunk indexes for an uploadId (used for resumability)
 */
async function getUploadedChunkIndexes(uploadId) {
  const bucket = getTempChunksBucket();
  const files = await bucket.find({ 'metadata.uploadId': uploadId }).toArray();
  const uploadedChunks = files.map(f => f.metadata.chunkIndex).sort((a, b) => a - b);
  const totalUploadedBytes = files.reduce((sum, f) => sum + (f.length || 0), 0);
  return {
    uploadedChunks,
    count: files.length,
    totalUploadedBytes
  };
}

/**
 * Clean up all temporary chunks for an uploadId
 */
async function cleanupTempChunks(uploadId) {
  try {
    const bucket = getTempChunksBucket();
    const files = await bucket.find({ 'metadata.uploadId': uploadId }).toArray();
    for (const file of files) {
      await bucket.delete(file._id).catch(() => {});
    }

    // If temp bucket is now completely empty, drop collections to reclaim WiredTiger disk space immediately
    const remainingTempFiles = await bucket.find({}).limit(1).toArray();
    if (remainingTempFiles.length === 0 && mongoose.connection?.db) {
      await mongoose.connection.db.collection('loop_temp_chunks.chunks').drop().catch(() => {});
      await mongoose.connection.db.collection('loop_temp_chunks.files').drop().catch(() => {});
      tempChunksBucket = null;
    }

    return files.length;
  } catch (err) {
    console.warn('[Cleanup Temp Chunks] Warning:', err.message);
    return 0;
  }
}

/**
 * Automatically purge stale temporary chunks and upload sessions older than maxAgeHours
 * Reclaims storage on MongoDB Atlas Free Tier to prevent quota limits.
 */
async function purgeStaleTempUploads(maxAgeHours = 2) {
  try {
    if (!mongoose.connection || !mongoose.connection.db) return 0;
    const db = mongoose.connection.db;
    const bucket = getTempChunksBucket();
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const staleFiles = await bucket.find({ uploadDate: { $lt: cutoff } }).toArray();
    let purgedCount = 0;
    for (const file of staleFiles) {
      await bucket.delete(file._id).catch(() => {});
      purgedCount++;
    }

    // Also purge stale upload session records
    await db.collection('uploadsessions').deleteMany({
      $or: [
        { updatedAt: { $lt: cutoff } },
        { createdAt: { $lt: cutoff } }
      ]
    }).catch(() => {});

    // If temp bucket is now completely empty, drop collections to reclaim WiredTiger disk space immediately
    const remainingTempFiles = await bucket.find({}).limit(1).toArray();
    if (remainingTempFiles.length === 0) {
      await db.collection('loop_temp_chunks.chunks').drop().catch(() => {});
      await db.collection('loop_temp_chunks.files').drop().catch(() => {});
      tempChunksBucket = null;
    }

    if (purgedCount > 0) {
      console.log(`[Storage Cleanup] Purged ${purgedCount} stale upload chunks older than ${maxAgeHours}h.`);
    }
    return purgedCount;
  } catch (err) {
    console.warn('[Storage Cleanup] Error purging stale uploads:', err.message);
    return 0;
  }
}


/**
 * Assemble final GridFS file from verified temporary chunks in index order
 * Streams directly from temp chunk bucket to final bucket with bounded memory.
 */
async function assembleFinalGridFSFile({ uploadId, totalChunks, expectedFileSize, fileName, mimeType, metadata = {} }) {
  const tempBucket = getTempChunksBucket();
  const finalBucket = getGridFSBucket();

  // 1. Verify all expected chunks exist
  const tempFiles = await tempBucket.find({ 'metadata.uploadId': uploadId }).toArray();
  const chunkMap = new Map();
  for (const file of tempFiles) {
    chunkMap.set(file.metadata.chunkIndex, file);
  }

  for (let i = 0; i < totalChunks; i++) {
    if (!chunkMap.has(i)) {
      throw new Error(`Missing chunk index ${i} of ${totalChunks}. Upload is incomplete.`);
    }
  }

  // Verify total uploaded bytes matches expected file size
  const totalFileSize = tempFiles.reduce((sum, c) => sum + (c.length || 0), 0);
  if (expectedFileSize && totalFileSize !== expectedFileSize) {
    throw new Error(`Total uploaded bytes (${totalFileSize}) does not match expected file size (${expectedFileSize}).`);
  }

  // 2. Open final upload stream
  const finalUploadStream = finalBucket.openUploadStream(fileName, {
    chunkSizeBytes: FINAL_CHUNK_SIZE_BYTES,
    contentType: mimeType || 'application/octet-stream',
    metadata: {
      ...metadata,
      uploadedAt: new Date()
    }
  });

  // 3. Sequentially stream each chunk in exact order 0, 1, 2, ...
  for (let i = 0; i < totalChunks; i++) {
    const chunkFile = chunkMap.get(i);
    await new Promise((resolve, reject) => {
      const downloadStream = tempBucket.openDownloadStream(chunkFile._id);
      downloadStream.on('error', reject);

      downloadStream.on('data', (dataChunk) => {
        const canContinue = finalUploadStream.write(dataChunk);
        if (!canContinue) {
          downloadStream.pause();
          finalUploadStream.once('drain', () => {
            downloadStream.resume();
          });
        }
      });

      downloadStream.on('end', () => {
        resolve();
      });
    });
  }

  // Finalize the final upload stream
  await new Promise((resolve, reject) => {
    finalUploadStream.on('error', reject);
    finalUploadStream.on('finish', resolve);
    finalUploadStream.end();
  });

  // 4. Delete temporary chunks now that the file is safely stitched
  try {
    await cleanupTempChunks(uploadId);
  } catch (cleanErr) {
    console.warn('[Assemble Cleanup Temp Chunks] Warning:', cleanErr.message);
  }

  return {
    storageKey: `gridfs:${finalUploadStream.id.toString()}`,
    gridFsFileId: finalUploadStream.id,
    fileId: finalUploadStream.id,
    fileName,
    size: totalFileSize,
    contentType: mimeType
  };
}

/**
 * Single-stream upload fallback (used if client does direct stream)
 */
function uploadToGridFS(readableStream, filename, mimeType, metadata = {}) {
  return new Promise((resolve, reject) => {
    try {
      const bucket = getGridFSBucket();
      const uploadStream = bucket.openUploadStream(filename, {
        chunkSizeBytes: FINAL_CHUNK_SIZE_BYTES,
        contentType: mimeType || 'application/octet-stream',
        metadata: {
          ...metadata,
          uploadedAt: new Date()
        }
      });

      readableStream.pipe(uploadStream)
        .on('error', (err) => {
          console.error('[GridFS Upload] Stream error:', err);
          reject(err);
        })
        .on('finish', (file) => {
          resolve({
            storageKey: `gridfs:${uploadStream.id.toString()}`,
            gridFsFileId: uploadStream.id,
            fileId: uploadStream.id,
            filename: uploadStream.filename,
            size: uploadStream.length || file?.length || 0,
            contentType: mimeType
          });
        });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Stream file from MongoDB GridFS directly to HTTP response
 * Supports HTTP Range requests (206 Partial Content), ETag, and 304 caching.
 */
async function streamFromGridFS(storageKey, req, res, originalFileName, mimeType, isPrivate = false) {
  const rawId = (storageKey || '').replace(/^gridfs:/, '');
  let objectId;
  try {
    objectId = new ObjectId(rawId);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid file ID format.' });
  }

  let bucket;
  try {
    bucket = getGridFSBucket();
  } catch (err) {
    return res.status(503).json({ error: 'Database storage service unavailable.' });
  }

  const files = await bucket.find({ _id: objectId }).toArray();
  if (!files || files.length === 0) {
    return res.status(404).json({ error: 'File not found in storage.' });
  }

  const file = files[0];
  const fileSize = file.length;
  const filename = originalFileName || file.filename || 'download';
  const cleanExt = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';

  // Resolve precise canonical MIME type based on file extension
  let resolvedContentType = mimeType || file.contentType || 'application/octet-stream';
  if (cleanExt === 'pdf') resolvedContentType = 'application/pdf';
  else if (cleanExt === 'pptx') resolvedContentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  else if (cleanExt === 'ppt') resolvedContentType = 'application/vnd.ms-powerpoint';
  else if (cleanExt === 'docx') resolvedContentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  else if (cleanExt === 'doc') resolvedContentType = 'application/msword';
  else if (cleanExt === 'xlsx') resolvedContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  else if (cleanExt === 'xls') resolvedContentType = 'application/vnd.ms-excel';
  else if (cleanExt === 'csv') resolvedContentType = 'text/csv';
  else if (cleanExt === 'png') resolvedContentType = 'image/png';
  else if (cleanExt === 'jpg' || cleanExt === 'jpeg') resolvedContentType = 'image/jpeg';
  else if (cleanExt === 'webp') resolvedContentType = 'image/webp';
  else if (cleanExt === 'mp4') resolvedContentType = 'video/mp4';
  else if (cleanExt === 'webm') resolvedContentType = 'video/webm';
  else if (cleanExt === 'zip') resolvedContentType = 'application/zip';

  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const dispositionType = isDownload ? 'attachment' : 'inline';

  const uploadTime = file.uploadDate ? new Date(file.uploadDate).getTime() : 0;
  const etag = `"${file._id.toString()}-${fileSize}-${uploadTime}"`;
  const lastModified = file.uploadDate ? new Date(file.uploadDate).toUTCString() : new Date().toUTCString();

  res.setHeader('Content-Type', resolvedContentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', lastModified);
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

  if (isPrivate) {
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  }

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }

  const range = req.headers.range;
  if (range && range.startsWith('bytes=')) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).end();
    }

    const chunkSize = (end - start) + 1;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    const downloadStream = bucket.openDownloadStream(objectId, {
      start,
      end: end + 1
    });

    downloadStream.on('error', (err) => {
      console.error('[GridFS Stream Range] Error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(err);
      }
    });

    res.on('close', () => {
      if (!downloadStream.destroyed) {
        downloadStream.destroy();
      }
    });

    downloadStream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    const downloadStream = bucket.openDownloadStream(objectId);

    downloadStream.on('error', (err) => {
      console.error('[GridFS Stream] Error:', err);
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy(err);
      }
    });

    res.on('close', () => {
      if (!downloadStream.destroyed) {
        downloadStream.destroy();
      }
    });

    downloadStream.pipe(res);
  }
}

/**
 * Delete file from GridFS storage (or legacy local uploads if applicable)
 */
async function deleteFile(storageKeyOrObj, storageProvider) {
  try {
    let key = storageKeyOrObj;
    if (typeof storageKeyOrObj === 'object' && storageKeyOrObj !== null) {
      key = storageKeyOrObj.storageKey || storageKeyOrObj.fileUrl || storageKeyOrObj.fileId || (storageKeyOrObj._id ? storageKeyOrObj._id.toString() : '');
    }

    if (!key || typeof key !== 'string') return false;

    if (key.startsWith('gridfs:')) {
      const bucket = getGridFSBucket();
      const rawId = key.replace(/^gridfs:/, '');
      if (ObjectId.isValid(rawId)) {
        await bucket.delete(new ObjectId(rawId));
        return true;
      }
    }

    if (key.includes('/file/')) {
      const bucket = getGridFSBucket();
      const rawId = key.split('/file/')[1]?.split('?')[0];
      if (rawId && ObjectId.isValid(rawId)) {
        await bucket.delete(new ObjectId(rawId));
        return true;
      }
    }

    if (ObjectId.isValid(key)) {
      const bucket = getGridFSBucket();
      await bucket.delete(new ObjectId(key));
      return true;
    }

    if (key.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '..', key);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.warn('[Storage Delete] Warning:', err.message);
    return false;
  }
}

module.exports = {
  MAX_FILE_SIZE,
  GRIDFS_CHUNK_SIZE_MB,
  CHUNK_SIZE_BYTES,
  GRIDFS_UPLOAD_CONCURRENCY,
  FINAL_CHUNK_SIZE_BYTES,
  SUPPORTED_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  isAllowedFile,
  getFileTypeCategory,
  formatBytes,
  getGridFSBucket,
  getTempChunksBucket,
  saveTempChunk,
  getUploadedChunkIndexes,
  cleanupTempChunks,
  purgeStaleTempUploads,
  assembleFinalGridFSFile,
  uploadToGridFS,
  streamFromGridFS,
  deleteFile
};
