const { test, describe } = require('node:test');
const assert = require('node:assert');
const StorageService = require('../services/storageService');

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
});
