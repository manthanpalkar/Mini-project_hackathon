const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Storage Limits
const RESUME_MAX_FILE_SIZE_BYTES = parseInt(process.env.RESUME_MAX_FILE_SIZE_BYTES || String(10 * 1024 * 1024), 10); // Strictly 10 MB

// Study Material Limit: Configurable via env var, defaults to 50 MB (Supabase Free Plan limit)
const parseStudyMaterialLimit = () => {
  if (process.env.STUDY_MATERIAL_MAX_FILE_SIZE_BYTES) {
    const parsed = parseInt(process.env.STUDY_MATERIAL_MAX_FILE_SIZE_BYTES, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.STUDY_MATERIAL_MAX_FILE_SIZE_MB) {
    const parsedMb = parseFloat(process.env.STUDY_MATERIAL_MAX_FILE_SIZE_MB);
    if (!isNaN(parsedMb) && parsedMb > 0) return Math.round(parsedMb * 1024 * 1024);
  }
  return 50 * 1024 * 1024; // Default: 50 MB (Supabase Free plan standard single-file limit)
};

const STUDY_MATERIAL_MAX_FILE_SIZE_BYTES = parseStudyMaterialLimit();

// Bucket Configuration (Private buckets)
const BUCKET_RESUMES = process.env.SUPABASE_RESUME_BUCKET || 'resumes';
const BUCKET_STUDY_MATERIALS = process.env.SUPABASE_STUDY_MATERIAL_BUCKET || 'study-materials';

// Allowed MIME types and extensions
const ALLOWED_RESUME_MIME_TYPES = new Set(['application/pdf']);
const ALLOWED_RESUME_EXTENSIONS = new Set(['pdf']);

const ALLOWED_STUDY_MATERIAL_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
  'xls', 'xlsx', 'csv',
  'ppt', 'pptx',
  'png', 'jpg', 'jpeg', 'webp',
  'zip'
]);

const ALLOWED_STUDY_MATERIAL_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed'
]);

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sanitizeFilename(originalName = 'file') {
  const base = path.basename(originalName);
  const ext = path.extname(base);
  const nameWithoutExt = path.basename(base, ext);
  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 100);
  return `${cleanName}${ext.toLowerCase()}`;
}

// In-Memory store for tests / local development without live Supabase credentials
const localMockStorage = new Map();

class SupabaseStorageService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL || '';
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.isConfigured = Boolean(this.supabaseUrl && this.serviceRoleKey);

    if (this.isConfigured) {
      this.client = createClient(this.supabaseUrl, this.serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } else {
      this.client = null;
    }
  }

  getLimits() {
    return {
      resumeMaxBytes: RESUME_MAX_FILE_SIZE_BYTES,
      resumeMaxFormatted: formatBytes(RESUME_MAX_FILE_SIZE_BYTES),
      studyMaterialMaxBytes: STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
      studyMaterialMaxFormatted: formatBytes(STUDY_MATERIAL_MAX_FILE_SIZE_BYTES),
      buckets: {
        resumes: BUCKET_RESUMES,
        studyMaterials: BUCKET_STUDY_MATERIALS
      },
      isConfigured: this.isConfigured,
      planInfo: {
        provider: 'Supabase Storage',
        freePlanMaxFileSize: '50 MB',
        proPlanMaxFileSize: '5 GB',
        currentConfiguredMax: formatBytes(STUDY_MATERIAL_MAX_FILE_SIZE_BYTES),
        storagePolicy: 'Strictly bounded per-file and per-tier limits (not unlimited)'
      }
    };
  }

  validateResume({ filename, mimeType, sizeBytes }) {
    if (!filename || typeof filename !== 'string') {
      return { valid: false, error: 'Resume file name is required.' };
    }
    const ext = filename.split('.').pop()?.toLowerCase().trim();
    if (!ext || !ALLOWED_RESUME_EXTENSIONS.has(ext)) {
      return { valid: false, error: 'Invalid file format. Resumes must strictly be PDF (.pdf) documents.' };
    }
    if (mimeType && !ALLOWED_RESUME_MIME_TYPES.has(mimeType.toLowerCase().split(';')[0].trim())) {
      return { valid: false, error: 'Invalid MIME type. Resumes must strictly be application/pdf.' };
    }
    if (!sizeBytes || sizeBytes <= 0) {
      return { valid: false, error: 'Resume file is empty.' };
    }
    if (sizeBytes > RESUME_MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Resume size (${formatBytes(sizeBytes)}) exceeds the 10 MB limit. Please compress your PDF and try again.`
      };
    }
    return { valid: true };
  }

  validateStudyMaterial({ filename, mimeType, sizeBytes }) {
    if (!filename || typeof filename !== 'string') {
      return { valid: false, error: 'Study material file name is required.' };
    }
    const ext = filename.split('.').pop()?.toLowerCase().trim();
    if (!ext || !ALLOWED_STUDY_MATERIAL_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Unsupported file type (.${ext}). Supported types include: PDF, Word (DOC/DOCX), Images, Text, Presentations.`
      };
    }
    if (!sizeBytes || sizeBytes <= 0) {
      return { valid: false, error: 'Study material file is empty.' };
    }
    if (sizeBytes > STUDY_MATERIAL_MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `Study material size (${formatBytes(sizeBytes)}) exceeds the configured limit of ${formatBytes(STUDY_MATERIAL_MAX_FILE_SIZE_BYTES)}. For larger notes or sets, please link a Google Drive folder.`
      };
    }
    return { valid: true };
  }

  async ensureBuckets() {
    if (!this.isConfigured || !this.client) return;
    try {
      const { data: buckets, error } = await this.client.storage.listBuckets();
      if (error) {
        console.warn('[SupabaseStorage] Warning listing buckets:', error.message);
        return;
      }
      const existing = new Set((buckets || []).map(b => b.name));

      // Resumes bucket (Private)
      if (!existing.has(BUCKET_RESUMES)) {
        await this.client.storage.createBucket(BUCKET_RESUMES, {
          public: false,
          fileSizeLimit: RESUME_MAX_FILE_SIZE_BYTES,
          allowedMimeTypes: ['application/pdf']
        });
        console.log(`[SupabaseStorage] Created private bucket: ${BUCKET_RESUMES}`);
      }

      // Study materials bucket (Private)
      if (!existing.has(BUCKET_STUDY_MATERIALS)) {
        await this.client.storage.createBucket(BUCKET_STUDY_MATERIALS, {
          public: false,
          fileSizeLimit: STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
          allowedMimeTypes: Array.from(ALLOWED_STUDY_MATERIAL_MIME_TYPES)
        });
        console.log(`[SupabaseStorage] Created private bucket: ${BUCKET_STUDY_MATERIALS}`);
      }
    } catch (err) {
      console.warn('[SupabaseStorage] Could not ensure buckets automatically:', err.message);
    }
  }

  /**
   * Upload file buffer to Supabase Storage
   */
  async uploadFile({ bucket, storagePath, fileBuffer, mimeType, upsert = false }) {
    if (!this.isConfigured || !this.client) {
      // Mock storage for local test environments
      const key = `${bucket}:${storagePath}`;
      localMockStorage.set(key, {
        buffer: Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer),
        mimeType,
        uploadedAt: new Date()
      });
      return {
        path: storagePath,
        bucket,
        fullPath: `${bucket}/${storagePath}`,
        isMock: true
      };
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return {
      path: data.path || storagePath,
      bucket,
      fullPath: `${bucket}/${data.path || storagePath}`,
      id: data.id
    };
  }

  /**
   * Generate short-lived signed URL for private file access
   */
  async getSignedUrl({ bucket, storagePath, expiresInSeconds = 300 }) {
    if (!this.isConfigured || !this.client) {
      const key = `${bucket}:${storagePath}`;
      if (!localMockStorage.has(key)) {
        throw new Error('File not found in storage');
      }
      return `/api/storage/files/${bucket}/${storagePath}?token=mock-signed-token`;
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Download file buffer from storage
   */
  async downloadFile({ bucket, storagePath }) {
    if (!this.isConfigured || !this.client) {
      const key = `${bucket}:${storagePath}`;
      const item = localMockStorage.get(key);
      if (!item) {
        throw new Error('File not found in storage');
      }
      return {
        buffer: item.buffer,
        mimeType: item.mimeType
      };
    }

    const { data, error } = await this.client.storage
      .from(bucket)
      .download(storagePath);

    if (error) {
      throw new Error(`Failed to download file from Supabase Storage: ${error.message}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: data.type
    };
  }

  /**
   * Delete file from storage
   */
  async deleteFile({ bucket, storagePath }) {
    if (!this.isConfigured || !this.client) {
      const key = `${bucket}:${storagePath}`;
      localMockStorage.delete(key);
      return { success: true };
    }

    const { error } = await this.client.storage
      .from(bucket)
      .remove([storagePath]);

    if (error) {
      throw new Error(`Failed to delete file from Supabase Storage: ${error.message}`);
    }

    return { success: true };
  }
}

const supabaseStorageService = new SupabaseStorageService();

module.exports = {
  supabaseStorageService,
  SupabaseStorageService,
  RESUME_MAX_FILE_SIZE_BYTES,
  STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
  BUCKET_RESUMES,
  BUCKET_STUDY_MATERIALS,
  formatBytes,
  sanitizeFilename,
  localMockStorage
};
