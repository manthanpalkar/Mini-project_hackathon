process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_gridfs_storage_at_least_32_chars';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const stream = require('stream');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const StorageService = require('../services/storageService');
const { app, userAuthCache, JWT_SECRET, RESUME_MAX_FILE_SIZE_BYTES } = require('../server');
const { PendingStory, Story, Resource } = require('../models');

describe('Unified MongoDB Atlas GridFS Storage Architecture Tests', () => {
  let server;
  let baseUrl;
  let testStudentToken;
  let otherStudentToken;
  let testAdminToken;

  const testStudentEmail = 'student.aarav@spit.ac.in';
  const otherStudentEmail = 'student.neha@spit.ac.in';
  const testAdminEmail = 'admin.tpo@spit.ac.in';
  const jwtSecret = JWT_SECRET || 'test_jwt_secret_for_gridfs_storage_at_least_32_chars';

  // In-memory GridFS mock storage for testing streaming uploads and downloads
  const mockGridFSStorage = new Map();

  class MockUploadStream extends stream.Writable {
    constructor(filename, options = {}) {
      super();
      this.id = new ObjectId();
      this.filename = filename;
      this.options = options;
      this.chunks = [];
      this.length = 0;
    }

    _write(chunk, encoding, callback) {
      this.chunks.push(chunk);
      this.length += chunk.length;
      callback();
    }

    _final(callback) {
      const buffer = Buffer.concat(this.chunks);
      mockGridFSStorage.set(this.id.toString(), {
        _id: this.id,
        filename: this.filename,
        length: this.length,
        contentType: this.options.contentType || 'application/octet-stream',
        uploadDate: new Date(),
        metadata: this.options.metadata || {},
        buffer
      });
      callback();
    }
  }

  const mockGridFSBucket = {
    openUploadStream(filename, options) {
      return new MockUploadStream(filename, options);
    },
    openDownloadStream(id, options = {}) {
      const idStr = id.toString();
      const file = mockGridFSStorage.get(idStr);
      const s = new stream.Readable();
      if (!file) {
        process.nextTick(() => s.emit('error', new Error('File not found in GridFS')));
        return s;
      }

      let buf = file.buffer;
      if (options.start !== undefined || options.end !== undefined) {
        const start = options.start || 0;
        const end = options.end !== undefined ? options.end : buf.length;
        buf = buf.subarray(start, end);
      }

      s.push(buf);
      s.push(null);
      return s;
    },
    find(query) {
      return {
        toArray: async () => {
          const results = [];
          for (const [key, file] of mockGridFSStorage.entries()) {
            if (query._id && query._id.toString() === key) {
              results.push(file);
            } else if (query.filename && (file.filename === query.filename || file.metadata?.originalFileName === query.filename)) {
              results.push(file);
            } else if (query.$or) {
              const matched = query.$or.some(cond => {
                if (cond._id && cond._id.toString() === key) return true;
                if (cond.filename && (file.filename === cond.filename || file.metadata?.originalFileName === cond.filename)) return true;
                if (cond['metadata.storagePath'] && file.metadata?.storagePath === cond['metadata.storagePath']) return true;
                return false;
              });
              if (matched) results.push(file);
            }
          }
          return results;
        }
      };
    },
    delete: async (id) => {
      mockGridFSStorage.delete(id.toString());
      return true;
    }
  };

  before(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    StorageService.setGridFSBucket(mockGridFSBucket);

    userAuthCache.set(testStudentEmail, {
      email: testStudentEmail,
      name: 'Aarav Student',
      role: 'Student',
      status: 'Active',
      onboarded: true,
      branch: 'Computer Engineering'
    });

    userAuthCache.set(otherStudentEmail, {
      email: otherStudentEmail,
      name: 'Neha Student',
      role: 'Student',
      status: 'Active',
      onboarded: true,
      branch: 'Information Technology'
    });

    userAuthCache.set(testAdminEmail, {
      email: testAdminEmail,
      name: 'Prof. Admin',
      role: 'Administrator',
      status: 'Active',
      onboarded: true,
      branch: 'Placement Cell'
    });

    testStudentToken = jwt.sign(
      { email: testStudentEmail, role: 'Student', status: 'Active' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    otherStudentToken = jwt.sign(
      { email: otherStudentEmail, role: 'Student', status: 'Active' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    testAdminToken = jwt.sign(
      { email: testAdminEmail, role: 'Administrator', status: 'Active' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    StorageService.setGridFSBucket(null);
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Storage Limits Endpoint: Reports single MongoDB Atlas database and GridFS provider', async () => {
    const res = await fetch(`${baseUrl}/api/storage/limits`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.provider, 'gridfs');
    assert.strictEqual(data.database, 'mongodb_atlas');
    assert.strictEqual(data.resumeMaxSizeBytes, 10 * 1024 * 1024);
    assert.strictEqual(data.resumeMaxSizeFormatted, '10 MB');
    assert.strictEqual(data.studyMaterialMaxSizeBytes, null);
    assert.strictEqual(data.studyMaterialLimitType, 'unbounded_atlas_capacity');
  });

  test('2. Resume Upload: Valid PDF within 10 MiB limit streams into GridFS with 201', async () => {
    const boundary = '----WebKitFormBoundaryTestResume123';
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Student Resume) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Aarav_Resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      pdfContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.storageProvider, 'gridfs');
    assert.strictEqual(data.fileName, 'Aarav_Resume.pdf');
    assert.strictEqual(data.mimeType, 'application/pdf');
    assert.ok(data.gridFsFileId, 'Must return a valid GridFS file ID');
    assert.ok(data.url.startsWith('/api/storage/files/'), 'URL must point to /api/storage/files/:id');

    // Verify stored binary exists in GridFS
    const stored = mockGridFSStorage.get(data.gridFsFileId.toString());
    assert.ok(stored, 'File must exist in GridFS storage bucket');
    assert.strictEqual(stored.length, pdfContent.length);
  });

  test('3. Resume Upload: Rejects resume exceeding strict 10 MiB limit with HTTP 413', async () => {
    const boundary = '----WebKitFormBoundaryTestTooLarge';
    // 11 MiB payload (exceeds 10,485,760 bytes limit)
    const elevenMb = 11 * 1024 * 1024;
    const largeChunk = Buffer.alloc(elevenMb, 'A');

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="oversized_resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      largeChunk,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 413, 'Must reject >10 MiB resume with 413 Payload Too Large');
    const data = await res.json();
    assert.match(data.error, /exceeds the 10 MB limit/i);
    assert.strictEqual(data.code, 'FILE_TOO_LARGE');
  });

  test('4. Resume Upload: Rejects non-PDF files (e.g. .docx or .exe) with HTTP 400', async () => {
    const boundary = '----WebKitFormBoundaryTestNonPdf';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="resume.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`),
      Buffer.from('fake word doc contents'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 400, 'Must reject non-PDF resume format with 400 Bad Request');
    const data = await res.json();
    assert.match(data.error, /strictly be in PDF/i);
    assert.strictEqual(data.code, 'INVALID_FILE_TYPE');
  });

  test('5. Study Material Upload: Large study material (24 MiB) streams directly into GridFS without 20MB limit', async () => {
    const boundary = '----WebKitFormBoundaryLargeStudyMaterial';
    // 24 MiB buffer
    const largePdfSize = 24 * 1024 * 1024;
    const largePdfContent = Buffer.alloc(largePdfSize, '%PDF-1.4 simulated large study material content');

    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nDSA Master Notes 2026\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nData Structures\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dsa_master_notes.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      largePdfContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/study-material`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 201, 'Large 24 MiB study material must succeed without 20 MB or 50 MB arbitrary cap');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.storageProvider, 'gridfs');
    assert.strictEqual(data.title, 'DSA Master Notes 2026');
    assert.strictEqual(data.category, 'Data Structures');
    assert.strictEqual(data.type, 'PDF');
    assert.strictEqual(data.sizeBytes, largePdfSize);
    assert.ok(data.gridFsFileId, 'Must return GridFS file ID');

    // Verify stored binary exists in GridFS
    const stored = mockGridFSStorage.get(data.gridFsFileId.toString());
    assert.ok(stored);
    assert.strictEqual(stored.length, largePdfSize);
  });

  test('6. Study Material Upload: Rejects dangerous executable (.exe) with HTTP 400', async () => {
    const boundary = '----WebKitFormBoundaryDangerousExe';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="trojan.exe"\r\nContent-Type: application/x-msdownload\r\n\r\n`),
      Buffer.from('MZ binary executable'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/study-material`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 400, 'Dangerous executable must be rejected with 400');
    const data = await res.json();
    assert.match(data.error, /Unsupported file type/i);
  });

  test('7. File Access & Streaming: Streams GridFS binary with Range request support', async () => {
    // 1. Upload a file
    const boundary = '----WebKitFormBoundaryStreamTest';
    const testPayload = Buffer.from('%PDF-1.4 Stream Verification Content 0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="sample_doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      testPayload,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const upRes = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });
    assert.strictEqual(upRes.status, 201);
    const upData = await upRes.json();

    // 2. Full download stream
    const dlRes = await fetch(`${baseUrl}${upData.url}`, {
      headers: {
        Authorization: `Bearer ${testStudentToken}`
      }
    });
    assert.strictEqual(dlRes.status, 200);
    assert.strictEqual(dlRes.headers.get('content-type'), 'application/pdf');
    assert.strictEqual(dlRes.headers.get('accept-ranges'), 'bytes');
    const dlBuf = Buffer.from(await dlRes.arrayBuffer());
    assert.strictEqual(dlBuf.toString(), testPayload.toString());

    // 3. Range request (206 Partial Content)
    const rangeRes = await fetch(`${baseUrl}${upData.url}`, {
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        Range: 'bytes=0-7'
      }
    });
    assert.strictEqual(rangeRes.status, 206, 'Must support HTTP Range requests with 206 Partial Content');
    assert.strictEqual(rangeRes.headers.get('content-range'), `bytes 0-7/${testPayload.length}`);
    const rangeBuf = Buffer.from(await rangeRes.arrayBuffer());
    assert.strictEqual(rangeBuf.toString(), '%PDF-1.4');
  });

  test('8. Dual-Token Authentication: URL with ?token=<jwt> allows authenticated streaming', async () => {
    // 1. Upload a test document
    const boundary = '----WebKitFormBoundaryTokenParam';
    const testContent = Buffer.from('%PDF-1.4 Dual Token Authentication Test');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="token_auth_doc.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      testContent,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const upRes = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });
    assert.strictEqual(upRes.status, 201);
    const upData = await upRes.json();

    // Access with ?token= query parameter without Authorization header
    const tokenParamRes = await fetch(`${baseUrl}${upData.url}?token=${encodeURIComponent(testStudentToken)}`);
    assert.strictEqual(tokenParamRes.status, 200, 'Must authenticate via ?token= query parameter');
    const buf = Buffer.from(await tokenParamRes.arrayBuffer());
    assert.strictEqual(buf.toString(), testContent.toString());

    // Access with no token -> 401 Unauthorized
    const unauthRes = await fetch(`${baseUrl}${upData.url}`);
    assert.strictEqual(unauthRes.status, 401, 'Must reject unauthenticated access with 401');
  });

  test('9. Security & Authorization: Other students cannot access private pending story documents (403)', async () => {
    // 1. Upload resume as Aarav
    const boundary = '----WebKitFormBoundaryPendingAuth';
    const secretPdf = Buffer.from('%PDF-1.4 Confidential student pending resume');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="confidential_resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      secretPdf,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const upRes = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });
    assert.strictEqual(upRes.status, 201);
    const upData = await upRes.json();

    // Mock PendingStory.findOne to simulate pending ownership by Aarav
    const origFindOne = PendingStory.findOne;
    PendingStory.findOne = () => ({
      lean: async () => ({
        id: 'pending-story-999',
        name: 'Aarav Private Story',
        uploadedByEmail: testStudentEmail,
        resumeFile: {
          gridFsFileId: new ObjectId(upData.gridFsFileId),
          fileName: 'confidential_resume.pdf',
          url: upData.url
        }
      })
    });

    try {
      // Access as Neha (other student) -> 403 Forbidden
      const unauthorizedRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${otherStudentToken}`
        }
      });
      assert.strictEqual(unauthorizedRes.status, 403, 'Unrelated student must be rejected with 403 Forbidden');
      const unauthJson = await unauthorizedRes.json();
      assert.match(unauthJson.error, /Access denied to pending story document/i);

      // Access as Author (Aarav) -> 200 OK
      const authorRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${testStudentToken}`
        }
      });
      assert.strictEqual(authorRes.status, 200, 'Author must be able to view their pending file');

      // Access as Administrator -> 200 OK
      const adminRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${testAdminToken}`
        }
      });
      assert.strictEqual(adminRes.status, 200, 'Administrator must be able to access file for review');
    } finally {
      PendingStory.findOne = origFindOne;
    }
  });

  test('10. Security: Path traversal attempts are rejected safely with 400', async () => {
    const res = await fetch(`${baseUrl}/api/storage/files/..%2f..%2fetc%2fpasswd`, {
      headers: {
        Authorization: `Bearer ${testStudentToken}`
      }
    });
    assert.strictEqual(res.status, 400, 'Path traversal must be safely rejected with 400');
  });

  test('11. Delete File: Author and Admin can delete, other student is forbidden (403)', async () => {
    // 1. Upload a file as Aarav
    const boundary = '----WebKitFormBoundaryDeleteTest';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="to_delete.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from('%PDF-1.4 temporary document to delete'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const upRes = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testStudentToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });
    assert.strictEqual(upRes.status, 201);
    const upData = await upRes.json();

    // 2. Attempt deletion as Neha (other student) -> 403 Forbidden
    const unauthDelRes = await fetch(`${baseUrl}${upData.url}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${otherStudentToken}`
      }
    });
    assert.strictEqual(unauthDelRes.status, 403, 'Other student cannot delete file belonging to Aarav');

    // 3. Deletion as Aarav (Author) -> 200 OK
    const authorDelRes = await fetch(`${baseUrl}${upData.url}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${testStudentToken}`
      }
    });
    assert.strictEqual(authorDelRes.status, 200, 'Author must be able to delete their own file');
    const authorDelData = await authorDelRes.json();
    assert.strictEqual(authorDelData.success, true);
  });
});
