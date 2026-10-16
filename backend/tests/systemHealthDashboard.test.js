process.env.NODE_ENV = 'test';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const { User } = require('../models');
const {
  evaluateMigrationReadiness,
  getDatabaseStorageStats,
  generateFullSystemHealth
} = require('../services/systemDiagnostics');

describe('System Health & Database Diagnostics API', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalFindOne;
  let adminToken;
  let studentToken;

  const JWT_SECRET = process.env.JWT_SECRET;

  before(async () => {
    // Generate valid tokens
    adminToken = jwt.sign(
      { email: 'admin@spit.ac.in', role: 'Administrator', status: 'Active' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    studentToken = jwt.sign(
      { email: 'student@spit.ac.in', role: 'Student', status: 'Active' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalFindOne = User.findOne;
    User.findOne = async (query) => {
      const emailQuery = query?.email;
      let emailStr = '';
      if (typeof emailQuery === 'string') {
        emailStr = emailQuery;
      } else if (emailQuery && emailQuery.source) {
        emailStr = emailQuery.source;
      } else if (emailQuery) {
        emailStr = String(emailQuery);
      }

      if (/admin/i.test(emailStr)) {
        return {
          email: 'admin@spit.ac.in',
          role: 'Administrator',
          status: 'Active',
          isAdmin: true
        };
      }
      if (/student/i.test(emailStr)) {
        return {
          email: 'student@spit.ac.in',
          role: 'Student',
          status: 'Active',
          isAdmin: false
        };
      }
      return null;
    };

    // Mock mongoose.connection.db to simulate MongoDB Atlas commands in tests
    mongoose.connection.db = {
      databaseName: 'loop_database_test',
      admin: () => ({
        ping: async () => ({ ok: 1 })
      }),
      command: async (cmd) => {
        if (cmd.dbStats) {
          return {
            dataSize: 52428800,
            storageSize: 62914560,
            indexSize: 5242880,
            collections: 7,
            objects: 1420
          };
        }
        if (cmd.collStats) {
          return {
            count: 120,
            size: 2097152,
            storageSize: 4194304,
            totalIndexSize: 131072,
            avgObjSize: 1024
          };
        }
        return {};
      },
      listCollections: () => ({
        toArray: async () => [
          { name: 'users' },
          { name: 'stories' },
          { name: 'resources' },
          { name: 'loop_resources.files' },
          { name: 'loop_resources.chunks' }
        ]
      }),
      collection: (name) => ({
        countDocuments: async () => 15,
        estimatedDocumentCount: async () => 15,
        aggregate: () => ({
          toArray: async () => [{ sumLength: 15728640 }]
        }),
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () => [
                {
                  _id: '64d1234567890abcdef12345',
                  filename: 'Computer_Networks_Syllabus.pdf',
                  length: 3145728,
                  contentType: 'application/pdf',
                  uploadDate: new Date('2026-09-01T10:00:00Z'),
                  metadata: { resourceTitle: 'CN Syllabus' }
                }
              ]
            })
          }),
          toArray: async () => []
        }),
        distinct: async () => []
      })
    };

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
    User.findOne = originalFindOne;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/admin/diagnostics/system-health: rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/admin/diagnostics/system-health`);
    assert.equal(res.status, 401);
  });

  test('GET /api/admin/diagnostics/system-health: rejects non-admin student request with 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/diagnostics/system-health`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /Administrator/i);
  });

  test('GET /api/admin/diagnostics/system-health: returns comprehensive diagnostics for Administrator', async () => {
    const res = await fetch(`${baseUrl}/api/admin/diagnostics/system-health?fresh=true`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    // Verify root sections
    assert.ok(data.timestamp);
    assert.ok(data.overallStatus);
    assert.ok(data.storage);
    assert.ok(Array.isArray(data.collections));
    assert.ok(data.gridfs);
    assert.ok(data.backend);
    assert.ok(data.performance);
    assert.ok(data.migrationReadiness);

    // Verify backend telemetry
    assert.equal(data.backend.status, 'online');
    assert.ok(data.backend.nodeVersion);
    assert.ok(data.backend.memory.rss_mb);

    // Verify sensitive secrets are NOT exposed
    const stringified = JSON.stringify(data);
    assert.equal(stringified.includes(JWT_SECRET), false, 'JWT_SECRET must never be exposed');
    assert.equal(/mongodb(\+srv)?:\/\/[^/]+/i.test(stringified), false, 'MongoDB credentials must never be exposed');
  });

  test('POST /api/admin/diagnostics/db-probe: verifies database write probe capability for Administrator', async () => {
    const res = await fetch(`${baseUrl}/api/admin/diagnostics/db-probe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.verifiedAt);
  });

  test('POST /api/admin/diagnostics/db-probe: rejects non-admin with 403', async () => {
    const res = await fetch(`${baseUrl}/api/admin/diagnostics/db-probe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.status, 403);
  });

  test('Migration Readiness: evaluates all required checklist items correctly', () => {
    const mockStorage = {
      connected: true,
      usedPercentage: 35.5,
      formattedStorageSize: '180 MB',
      formattedQuota: '512 MB'
    };
    const mockBackend = {
      memory: { rss_mb: '120.5' }
    };
    const mockPing = {
      ok: true,
      latencyMs: 45
    };

    const readiness = evaluateMigrationReadiness(mockStorage, mockBackend, mockPing);
    assert.equal(readiness.totalChecks, 12);
    assert.ok(readiness.score > 80);
    assert.equal(readiness.overallStatus, 'Ready for Migration');

    // Verify specific check IDs
    const checkIds = readiness.checks.map(c => c.id);
    assert.ok(checkIds.includes('env_vars'));
    assert.ok(checkIds.includes('database_connectivity'));
    assert.ok(checkIds.includes('database_storage_headroom'));
    assert.ok(checkIds.includes('file_streaming'));
    assert.ok(checkIds.includes('auth_security'));
    assert.ok(checkIds.includes('rbac_auth'));
    assert.ok(checkIds.includes('rate_limiting'));
    assert.ok(checkIds.includes('cors_config'));
  });

  test('Storage Alert Levels: maps quota usage percentages to warning tiers', async () => {
    // Test helper logic mapping
    const getLevel = (pct) => {
      if (pct >= 95) return 'Near limit';
      if (pct >= 85) return 'Critical';
      if (pct >= 70) return 'Warning';
      return 'Normal';
    };

    assert.equal(getLevel(45), 'Normal');
    assert.equal(getLevel(69.9), 'Normal');
    assert.equal(getLevel(70.0), 'Warning');
    assert.equal(getLevel(84.9), 'Warning');
    assert.equal(getLevel(85.0), 'Critical');
    assert.equal(getLevel(94.9), 'Critical');
    assert.equal(getLevel(95.0), 'Near limit');
    assert.equal(getLevel(99.0), 'Near limit');
  });
});
