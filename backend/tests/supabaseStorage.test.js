const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const {
  app,
  userAuthCache,
  supabaseStorageService,
  RESUME_MAX_FILE_SIZE_BYTES,
  STUDY_MATERIAL_MAX_FILE_SIZE_BYTES,
  BUCKET_RESUMES,
  BUCKET_STUDY_MATERIALS
} = require('../server');
const { User, PendingStory } = require('../models');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'spit_loop_super_secret_jwt_key_2026';

function generateAuthToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

test('Supabase Storage Architecture & Limits Tests', async (t) => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let testStudentToken;
  let testAdminToken;
  let otherStudentToken;

  const mockUsers = {
    'student.aarav@spit.ac.in': {
      email: 'student.aarav@spit.ac.in',
      name: 'Aarav Sharma',
      role: 'student',
      status: 'Active',
      onboarded: true,
      branch: 'CSE'
    },
    'admin@spit.ac.in': {
      email: 'admin@spit.ac.in',
      name: 'Administrator',
      role: 'admin',
      status: 'Active',
      onboarded: true
    },
    'student.other@spit.ac.in': {
      email: 'student.other@spit.ac.in',
      name: 'Other Student',
      role: 'student',
      status: 'Active',
      onboarded: true,
      branch: 'IT'
    }
  };

  await t.before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalUserFindOne = User.findOne;
    User.findOne = (query) => {
      let email = '';
      if (query?.email instanceof RegExp) {
        email = query.email.source.replace(/^\^|\\\.|[$\/i]/g, (m) => m === '\\.' ? '.' : '').toLowerCase();
      } else if (typeof query?.email === 'string') {
        email = query.email.toLowerCase();
      }
      const found = mockUsers[email] || null;
      return {
        lean: async () => found,
        then: (resolve) => resolve(found)
      };
    };

    for (const [em, u] of Object.entries(mockUsers)) {
      userAuthCache.set(em, u);
    }

    testStudentToken = generateAuthToken(mockUsers['student.aarav@spit.ac.in']);
    testAdminToken = generateAuthToken(mockUsers['admin@spit.ac.in']);
    otherStudentToken = generateAuthToken(mockUsers['student.other@spit.ac.in']);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  await t.after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    User.findOne = originalUserFindOne;
    for (const em of Object.keys(mockUsers)) {
      userAuthCache.invalidate(em);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  await t.test('1. Configuration & Limits: GET /api/storage/limits returns exact configured limits', async () => {
    const res = await fetch(`${baseUrl}/api/storage/limits`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.resumeMaxBytes, 10 * 1024 * 1024, 'Resume limit must be exactly 10 MB');
    assert.strictEqual(data.resumeMaxFormatted, '10 MB');
    assert.ok(data.studyMaterialMaxBytes >= 50 * 1024 * 1024, 'Study material limit must be at least 50 MB');
    assert.strictEqual(data.buckets.resumes, 'resumes');
    assert.strictEqual(data.buckets.studyMaterials, 'study-materials');
    assert.strictEqual(data.planInfo.freePlanMaxFileSize, '50 MB');
    assert.strictEqual(data.planInfo.proPlanMaxFileSize, '5 GB');
  });

  await t.test('2. Resume Upload Validation: Rejects unauthenticated upload with 401', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from('%PDF-1.4 test resume content'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/storage/upload/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    assert.strictEqual(res.status, 401, 'Unauthenticated request must be rejected with 401');
  });

  await t.test('3. Resume Upload Validation: Rejects non-PDF file formats with 400', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="resume.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`),
      Buffer.from('fake docx content'),
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

    assert.strictEqual(res.status, 400, 'Non-PDF resume must be rejected with 400');
    const data = await res.json();
    assert.ok(data.error.includes('PDF'), 'Error message must specify PDF requirement');
  });

  await t.test('4. Resume Upload: Accepts valid PDF up to 10 MB and returns Supabase storage metadata', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const dummyPdfContent = Buffer.alloc(1024 * 100, '%PDF-1.4 sample content'); // 100 KB PDF
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="Aarav_Resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      dummyPdfContent,
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
    assert.strictEqual(data.fileName, 'Aarav_Resume.pdf');
    assert.strictEqual(data.storageProvider, 'supabase');
    assert.strictEqual(data.bucket, 'resumes');
    assert.ok(data.storagePath.includes('student_aarav_spit_ac_in/'));
    assert.ok(data.url.startsWith('/api/storage/files/resumes/'));
  });

  await t.test('5. Resume Upload Validation: Rejects resume exceeding 10 MB with HTTP 413', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const oversizedPdfContent = Buffer.alloc(11 * 1024 * 1024, '%PDF-1.4 oversized content'); // 11 MB PDF
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="huge_resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      oversizedPdfContent,
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

    assert.strictEqual(res.status, 413, 'Resume over 10 MB must be rejected with 413 Payload Too Large');
    const data = await res.json();
    assert.strictEqual(data.code, 'FILE_TOO_LARGE');
    assert.ok(data.error.includes('10 MB'), 'Error message must mention 10 MB limit');
  });

  await t.test('6. Study Material Upload: Supports large PDF over 20 MB (24 MB)', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const largePdfContent = Buffer.alloc(24 * 1024 * 1024, '%PDF-1.4 24MB study notes'); // 24 MB PDF
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nDSA Comprehensive Notes\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="category"\r\n\r\nDSA Preparation\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="dsa_full_notes.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
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

    assert.strictEqual(res.status, 201, '24 MB study material must succeed without 20 MB arbitrary block');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.title, 'DSA Comprehensive Notes');
    assert.strictEqual(data.type, 'PDF');
    assert.strictEqual(data.storageProvider, 'supabase');
    assert.strictEqual(data.bucket, 'study-materials');
    assert.ok(data.url.startsWith('/api/storage/files/study-materials/'));
  });

  await t.test('7. Study Material Upload: Rejects dangerous executable files with 400', async () => {
    const boundary = '----WebKitFormBoundaryTest123';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="malicious.exe"\r\nContent-Type: application/x-msdownload\r\n\r\n`),
      Buffer.from('MZ binary data'),
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
  });

  await t.test('8. Security & Authorization: Unauthenticated file access is rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/storage/files/resumes/some_path/test.pdf`);
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated access with 401');
  });

  await t.test('9. Security & Authorization: Other students cannot access private pending story documents (403)', async () => {
    // 1. Upload a file as Aarav
    const boundary = '----WebKitFormBoundaryTest123';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="confidential_resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from('%PDF-1.4 confidential content'),
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

    // Mock PendingStory.findOne to simulate pending ownership
    const origFindOne = PendingStory.findOne;
    PendingStory.findOne = () => ({
      lean: async () => ({
        id: 'pending-123',
        name: 'Aarav Story',
        uploadedByEmail: 'student.aarav@spit.ac.in',
        resumeFile: {
          fileName: 'confidential_resume.pdf',
          url: upData.url,
          storagePath: upData.storagePath
        }
      })
    });

    try {
      // Access as Other Student -> 403 Forbidden
      const accessRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${otherStudentToken}`
        }
      });
      assert.strictEqual(accessRes.status, 403, 'Unrelated student must be denied access with 403 Forbidden');

      // Access as Author -> 200
      const authorRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${testStudentToken}`
        }
      });
      assert.strictEqual(authorRes.status, 200, 'Author must be able to view their pending file');

      // Access as Admin -> 200
      const adminRes = await fetch(`${baseUrl}${upData.url}`, {
        headers: {
          Authorization: `Bearer ${testAdminToken}`
        }
      });
      assert.strictEqual(adminRes.status, 200, 'Admin must be able to view pending files for moderation');
    } finally {
      PendingStory.findOne = origFindOne;
    }
  });

  await t.test('10. Security: Path traversal attempts are rejected', async () => {
    const res = await fetch(`${baseUrl}/api/storage/files/resumes/../etc/passwd`, {
      headers: {
        Authorization: `Bearer ${testStudentToken}`
      }
    });
    assert.ok(res.status === 400 || res.status === 404, 'Path traversal must be safely rejected');
  });
});
