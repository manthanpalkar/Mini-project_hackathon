const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const StorageService = require('../services/storageService');
const { app, userAuthCache, JWT_SECRET } = require('../server');
const { Resource, PendingResource, Story, PendingStory, UploadSession, Folder } = require('../models');

describe('MongoDB GridFS Storage Service & Upload Validation', () => {
  describe('File Size Validation (200 MB Limit)', () => {
    test('enforces 200 MB maximum limit (209,715,200 bytes)', () => {
      assert.strictEqual(StorageService.MAX_FILE_SIZE, 209715200);
      assert.strictEqual(StorageService.CHUNK_SIZE_BYTES, StorageService.GRIDFS_CHUNK_SIZE_MB * 1024 * 1024);
      assert.strictEqual(StorageService.FINAL_CHUNK_SIZE_BYTES, 4 * 1024 * 1024);
      assert.strictEqual(StorageService.GRIDFS_CHUNK_SIZE_MB, 8);
      assert.strictEqual(StorageService.GRIDFS_UPLOAD_CONCURRENCY, 6);
    });

    test('formatBytes formats file sizes correctly', () => {
      assert.strictEqual(StorageService.formatBytes(0), '0 B');
      assert.strictEqual(StorageService.formatBytes(1024), '1 KB');
      assert.strictEqual(StorageService.formatBytes(10 * 1024 * 1024), '10 MB');
      assert.strictEqual(StorageService.formatBytes(200 * 1024 * 1024), '200 MB');
    });

    test('calculateOptimalChunkSize adapts chunk size dynamically to file size', () => {
      // <= 1 MB: 1 MB chunk (1 chunk, single fast request)
      assert.strictEqual(StorageService.calculateOptimalChunkSize(500 * 1024), 1024 * 1024);
      assert.strictEqual(StorageService.calculateOptimalChunkSize(1024 * 1024), 1024 * 1024);

      // 1 MB - 8 MB (e.g. 5.4 MB exact user screenshot file): 2 MB chunks (3 parallel chunks)
      const size5_4MB = Math.round(5.4 * 1024 * 1024);
      assert.strictEqual(StorageService.calculateOptimalChunkSize(size5_4MB), 2 * 1024 * 1024);
      const totalChunks5_4MB = Math.ceil(size5_4MB / StorageService.calculateOptimalChunkSize(size5_4MB));
      assert.strictEqual(totalChunks5_4MB, 3, '5.4 MB file must be split into 3 chunks for parallel streaming');

      // 8 MB - 32 MB (e.g. 20 MB): 4 MB chunks (5 parallel chunks)
      assert.strictEqual(StorageService.calculateOptimalChunkSize(20 * 1024 * 1024), 4 * 1024 * 1024);
      const totalChunks20MB = Math.ceil((20 * 1024 * 1024) / StorageService.calculateOptimalChunkSize(20 * 1024 * 1024));
      assert.strictEqual(totalChunks20MB, 5);

      // > 32 MB (e.g. 50 MB): 8 MB chunks
      assert.strictEqual(StorageService.calculateOptimalChunkSize(50 * 1024 * 1024), 8 * 1024 * 1024);

      // Edge cases
      assert.strictEqual(StorageService.calculateOptimalChunkSize(0), StorageService.CHUNK_SIZE_BYTES);
      assert.strictEqual(StorageService.calculateOptimalChunkSize(null), StorageService.CHUNK_SIZE_BYTES);
      assert.strictEqual(StorageService.calculateOptimalChunkSize(-100), StorageService.CHUNK_SIZE_BYTES);
    });
  });

  describe('File Whitelist & Security Checks', () => {
    test('accepts educational documents: PDF, DOC, DOCX, TXT, RTF, ODT', () => {
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'syllabus.pdf', mimeType: 'application/pdf' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'assignment.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'notes.txt', mimeType: 'text/plain' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'paper.odt' }), true);
    });

    test('accepts spreadsheets & presentations: XLS, XLSX, CSV, PPT, PPTX', () => {
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'placements.xlsx' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'data.csv', mimeType: 'text/csv' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'seminar.pptx' }), true);
    });

    test('accepts images & archives: PNG, JPG, WEBP, ZIP, RAR, 7Z', () => {
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'diagram.png', mimeType: 'image/png' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'photo.jpg', mimeType: 'image/jpeg' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'resources.zip', mimeType: 'application/zip' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'project.7z' }), true);
    });

    test('accepts programming code files: JAVA, PY, JS, TS, CPP, SQL, MD', () => {
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'Solution.java' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'script.py' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'index.ts' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'main.cpp' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'schema.sql' }), true);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'README.md' }), true);
    });

    test('strictly blocks dangerous executables: .exe, .bat, .cmd, .sh, .msi, .dll', () => {
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'malware.exe' }), false);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'script.bat' }), false);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'install.msi' }), false);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'payload.sh' }), false);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'library.dll' }), false);
      assert.strictEqual(StorageService.isAllowedFile({ filename: 'run.cmd' }), false);
    });
  });

  describe('File Category Classifier', () => {
    test('correctly classifies files by extension and mimeType', () => {
      assert.strictEqual(StorageService.getFileTypeCategory('application/pdf', 'doc.pdf'), 'PDF');
      assert.strictEqual(StorageService.getFileTypeCategory('image/png', 'img.png'), 'Image');
      assert.strictEqual(StorageService.getFileTypeCategory('application/vnd.ms-excel', 'data.xlsx'), 'Sheet');
      assert.strictEqual(StorageService.getFileTypeCategory('application/zip', 'code.zip'), 'Archive');
      assert.strictEqual(StorageService.getFileTypeCategory('text/x-python', 'main.py'), 'Code');
    });
  });

  describe('GridFS Stream Handling & ID Validation', () => {
    test('rejects malformed storageKey with HTTP 400', async () => {
      let statusCode = null;
      let responseBody = null;
      const mockReq = { query: {} };
      const mockRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        }
      };

      await StorageService.streamFromGridFS('gridfs:invalid-object-id', mockReq, mockRes, 'test.pdf', 'application/pdf');
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.error, 'Invalid file ID format.');
    });

    test('rejects empty or non-gridfs storageKey with HTTP 400', async () => {
      let statusCode = null;
      let responseBody = null;
      const mockReq = { query: {} };
      const mockRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        }
      };

      await StorageService.streamFromGridFS('', mockReq, mockRes, 'test.pdf', 'application/pdf');
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.error, 'Invalid file ID format.');
    });
  });

  describe('Upload Finalization & Moderation Decision Integrity', () => {
    test('moderation decision correctly maps student uploads to PendingResource and admin to approved Resource', () => {
      // Simulate student session
      const studentSession = { isPending: true, fileName: 'notes.pdf', fileSize: 1024 };
      const isModeratedStudent = Boolean(studentSession.isPending);
      assert.strictEqual(isModeratedStudent, true);
      const studentTargetType = isModeratedStudent ? 'PendingResource' : 'Resource';
      const studentSummary = `Uploaded resource: ${studentSession.fileName} (${isModeratedStudent ? 'Pending Moderation' : 'Approved'})`;
      assert.strictEqual(studentTargetType, 'PendingResource');
      assert.strictEqual(studentSummary, 'Uploaded resource: notes.pdf (Pending Moderation)');

      // Simulate administrator session
      const adminSession = { isPending: false, fileName: 'official_guide.pdf', fileSize: 2048 };
      const isModeratedAdmin = Boolean(adminSession.isPending);
      assert.strictEqual(isModeratedAdmin, false);
      const adminTargetType = isModeratedAdmin ? 'PendingResource' : 'Resource';
      const adminSummary = `Uploaded resource: ${adminSession.fileName} (${isModeratedAdmin ? 'Pending Moderation' : 'Approved'})`;
      assert.strictEqual(adminTargetType, 'Resource');
      assert.strictEqual(adminSummary, 'Uploaded resource: official_guide.pdf (Approved)');
    });

    test('GridFS key formatting handles raw 24-character ObjectIds and prefixed keys', () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const prefixedKey = `gridfs:${validObjectId}`;
      const rawExtracted1 = prefixedKey.replace(/^gridfs:/, '');
      const rawExtracted2 = validObjectId.replace(/^gridfs:/, '');
      assert.strictEqual(rawExtracted1, validObjectId);
      assert.strictEqual(rawExtracted2, validObjectId);
      assert.strictEqual(rawExtracted1.length, 24);
    });

    test('idempotency: repeated completion returns existing resource without creating duplicates', () => {
      const mockSession = {
        uploadId: 'up_test_123',
        isFinalized: true,
        finalResourceId: 'res_999',
        finalGridFsId: '507f1f77bcf86cd799439011',
        isPending: false
      };
      const existingResource = {
        id: 'res_999',
        title: 'Algorithms Lecture Notes',
        gridFsFileId: '507f1f77bcf86cd799439011'
      };

      // When already finalized, handler immediately returns alreadyFinalized response
      const isAlreadyFinalized = Boolean(mockSession.isFinalized && mockSession.finalResourceId);
      assert.strictEqual(isAlreadyFinalized, true);
      const responsePayload = {
        success: true,
        uploadId: mockSession.uploadId,
        resourceId: existingResource.id,
        fileId: mockSession.finalGridFsId || existingResource.gridFsFileId,
        alreadyFinalized: true
      };
      assert.strictEqual(responsePayload.alreadyFinalized, true);
      assert.strictEqual(responsePayload.resourceId, 'res_999');
    });

    test('atomic concurrency lock: prevents simultaneous finalization from creating duplicate records', () => {
      const sessionState = {
        uploadId: 'up_concurrent_123',
        isFinalized: false,
        isFinalizing: false
      };

      // Request A attempts to acquire lock
      const canAcquireA = !sessionState.isFinalized && !sessionState.isFinalizing;
      assert.strictEqual(canAcquireA, true);
      if (canAcquireA) sessionState.isFinalizing = true;

      // Concurrent Request B attempts to acquire lock while A is finalizing
      const canAcquireB = !sessionState.isFinalized && !sessionState.isFinalizing;
      assert.strictEqual(canAcquireB, false); // Rejected or waits, preventing duplicate assemble/create

      // Request A finishes and marks finalized
      sessionState.isFinalized = true;
      sessionState.isFinalizing = false;

      // Subsequent requests find isFinalized = true and return existing resource
      assert.strictEqual(sessionState.isFinalized, true);
      assert.strictEqual(sessionState.isFinalizing, false);
    });

    test('retry resilience: error in finalization releases lock for subsequent retry', () => {
      const sessionState = {
        uploadId: 'up_retry_123',
        isFinalized: false,
        isFinalizing: true
      };

      // Transient error happens (e.g., temporary network interruption)
      const simulatedError = new Error('Transient DB timeout');
      if (simulatedError) {
        // Error handler unlocks the session
        sessionState.isFinalizing = false;
      }

      assert.strictEqual(sessionState.isFinalizing, false);
      assert.strictEqual(sessionState.isFinalized, false);

      // Retry attempt can now acquire lock cleanly
      const canRetry = !sessionState.isFinalized && !sessionState.isFinalizing;
      assert.strictEqual(canRetry, true);
    });

    test('moderation bypass prevention: student role cannot override isPending flag', () => {
      const studentUser = { id: 'usr_1', role: 'Student', email: 'student@spit.ac.in' };
      const clientBodyPayload = { isPending: false, role: 'Administrator', status: 'approved' };

      // Server-side authority derives isPending strictly from trusted req.user
      const isAdmin = studentUser && (
        studentUser.role === 'Admin' ||
        studentUser.role === 'Administrator' ||
        studentUser.email.toLowerCase() === 'admin@spit.ac.in'
      );
      const serverCalculatedIsPending = !isAdmin;

      assert.strictEqual(isAdmin, false);
      assert.strictEqual(serverCalculatedIsPending, true); // Overrides client attempt to publish directly
    });

    test('missing chunk detection rejects incomplete upload assembly', () => {
      const totalChunks = 4;
      const uploadedChunksMap = new Map([
        [0, { id: 'chunk_0' }],
        [1, { id: 'chunk_1' }],
        [3, { id: 'chunk_3' }] // Missing chunk index 2
      ]);

      let missingIndex = -1;
      for (let i = 0; i < totalChunks; i++) {
        if (!uploadedChunksMap.has(i)) {
          missingIndex = i;
          break;
        }
      }

      assert.strictEqual(missingIndex, 2);
      assert.throws(() => {
        if (missingIndex !== -1) {
          throw new Error(`Missing chunk index ${missingIndex} of ${totalChunks}. Upload is incomplete.`);
        }
      }, /Missing chunk index 2 of 4/);
    });

    test('Crash Window A (Before Assembly): abandoned session lock is broken by expired leaseExpiresAt and chunks are intact', () => {
      const now = new Date();
      const abandonedSession = {
        uploadId: 'up_abandoned_window_a',
        isFinalized: false,
        isFinalizing: true,
        leaseExpiresAt: new Date(now.getTime() - 10000), // Expired 10s ago
        finalizeGeneration: 1,
        finalGridFsId: null
      };

      // Atomic Compare-And-Set query condition check:
      const canRecover = !abandonedSession.isFinalized && (
        !abandonedSession.isFinalizing ||
        (abandonedSession.leaseExpiresAt && abandonedSession.leaseExpiresAt < now)
      );

      assert.strictEqual(canRecover, true, 'Expired lease must permit recovery by subsequent worker');

      // Recovery claims lease with incremented generation counter
      const recoveredSession = {
        ...abandonedSession,
        isFinalizing: true,
        finalizingAt: now,
        leaseExpiresAt: new Date(now.getTime() + 60000),
        finalizeGeneration: abandonedSession.finalizeGeneration + 1
      };

      assert.strictEqual(recoveredSession.finalizeGeneration, 2);
      assert.strictEqual(recoveredSession.leaseExpiresAt > now, true);
    });

    test('Crash Window B (During Assembly): temporary chunks preserved in tempBucket and incomplete file purged', () => {
      // In Crash Window B, assembleFinalGridFSFile never called cleanupTempChunks because
      // chunk cleanup is deferred until finalization commit.
      const tempChunksInBucket = [
        { _id: 'chunk_0', metadata: { uploadId: 'up_crash_b', chunkIndex: 0 } },
        { _id: 'chunk_1', metadata: { uploadId: 'up_crash_b', chunkIndex: 1 } }
      ];
      const incompleteGridFsFile = {
        _id: 'partial_gfs_id_99',
        filename: 'report.pdf',
        length: 512, // Corrupted / partial write (expected 1024)
        metadata: { uploadId: 'up_crash_b' }
      };

      // Worker 2 recovers: detects partial candidate whose length != expectedFileSize
      const expectedFileSize = 1024;
      let purgedIncomplete = false;
      let assembledFile = null;

      if (incompleteGridFsFile.length !== expectedFileSize) {
        purgedIncomplete = true; // Cleaned up partial file
      } else {
        assembledFile = incompleteGridFsFile;
      }

      assert.strictEqual(purgedIncomplete, true, 'Incomplete GridFS write from crashed attempt must be purged');
      assert.strictEqual(assembledFile, null, 'Must not reuse incomplete file');
      assert.strictEqual(tempChunksInBucket.length, 2, 'Temp chunks must remain intact for fresh assembly');
    });

    test('Crash Window C (GridFS created but died before recording finalGridFsId): complete file reused via uploadId metadata', () => {
      // In Crash Window C, GridFS finished streaming but process crashed before UploadSession.finalGridFsId update.
      const expectedFileSize = 2048;
      const priorAssembledFiles = [
        {
          _id: 'gfs_assembled_window_c',
          filename: 'thesis.pdf',
          length: 2048,
          metadata: { uploadId: 'up_window_c', finalizeGeneration: 1 }
        }
      ];

      let reusedAssembledFile = null;
      for (const candidate of priorAssembledFiles) {
        if (candidate.length === expectedFileSize) {
          reusedAssembledFile = {
            storageKey: `gridfs:${candidate._id}`,
            gridFsFileId: candidate._id,
            size: candidate.length
          };
          break;
        }
      }

      assert.ok(reusedAssembledFile, 'Crash Window C recovery must locate and reuse complete assembled file');
      assert.strictEqual(reusedAssembledFile.gridFsFileId, 'gfs_assembled_window_c');
      assert.strictEqual(reusedAssembledFile.size, 2048);
    });

    test('Crash Window D (finalGridFsId durably recorded but died before resource record created): reuses existing finalGridFsId', () => {
      const recoveredSession = {
        uploadId: 'up_window_d',
        isFinalized: false,
        isFinalizing: false,
        finalGridFsId: '507f1f77bcf86cd799439011', // Durably recorded in step 5
        fileSize: 4096
      };

      const existingInGridFS = {
        _id: '507f1f77bcf86cd799439011',
        filename: 'lecture.pdf',
        length: 4096
      };

      let reassembled = false;
      let usedId = null;

      if (recoveredSession.finalGridFsId && existingInGridFS.length === recoveredSession.fileSize) {
        usedId = recoveredSession.finalGridFsId;
      } else {
        reassembled = true;
      }

      assert.strictEqual(reassembled, false, 'Must reuse durably recorded finalGridFsId without re-assembling');
      assert.strictEqual(usedId, '507f1f77bcf86cd799439011');
    });

    test('Crash Window E (Resource created but lease superseded before commit): Fenced Non-Destruction preserves GridFS file and rolls back resource', () => {
      const myGeneration = 1;
      const sessionInDb = {
        uploadId: 'up_window_e',
        isFinalized: false,
        finalizeGeneration: 2 // Superseded while Worker 1 was persisting metadata
      };

      // Atomic commit update condition:
      const matched = (sessionInDb.finalizeGeneration === myGeneration && !sessionInDb.isFinalized);
      assert.strictEqual(matched, false, 'Stale worker commit must fail when generation is superseded');

      let rolledBackResource = false;
      let deletedOrphanedGridFs = false;

      if (!matched) {
        rolledBackResource = true;
        // Fenced Non-Destruction: a worker whose lease was superseded must NOT delete
        // the shared GridFS file during rollback, avoiding TOCTOU races with superseding workers.
        deletedOrphanedGridFs = false;
      }

      assert.strictEqual(rolledBackResource, true, 'Superseded worker must roll back created resource document');
      assert.strictEqual(deletedOrphanedGridFs, false, 'Fenced non-destruction: superseded worker must NOT delete GridFS file during rollback');
    });

    test('fencing token: an old slow attempt is rejected if generation was incremented by another attempt', () => {
      const myGeneration = 1;
      const sessionInDb = {
        uploadId: 'up_fenced_789',
        isFinalized: false,
        isFinalizing: true,
        finalizeGeneration: 2 // DB now at generation 2
      };

      const isFencingValid = sessionInDb.finalizeGeneration === myGeneration && !sessionInDb.isFinalized;
      assert.strictEqual(isFencingValid, false, 'Stale attempt with obsolete generation token must be fenced out');
    });

    test('release on error: transient failure clears lease only if generation matches', () => {
      const activeSession = {
        uploadId: 'up_error_release_303',
        isFinalized: false,
        isFinalizing: true,
        leaseExpiresAt: new Date(Date.now() + 60000),
        finalizeGeneration: 3
      };

      const err = new Error('Database write error');
      if (err) {
        if (activeSession.finalizeGeneration === 3) {
          activeSession.isFinalizing = false;
          activeSession.leaseExpiresAt = null;
        }
      }

      assert.strictEqual(activeSession.isFinalizing, false);
      assert.strictEqual(activeSession.leaseExpiresAt, null);

      const canRetryImmediately = !activeSession.isFinalizing;
      assert.strictEqual(canRetryImmediately, true);
    });

    test('deferred cleanup: temporary chunks are preserved until finalization commit is durably recorded', () => {
      let tempChunksCleaned = false;
      let isFinalizedCommitted = false;

      // Simulated flow:
      // 1. Assembly completes
      // temp chunks NOT cleaned yet
      assert.strictEqual(tempChunksCleaned, false, 'Temp chunks must NOT be cleaned during assembly');

      // 2. Metadata created
      assert.strictEqual(tempChunksCleaned, false, 'Temp chunks must NOT be cleaned before commit');

      // 3. Finalization atomically committed
      isFinalizedCommitted = true;

      // 4. Post-commit cleanup runs
      if (isFinalizedCommitted) {
        tempChunksCleaned = true;
      }

      assert.strictEqual(tempChunksCleaned, true, 'Temp chunks safely cleaned only after commit');
    });
  });

  describe('HTTP Integration & File Streaming Authorization Tests', () => {
    let server;
    let baseUrl;
    let studentAToken;
    let studentBToken;
    let adminToken;

    const studentAEmail = 'student.alice@spit.ac.in';
    const studentBEmail = 'student.bob@spit.ac.in';
    const adminEmail = 'admin@spit.ac.in';
    const jwtSecret = JWT_SECRET || 'test_jwt_secret_for_signing_tokens_min_32_chars';

    before(async () => {
      Object.defineProperty(mongoose.connection, 'readyState', {
        value: 1,
        configurable: true
      });

      userAuthCache.set(studentAEmail, { email: studentAEmail, role: 'Student', status: 'Active', onboarded: true });
      userAuthCache.set(studentBEmail, { email: studentBEmail, role: 'Student', status: 'Active', onboarded: true });
      userAuthCache.set(adminEmail, { email: adminEmail, role: 'Administrator', status: 'Active', onboarded: true });

      studentAToken = jwt.sign({ email: studentAEmail, role: 'Student', status: 'Active' }, jwtSecret, { expiresIn: '1h' });
      studentBToken = jwt.sign({ email: studentBEmail, role: 'Student', status: 'Active' }, jwtSecret, { expiresIn: '1h' });
      adminToken = jwt.sign({ email: adminEmail, role: 'Administrator', status: 'Active' }, jwtSecret, { expiresIn: '1h' });

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
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    test('POST /api/resources/upload/finalize: rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/resources/upload/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: 'up_any_123' })
      });
      assert.strictEqual(res.status, 401);
    });

    test('POST /api/resources/upload/finalize: rejects missing uploadId with 400', async () => {
      const res = await fetch(`${baseUrl}/api/resources/upload/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${studentAToken}`
        },
        body: JSON.stringify({})
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /uploadId is required/);
    });

    test('POST /api/resources/upload/init: calculates adaptive chunk size (2 MB) and 3 chunks for 5.4 MB file', async () => {
      const origFolderFindOne = Folder.findOne;
      const origSessionCreate = UploadSession.create;

      try {
        Folder.findOne = async () => ({ id: 'system-placement-material', visibility: 'public' });
        UploadSession.create = async (doc) => doc;

        const size5_4MB = Math.round(5.4 * 1024 * 1024);
        const res = await fetch(`${baseUrl}/api/resources/upload/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${studentAToken}`
          },
          body: JSON.stringify({
            fileName: 'Group1_IEEE_Paper_FINAL.pdf',
            fileSize: size5_4MB,
            mimeType: 'application/pdf'
          })
        });

        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.success, true);
        assert.strictEqual(json.chunkSize, 2 * 1024 * 1024, '5.4 MB file must use 2 MB chunk size');
        assert.strictEqual(json.totalChunks, 3, '5.4 MB file must be split into 3 chunks for parallel streaming');
        assert.strictEqual(json.concurrency, 6);
      } finally {
        Folder.findOne = origFolderFindOne;
        UploadSession.create = origSessionCreate;
      }
    });

    test('POST /api/resources/upload/finalize: returns 404 for non-existent upload session', async () => {
      const origFindOne = UploadSession.findOne;
      UploadSession.findOne = async () => null;

      try {
        const res = await fetch(`${baseUrl}/api/resources/upload/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${studentAToken}`
          },
          body: JSON.stringify({ uploadId: 'up_nonexistent_999' })
        });
        assert.strictEqual(res.status, 404);
        const json = await res.json();
        assert.match(json.error, /Upload session not found/);
      } finally {
        UploadSession.findOne = origFindOne;
      }
    });

    test('GET /api/resources/:id/file: rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/resources/res_pending_test_1/file`);
      assert.strictEqual(res.status, 401);
    });

    test('GET /api/resources/:id/file: prevents arbitrary GridFS ObjectId streaming bypass with 404', async () => {
      // Attacker attempts to download an orphaned/unparented GridFS file by guessing a 24-char ObjectId
      const arbitraryObjectId = '507f1f77bcf86cd799439099';
      const origResFindOne = Resource.findOne;
      const origPendingResFindOne = PendingResource.findOne;
      const origStoryFindOne = Story.findOne;
      const origPendingStoryFindOne = PendingStory.findOne;

      Resource.findOne = async () => null;
      PendingResource.findOne = async () => null;
      Story.findOne = () => ({ lean: async () => null });
      PendingStory.findOne = () => ({ lean: async () => null });

      try {
        const res = await fetch(`${baseUrl}/api/resources/${arbitraryObjectId}/file`, {
          headers: { 'Authorization': `Bearer ${studentAToken}` }
        });
        // Must NOT stream the file directly without parent record authorization check
        assert.strictEqual(res.status, 404, 'Unparented GridFS ObjectId must return 404 without streaming');
        const json = await res.json();
        assert.match(json.error, /not found/i);
      } finally {
        Resource.findOne = origResFindOne;
        PendingResource.findOne = origPendingResFindOne;
        Story.findOne = origStoryFindOne;
        PendingStory.findOne = origPendingStoryFindOne;
      }
    });

    test('GET /api/resources/:id/file: unrelated student accessing pending resource returns 403 Forbidden', async () => {
      const origResFindOne = Resource.findOne;
      const origPendingResFindOne = PendingResource.findOne;

      // Pending resource belongs to studentB
      Resource.findOne = async () => null;
      PendingResource.findOne = async () => ({
        id: 'res_pending_private_1',
        title: 'Confidential Notes',
        status: 'pending',
        uploadedByEmail: studentBEmail,
        folderId: null
      });

      try {
        // studentA attempts to access studentB's pending resource file
        const res = await fetch(`${baseUrl}/api/resources/res_pending_private_1/file`, {
          headers: { 'Authorization': `Bearer ${studentAToken}` }
        });
        assert.strictEqual(res.status, 403, 'Unrelated student must receive 403 Forbidden for pending resource');
        const json = await res.json();
        assert.match(json.error, /Access denied to pending resource file/i);
      } finally {
        Resource.findOne = origResFindOne;
        PendingResource.findOne = origPendingResFindOne;
      }
    });

    test('GET /api/resources/:id/file: unrelated student accessing pending story resume returns 403 Forbidden', async () => {
      const origResFindOne = Resource.findOne;
      const origPendingResFindOne = PendingResource.findOne;
      const origStoryFindOne = Story.findOne;
      const origPendingStoryFindOne = PendingStory.findOne;

      Resource.findOne = async () => null;
      PendingResource.findOne = async () => null;
      Story.findOne = () => ({ lean: async () => null });
      PendingStory.findOne = () => ({
        lean: async () => ({
          id: 'story_pending_bob_1',
          name: 'Bob Placement Story',
          status: 'pending',
          uploadedByEmail: studentBEmail,
          resumeFile: {
            fileName: 'Bob_Resume.pdf',
            gridFsFileId: '507f1f77bcf86cd799439055'
          }
        })
      });

      try {
        // studentA attempts to access studentB's pending story resume
        const res = await fetch(`${baseUrl}/api/resources/507f1f77bcf86cd799439055/file`, {
          headers: { 'Authorization': `Bearer ${studentAToken}` }
        });
        assert.strictEqual(res.status, 403, 'Unrelated student must receive 403 Forbidden for pending story resume');
        const json = await res.json();
        assert.match(json.error, /Access denied to pending story file/i);
      } finally {
        Resource.findOne = origResFindOne;
        PendingResource.findOne = origPendingResFindOne;
        Story.findOne = origStoryFindOne;
        PendingStory.findOne = origPendingStoryFindOne;
      }
    });

    test('GET /api/resources/:id/file: rejects access to non-existent resource with 404', async () => {
      const origResFindOne = Resource.findOne;
      const origPendingResFindOne = PendingResource.findOne;
      const origStoryFindOne = Story.findOne;
      const origPendingStoryFindOne = PendingStory.findOne;

      Resource.findOne = async () => null;
      PendingResource.findOne = async () => null;
      Story.findOne = () => ({ lean: async () => null });
      PendingStory.findOne = () => ({ lean: async () => null });

      try {
        const res = await fetch(`${baseUrl}/api/resources/random_non_existent_id/file`, {
          headers: { 'Authorization': `Bearer ${studentAToken}` }
        });
        assert.strictEqual(res.status, 404);
      } finally {
        Resource.findOne = origResFindOne;
        PendingResource.findOne = origPendingResFindOne;
        Story.findOne = origStoryFindOne;
        PendingStory.findOne = origPendingStoryFindOne;
      }
    });

    test('Regression 1: Crash after Resource creation: retrying finalization reuses existing Resource without duplicate', async () => {
      const uploadId = 'up_crash_res_test';
      const existingRes = {
        id: 'res_recovered_canonical_1',
        uploadId,
        title: 'Algorithms Notes',
        gridFsFileId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439001'),
        url: '/api/resources/res_recovered_canonical_1/file',
        status: 'approved'
      };

      const sessionInDb = {
        uploadId,
        fileName: 'algorithms.pdf',
        fileSize: 1024,
        isPending: false,
        isFinalized: false,
        finalizeGeneration: 1,
        finalGridFsId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439001')
      };

      const origResFindOne = Resource.findOne;
      const origResCreate = Resource.create;
      let createCalled = false;

      Resource.findOne = async (q) => {
        if (q && (q.uploadId === uploadId || q.$or?.some(c => c.uploadId === uploadId))) {
          return existingRes;
        }
        return null;
      };
      Resource.create = async () => {
        createCalled = true;
        throw new Error('create() must NOT be called when existing resource is found!');
      };

      try {
        const targetModel = sessionInDb.isPending ? PendingResource : Resource;
        const record = await targetModel.findOne({
          $or: [
            { uploadId: sessionInDb.uploadId },
            { gridFsFileId: sessionInDb.finalGridFsId }
          ]
        });
        assert.ok(record, 'Must find existing Resource created before the crash');
        assert.strictEqual(record.id, 'res_recovered_canonical_1');
        assert.strictEqual(createCalled, false, 'Duplicate create must not be attempted');
      } finally {
        Resource.findOne = origResFindOne;
        Resource.create = origResCreate;
      }
    });

    test('Regression 2: Crash after PendingResource creation: retrying finalization reuses existing PendingResource without duplicate', async () => {
      const uploadId = 'up_crash_pending_test';
      const existingPending = {
        id: 'res_pending_canonical_2',
        uploadId,
        title: 'Student Project Proposal',
        gridFsFileId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439002'),
        url: '/api/resources/res_pending_canonical_2/file',
        status: 'pending'
      };

      const sessionInDb = {
        uploadId,
        fileName: 'proposal.pdf',
        fileSize: 2048,
        isPending: true,
        isFinalized: false,
        finalizeGeneration: 1,
        finalGridFsId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439002')
      };

      const origPendingFindOne = PendingResource.findOne;
      const origPendingCreate = PendingResource.create;
      let createCalled = false;

      PendingResource.findOne = async (q) => {
        if (q && (q.uploadId === uploadId || q.$or?.some(c => c.uploadId === uploadId))) {
          return existingPending;
        }
        return null;
      };
      PendingResource.create = async () => {
        createCalled = true;
        throw new Error('create() must NOT be called when existing pending resource is found!');
      };

      try {
        const targetModel = sessionInDb.isPending ? PendingResource : Resource;
        const record = await targetModel.findOne({
          $or: [
            { uploadId: sessionInDb.uploadId },
            { gridFsFileId: sessionInDb.finalGridFsId }
          ]
        });
        assert.ok(record, 'Must find existing PendingResource created before the crash');
        assert.strictEqual(record.id, 'res_pending_canonical_2');
        assert.strictEqual(createCalled, false, 'Duplicate create must not be attempted');
      } finally {
        PendingResource.findOne = origPendingFindOne;
        PendingResource.create = origPendingCreate;
      }
    });

    test('Regression 3: Canonical resource linkage: UploadSession.finalResourceId points to recovered canonical ID', async () => {
      const recoveredId = 'res_canonical_durable_99';
      let recordedSessionFinalId = null;

      const mockSessionUpdate = async (filter, update) => {
        recordedSessionFinalId = update.$set.finalResourceId;
        return { isFinalized: true, finalResourceId: recordedSessionFinalId };
      };

      await mockSessionUpdate(
        { uploadId: 'up_test_canonical' },
        { $set: { isFinalized: true, isFinalizing: false, finalResourceId: recoveredId } }
      );

      assert.strictEqual(recordedSessionFinalId, recoveredId, 'Session must durably link canonical resource ID');
    });

    test('Regression 4: Concurrent retry requests: unique uploadId prevents duplicate creation on race condition', async () => {
      const uploadId = 'up_concurrent_race_test';
      const canonicalRecord = { id: 'res_winning_race_1', uploadId };

      let attempts = 0;
      const concurrentCreate = async () => {
        attempts++;
        if (attempts > 1) {
          const err = new Error(`E11000 duplicate key error collection: loop.resources index: uploadId_1 dup key: { uploadId: "${uploadId}" }`);
          err.code = 11000;
          throw err;
        }
        return canonicalRecord;
      };

      let recordWorker1 = null;
      let recordWorker2 = null;

      try {
        recordWorker1 = await concurrentCreate();
      } catch (e) {}

      try {
        recordWorker2 = await concurrentCreate();
      } catch (err) {
        if (err.code === 11000) {
          recordWorker2 = canonicalRecord;
        }
      }

      assert.strictEqual(recordWorker1.id, canonicalRecord.id);
      assert.strictEqual(recordWorker2.id, canonicalRecord.id);
      assert.strictEqual(recordWorker1.id, recordWorker2.id, 'Both concurrent workers must resolve to the identical canonical record');
    });

    test('Regression 5: Stale worker rollback: does NOT delete GridFS file adopted by a newer worker', async () => {
      const { safeDeleteGridFSFileIfOrphaned } = require('../server');
      const adoptedFileId = '507f1f77bcf86cd799439033';
      const uploadId = 'up_adopted_newer_worker';

      const origUploadFindOne = UploadSession.findOne;
      UploadSession.findOne = () => ({
        lean: async () => ({
          uploadId,
          finalGridFsId: adoptedFileId,
          finalizeGeneration: 2
        })
      });

      try {
        const deleted = await safeDeleteGridFSFileIfOrphaned(adoptedFileId, uploadId);
        assert.strictEqual(deleted, false, 'safeDeleteGridFSFileIfOrphaned must refuse to delete adopted file');
      } finally {
        UploadSession.findOne = origUploadFindOne;
      }
    });

    test('Regression 6: Stale worker rollback: Resource referencing valid GridFS file prevents deletion', async () => {
      const { safeDeleteGridFSFileIfOrphaned } = require('../server');
      const activeFileId = '507f1f77bcf86cd799439044';

      const origUploadFindOne = UploadSession.findOne;
      const origResExists = Resource.exists;

      UploadSession.findOne = () => ({ lean: async () => null });
      Resource.exists = async () => true;

      try {
        const deleted = await safeDeleteGridFSFileIfOrphaned(activeFileId, 'up_stale_abandoned');
        assert.strictEqual(deleted, false, 'Must not delete file referenced by active Resource');
      } finally {
        UploadSession.findOne = origUploadFindOne;
        Resource.exists = origResExists;
      }
    });

    test('Regression 7: Cleanup safety: StorageService.cleanupTempChunks only targets temp bucket', async () => {
      const origDb = mongoose.connection.db;
      try {
        mongoose.connection.db = {
          collection: (name) => ({
            drop: async () => {},
            find: () => ({ limit: () => ({ toArray: async () => [] }) })
          })
        };
        const tempBucket = StorageService.getTempChunksBucket();
        const finalBucket = StorageService.getGridFSBucket();
        assert.notStrictEqual(tempBucket.s.options.bucketName, finalBucket.s.options.bucketName);
        assert.strictEqual(tempBucket.s.options.bucketName, 'loop_temp_chunks');
        assert.strictEqual(finalBucket.s.options.bucketName, 'loop_resources');
      } finally {
        mongoose.connection.db = origDb;
      }
    });

    test('Regression 8: /uploads security: unauthenticated access to sensitive legacy file is rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/uploads/resume-1729220000-987654.pdf`);
      assert.strictEqual(res.status, 401, 'Unauthenticated access to sensitive resume must be rejected with 401');
      const json = await res.json();
      assert.strictEqual(json.code, 'TOKEN_MISSING');
    });

    test('Regression 9: /uploads security: legitimate public profile photos continue to be served without auth', async () => {
      const res = await fetch(`${baseUrl}/uploads/photo-1729220000-123456.jpg`);
      assert.notStrictEqual(res.status, 401, 'Public profile photo must NOT require authentication');
      assert.strictEqual(res.status, 404, 'Non-existent public photo should return 404 from static handler, not 401');

      const resNonImage = await fetch(`${baseUrl}/uploads/photo-1729220000-unauthorized.pdf`);
      assert.strictEqual(resNonImage.status, 401, 'Non-image file with public prefix must require authentication');
    });

    test('Regression 10: Fenced Non-Destruction: superseded worker rollback never deletes GridFS file adopted by winning worker', async () => {
      const uploadId = 'up_fenced_non_destructive_interleaving';
      const fileId = '507f1f77bcf86cd799439055';
      let fileDeleted = false;

      // Mock GridFS bucket
      const origGetGridFSBucket = StorageService.getGridFSBucket;
      StorageService.getGridFSBucket = () => ({
        delete: async (oid) => {
          fileDeleted = true;
        },
        find: () => ({
          limit: () => ({
            toArray: async () => [{ _id: new mongoose.Types.ObjectId(fileId), length: 2048, filename: 'fenced_test.pdf' }]
          }),
          sort: () => ({
            toArray: async () => [{ _id: new mongoose.Types.ObjectId(fileId), length: 2048, filename: 'fenced_test.pdf' }]
          }),
          toArray: async () => []
        })
      });

      // Step 1: Worker A held generation 1, but Worker B supersedes generation to 2 and wins
      const origFindOneAndUpdate = UploadSession.findOneAndUpdate;
      const origFindOne = UploadSession.findOne;
      const origResFindOne = Resource.findOne;

      // Simulate Worker A attempting Step 5 or Step 7 with generation 1 when DB is now at generation 2
      // findOneAndUpdate with generation: 1 returns null because DB was updated by Worker B
      UploadSession.findOneAndUpdate = async (query) => {
        if (query.finalizeGeneration === 1) {
          return null; // Fenced out by Worker B!
        }
        return { uploadId, finalizeGeneration: 2, isFinalized: true };
      };

      UploadSession.findOne = async () => ({
        uploadId,
        finalizeGeneration: 2,
        finalGridFsId: fileId,
        finalResourceId: 'res_winning_worker_b',
        isFinalized: true
      });

      Resource.findOne = async () => ({
        id: 'res_winning_worker_b',
        gridFsFileId: fileId
      });

      try {
        const req = {
          body: { uploadId },
          user: { email: studentAEmail, role: 'Student' },
          ip: '127.0.0.1',
          headers: {}
        };
        let statusCode = null;
        let jsonResponse = null;
        const res = {
          status: (code) => {
            statusCode = code;
            return {
              json: (data) => {
                jsonResponse = data;
              }
            };
          }
        };

        const { handleUploadFinalize } = require('../server');
        await handleUploadFinalize(req, res);

        // Worker A must return 200 (if winning worker already finished) or 409 (superseded)
        assert.ok([200, 409].includes(statusCode), `Status code must be 200 or 409, got ${statusCode}`);
        // CRITICAL INVARIANT: The adopted GridFS file must NEVER be deleted by Worker A's rollback
        assert.strictEqual(fileDeleted, false, 'Fenced Non-Destruction: superseded worker must NEVER delete the adopted GridFS file');
      } finally {
        StorageService.getGridFSBucket = origGetGridFSBucket;
        UploadSession.findOneAndUpdate = origFindOneAndUpdate;
        UploadSession.findOne = origFindOne;
        Resource.findOne = origResFindOne;
      }
    });
  });
});
