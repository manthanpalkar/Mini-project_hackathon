/**
 * ============================================================================
 * LOOP SPIT — Optimized MongoDB GridFS Parallel Chunked Upload Client
 * Copyright (c) 2026 The Lawful Rights Holders. All Rights Reserved.
 * Proprietary and Confidential.
 * ============================================================================
 *
 * Architecture:
 * - Direct HTTP chunk streaming from browser into MongoDB GridFS
 * - 4-8 concurrent HTTP requests (default: 6 concurrent connections)
 * - 8 MB chunk slicing via file.slice() without loading entire file into memory
 * - Exponential backoff retries on transient network drops
 * - Resumable upload session tracking
 * - Real-time MB/s bandwidth speed calculation and accurate ETA countdown
 * - Instant request cancellation via AbortController and server-side chunk purging
 * - Idempotent finalization preventing duplicate records or GridFS files
 */

export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB (209,715,200 bytes)
export const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB default chunk size (was 8 MB)
export const DEFAULT_CONCURRENCY = 6; // 6 parallel chunk streams
export const MAX_RETRIES_PER_CHUNK = 5;

export const SUPPORTED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
  'xls', 'xlsx', 'csv', 'ods',
  'ppt', 'pptx', 'odp',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
  'zip', 'rar', '7z',
  'java', 'py', 'js', 'jsx', 'ts', 'tsx', 'c', 'cpp', 'h',
  'css', 'html', 'json', 'xml', 'sql', 'md'
];

export const formatBytes = (bytes, decimals = 1) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const formatSpeed = (bytesPerSec) => {
  if (!bytesPerSec || bytesPerSec <= 0) return 'Preparing...';
  const mbps = bytesPerSec / (1024 * 1024);
  if (mbps >= 1.0) {
    return `${mbps.toFixed(1)} MB/s`;
  }
  const kbps = bytesPerSec / 1024;
  return `${kbps.toFixed(0)} KB/s`;
};

export const formatEta = (seconds) => {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return 'Calculating...';
  }
  if (seconds === 0) return 'Finishing...';
  if (seconds < 60) return `${Math.ceil(seconds)} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s`;
};

export const getFileExtension = (filename = '') => {
  const parts = filename.split('.');
  if (parts.length <= 1) return '';
  return parts.pop().toLowerCase().trim();
};

export const validateFile = (file) => {
  if (!file) {
    throw new Error('Please select a file to upload.');
  }

  // Strictly enforce 200 MB limit
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File exceeds the maximum allowed size of 200 MB.');
  }

  if (file.size <= 0) {
    throw new Error('Selected file is empty (0 bytes).');
  }

  const ext = getFileExtension(file.name);
  if (ext && !SUPPORTED_EXTENSIONS.includes(ext)) {
    const cleanMime = (file.type || '').toLowerCase();
    const isCommonType = cleanMime.startsWith('image/') || 
                         cleanMime.startsWith('text/') || 
                         cleanMime.includes('pdf') || 
                         cleanMime.includes('document') ||
                         cleanMime.includes('sheet') ||
                         cleanMime.includes('presentation') ||
                         cleanMime.includes('zip');
    if (!isCommonType) {
      throw new Error(`Unsupported file type (.${ext}). Please upload an educational document, spreadsheet, presentation, image, archive, or code file.`);
    }
  }

  return true;
};

const getAuthHeaders = () => {
  const userSession = localStorage.getItem('loop_current_user');
  const headers = { 'Content-Type': 'application/json' };
  let token = null;
  let isAdmin = false;
  if (userSession) {
    try {
      const parsed = JSON.parse(userSession);
      token = parsed.token;
      isAdmin = Boolean(parsed.isAdmin || parsed.role === 'Admin' || parsed.role === 'Administrator');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
  }
  return { headers, token, isAdmin };
};

export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return '/api';
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://loop-qnh9.onrender.com/api';
};

/**
 * Execute High-Speed Parallel Chunked Upload into MongoDB GridFS
 */
export async function uploadResourceStream({
  file,
  title,
  description,
  category,
  folderId,
  semester,
  year,
  tags,
  apiUrl = getApiBaseUrl(),
  onProgress,
  abortController
}) {
  validateFile(file);

  const cleanApiUrl = apiUrl.replace(/\/$/, '');
  const { headers, token, isAdmin } = getAuthHeaders();
  const initEndpoint = isAdmin
    ? `${cleanApiUrl}/resources/upload/init`
    : `${cleanApiUrl}/pending-resources/upload/init`;

  // 1. Initialize Chunked Upload Session
  let initRes;
  try {
    initRes = await fetch(initEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        folderId: folderId || 'system-placement-material',
        title: title || file.name.replace(/\.[^/.]+$/, ''),
        description: description || '',
        category: category || 'General',
        semester: semester || '',
        year: year || '',
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : [])
      }),
      signal: abortController?.signal
    });
  } catch (netErr) {
    if (abortController?.signal?.aborted) throw new Error('Upload cancelled');
    throw new Error(`Failed to connect to upload server: ${netErr.message}`);
  }

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error || `Upload initialization failed (${initRes.status})`);
  }

  const initData = await initRes.json();
  const { uploadId, chunkSize = DEFAULT_CHUNK_SIZE, totalChunks, concurrency = DEFAULT_CONCURRENCY } = initData;

  // 2. Track multi-chunk progress & speed metrics
  const activeChunkBytes = new Array(totalChunks).fill(0);
  let startTime = Date.now();
  let lastSpeedCalcTime = startTime;
  let lastSpeedCalcBytes = 0;
  let smoothedSpeed = 0;

  const emitProgress = () => {
    if (!onProgress) return;
    const loadedBytes = activeChunkBytes.reduce((sum, b) => sum + b, 0);
    const totalBytes = file.size;
    const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));

    const now = Date.now();
    const timeDelta = (now - lastSpeedCalcTime) / 1000;
    if (timeDelta >= 0.25) {
      const bytesDelta = loadedBytes - lastSpeedCalcBytes;
      const currentSpeed = bytesDelta / timeDelta;
      if (currentSpeed >= 0) {
        smoothedSpeed = smoothedSpeed === 0 ? currentSpeed : (0.75 * smoothedSpeed + 0.25 * currentSpeed);
      }
      lastSpeedCalcTime = now;
      lastSpeedCalcBytes = loadedBytes;
    }

    const remainingBytes = Math.max(0, totalBytes - loadedBytes);
    const remainingSecs = smoothedSpeed > 0 ? Math.round(remainingBytes / smoothedSpeed) : null;

    onProgress({
      percent,
      loadedBytes,
      totalBytes,
      loadedFormatted: formatBytes(loadedBytes),
      totalFormatted: formatBytes(totalBytes),
      speedFormatted: formatSpeed(smoothedSpeed),
      etaFormatted: formatEta(remainingSecs),
      remainingSecs
    });
  };

  // 3. Parallel Upload Worker Queue
  const chunkEndpoint = isAdmin
    ? `${cleanApiUrl}/resources/upload/chunk`
    : `${cleanApiUrl}/pending-resources/upload/chunk`;

  const activeXhrs = new Set();

  const uploadSingleChunk = async (chunkIndex) => {
    const startByte = chunkIndex * chunkSize;
    const endByte = Math.min(file.size, startByte + chunkSize);
    const chunkBlob = file.slice(startByte, endByte);
    const expectedSize = endByte - startByte;

    let attempt = 0;
    while (attempt < MAX_RETRIES_PER_CHUNK) {
      if (abortController?.signal?.aborted) {
        throw new Error('Upload cancelled');
      }

      try {
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          activeXhrs.add(xhr);
          xhr.timeout = 60000; // 60-second socket timeout to prevent indefinite hangs on dead connections

          xhr.open('PUT', chunkEndpoint);
          xhr.setRequestHeader('x-upload-id', uploadId);
          xhr.setRequestHeader('x-chunk-index', String(chunkIndex));
          xhr.setRequestHeader('x-chunk-size', String(expectedSize));
          xhr.setRequestHeader('Content-Type', 'application/octet-stream');
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

          const onAbort = () => {
            xhr.abort();
            reject(new Error('Upload cancelled'));
          };

          if (abortController) {
            abortController.signal.addEventListener('abort', onAbort);
          }

          if (xhr.upload) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                activeChunkBytes[chunkIndex] = e.loaded;
                emitProgress();
              }
            };
          }

          xhr.onload = () => {
            activeXhrs.delete(xhr);
            if (abortController) abortController.signal.removeEventListener('abort', onAbort);

            if (xhr.status >= 200 && xhr.status < 300) {
              activeChunkBytes[chunkIndex] = expectedSize;
              emitProgress();
              resolve();
            } else if (xhr.status === 400 || xhr.status === 401 || xhr.status === 403 || xhr.status === 404) {
              // Non-retryable client error
              try {
                const errJson = JSON.parse(xhr.responseText);
                reject(new Error(errJson.error || `Chunk upload rejected (${xhr.status})`));
              } catch {
                reject(new Error(`Chunk upload failed (${xhr.status})`));
              }
            } else {
              // Transient 5xx server error, eligible for retry
              reject(new Error(`Server error (${xhr.status}) on chunk ${chunkIndex}`));
            }
          };

          xhr.onerror = () => {
            activeXhrs.delete(xhr);
            if (abortController) abortController.signal.removeEventListener('abort', onAbort);
            reject(new Error('Network connection error on chunk upload'));
          };

          xhr.ontimeout = () => {
            activeXhrs.delete(xhr);
            if (abortController) abortController.signal.removeEventListener('abort', onAbort);
            reject(new Error('Timeout on chunk upload'));
          };

          xhr.send(chunkBlob);
        });

        // Chunk uploaded successfully
        return;
      } catch (err) {
        if (err.message === 'Upload cancelled' || abortController?.signal?.aborted) {
          throw err;
        }

        attempt++;
        activeChunkBytes[chunkIndex] = 0;
        emitProgress();
        if (attempt >= MAX_RETRIES_PER_CHUNK) {
          throw new Error(`Failed to upload chunk ${chunkIndex + 1} of ${totalChunks} after ${MAX_RETRIES_PER_CHUNK} attempts: ${err.message}`);
        }

        // Exponential backoff: 500ms, 1s, 2s, 4s
        const backoffDelay = Math.min(4000, 500 * Math.pow(2, attempt - 1));
        await new Promise(r => setTimeout(r, backoffDelay));
      }
    }
  };

  // 4. Run queue with controlled concurrency (e.g. 6 parallel workers)
  let nextChunkIndex = 0;
  const workerCount = Math.min(concurrency, totalChunks);
  const workers = [];

  const workerLoop = async () => {
    while (nextChunkIndex < totalChunks) {
      if (abortController?.signal?.aborted) throw new Error('Upload cancelled');
      const currentIndex = nextChunkIndex++;
      await uploadSingleChunk(currentIndex);
    }
  };

  try {
    for (let w = 0; w < workerCount; w++) {
      workers.push(workerLoop());
    }
    await Promise.all(workers);
  } catch (err) {
    // Abort active XHRs and clean up server temporary chunks
    activeXhrs.forEach(xhr => xhr.abort());
    if (uploadId) {
      const cancelEndpoint = isAdmin
        ? `${cleanApiUrl}/resources/upload/${uploadId}`
        : `${cleanApiUrl}/pending-resources/upload/${uploadId}`;
      fetch(cancelEndpoint, { method: 'DELETE', headers }).catch(() => {});
    }
    throw err;
  }

  // 5. Finalize upload and stitch chunks into final GridFS file (Idempotent)
  if (onProgress) {
    onProgress({
      percent: 99,
      loadedBytes: file.size,
      totalBytes: file.size,
      loadedFormatted: formatBytes(file.size),
      totalFormatted: formatBytes(file.size),
      speedFormatted: 'Finalizing...',
      etaFormatted: 'A few seconds...'
    });
  }

  const finalizeEndpoint = isAdmin
    ? `${cleanApiUrl}/resources/upload/finalize`
    : `${cleanApiUrl}/pending-resources/upload/finalize`;

  console.log('[UPLOAD FINALIZE]', {
    method: 'POST',
    url: finalizeEndpoint,
    uploadId
  });

  const finalizeRes = await fetch(finalizeEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ uploadId }),
    signal: abortController?.signal
  });

  if (!finalizeRes.ok) {
    let errMessage = `Finalization failed (${finalizeRes.status})`;
    try {
      const errJson = await finalizeRes.json();
      errMessage = errJson.error || errJson.message || errMessage;
    } catch {}
    throw new Error(errMessage);
  }

  const finalData = await finalizeRes.json();
  const createdResource = finalData.resource || finalData;

  if (onProgress) {
    onProgress({
      percent: 100,
      loadedBytes: file.size,
      totalBytes: file.size,
      loadedFormatted: formatBytes(file.size),
      totalFormatted: formatBytes(file.size),
      speedFormatted: 'Done',
      etaFormatted: 'Complete',
      remainingSecs: 0
    });
  }

  return createdResource;
}

// Aliases for compatibility
export const uploadDirectGridFS = uploadResourceStream;
export default uploadResourceStream;

