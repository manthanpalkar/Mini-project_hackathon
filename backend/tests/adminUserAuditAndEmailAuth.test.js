const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { app, normalizeLoginIdentifier, userAuthCache } = require('../server');
const { User, ActivityLog } = require('../models');
const activityService = require('../services/activityService');

describe('Administrator User Intelligence, Audit Trail & Email Authentication Tests', () => {
  let server;
  let baseUrl;
  let adminToken;
  let studentToken;

  const adminEmail = 'admin@spit.ac.in';
  const testStudentEmail = 'audit.test.student@gmail.com';
  const testCampusUsername = 'campus.tester';
  const jwtSecret = process.env.JWT_SECRET || 'test_jwt_secret_for_signing_tokens_min_32_chars';
  let originalReadyState;

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    userAuthCache.set(adminEmail, { email: adminEmail, role: 'Administrator', status: 'Active' });
    userAuthCache.set(testStudentEmail, { email: testStudentEmail, role: 'Student', status: 'Active', onboarded: true });

    // Generate auth tokens
    adminToken = jwt.sign(
      { email: adminEmail, role: 'Administrator', status: 'Active' },
      jwtSecret,
      { expiresIn: '2h' }
    );

    studentToken = jwt.sign(
      { email: testStudentEmail, role: 'Student', status: 'Active' },
      jwtSecret,
      { expiresIn: '2h' }
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
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true
    });
  });

  describe('1. normalizeLoginIdentifier - Email Domain & Username Fallback Verification', () => {
    test('accepts standard @gmail.com email addresses', () => {
      const res = normalizeLoginIdentifier('student.developer@gmail.com');
      assert.equal(res.valid, true);
      assert.equal(res.email, 'student.developer@gmail.com');
      assert.equal(res.username, 'student.developer');
    });

    test('accepts institutional @spit.ac.in email addresses', () => {
      const res = normalizeLoginIdentifier('admin.spit@spit.ac.in');
      assert.equal(res.valid, true);
      assert.equal(res.email, 'admin.spit@spit.ac.in');
      assert.equal(res.username, 'admin.spit');
    });

    test('accepts enterprise / other valid domains (e.g. @outlook.com, @yahoo.com)', () => {
      const res = normalizeLoginIdentifier('alumni.mentor@outlook.com');
      assert.equal(res.valid, true);
      assert.equal(res.email, 'alumni.mentor@outlook.com');
      assert.equal(res.username, 'alumni.mentor');
    });

    test('resolves campus username without @ into official SPIT email address', () => {
      const res = normalizeLoginIdentifier(testCampusUsername);
      assert.equal(res.valid, true);
      assert.equal(res.email, `${testCampusUsername}@spit.ac.in`);
      assert.equal(res.username, testCampusUsername);
    });

    test('rejects malformed email structures (missing domain dot, illegal characters, multiple @)', () => {
      assert.equal(normalizeLoginIdentifier('user@domain').valid, false);
      assert.equal(normalizeLoginIdentifier('user@@domain.com').valid, false);
      assert.equal(normalizeLoginIdentifier('user space@domain.com').valid, false);
      assert.equal(normalizeLoginIdentifier('user<script>@domain.com').valid, false);
    });
  });

  describe('2. activityService - Audit Logging, User Queries & Sanitization', () => {
    test('sanitizeMetadata strips sensitive passwords, tokens, and secret keys', () => {
      const sensitiveObj = {
        email: 'test@gmail.com',
        password: 'SuperSecretPassword123!',
        newPassword: 'AnotherSecretPassword',
        resetToken: 'a1b2c3d4e5f6',
        nested: {
          token: 'jwt.token.here',
          apiKey: 'key_12345',
          safeField: 'This is safe content'
        }
      };

      const sanitized = activityService.sanitizeMetadata(sensitiveObj);
      assert.equal(sanitized.email, 'test@gmail.com');
      assert.equal(sanitized.password, '[REDACTED]');
      assert.equal(sanitized.newPassword, '[REDACTED]');
      assert.equal(sanitized.resetToken, '[REDACTED]');
      assert.equal(sanitized.nested.token, '[REDACTED]');
      assert.equal(sanitized.nested.apiKey, '[REDACTED]');
      assert.equal(sanitized.nested.safeField, 'This is safe content');
    });

    test('logActivity creates structured audit event with targetUserEmail support', async () => {
      const log = await activityService.logActivity({
        eventType: 'USER_CREATE',
        category: 'ADMIN',
        actorEmail: adminEmail,
        actorRole: 'Administrator',
        targetType: 'User',
        targetId: 'USR-101',
        targetUserEmail: testStudentEmail,
        summary: `Admin created platform user ${testStudentEmail}`,
        outcome: 'SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Node-Test-Agent',
        metadata: { role: 'Student' }
      });

      assert.ok(log);
      assert.ok(log.eventId.startsWith('EVT-'));
      assert.equal(log.actorEmail, adminEmail);
      assert.equal(log.targetUserEmail, testStudentEmail);
      assert.equal(log.category, 'ADMIN');
      assert.equal(log.eventType, 'USER_CREATE');
    });

    test('getUserActivity queries events BY user and ON user with actionDirection tag', async () => {
      // Stub ActivityLog find and countDocuments
      const origFind = ActivityLog.find;
      const origCount = ActivityLog.countDocuments;

      const mockLogs = [
        {
          eventId: 'EVT-1',
          eventType: 'AUTH_LOGIN_SUCCESS',
          category: 'AUTH',
          actorEmail: testStudentEmail,
          targetUserEmail: '',
          summary: 'User logged in successfully',
          outcome: 'SUCCESS',
          createdAt: new Date()
        },
        {
          eventId: 'EVT-2',
          eventType: 'ADMIN_ACTION',
          category: 'ADMIN',
          actorEmail: adminEmail,
          targetUserEmail: testStudentEmail,
          summary: `Admin updated role for ${testStudentEmail}`,
          outcome: 'SUCCESS',
          createdAt: new Date()
        }
      ];

      ActivityLog.countDocuments = async () => mockLogs.length;
      ActivityLog.find = () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => mockLogs
            })
          })
        })
      });

      try {
        const result = await activityService.getUserActivity({
          userEmail: testStudentEmail,
          page: 1,
          limit: 10
        });

        assert.equal(result.events.length, 2);
        assert.equal(result.pagination.total, 2);
        // Event 1 is self action
        assert.equal(result.events[0].actionDirection, 'BY_USER');
        // Event 2 is action ON user by admin
        assert.equal(result.events[1].actionDirection, 'ON_USER_BY_ADMIN');
      } finally {
        ActivityLog.find = origFind;
        ActivityLog.countDocuments = origCount;
      }
    });

    test('getUserActivitySummary computes honest metric counts without fabrication', async () => {
      const origCount = ActivityLog.countDocuments;
      const origFindOne = ActivityLog.findOne;

      // Mock countDocuments responses
      ActivityLog.countDocuments = async (query) => {
        if (query.eventType === 'AUTH_LOGIN_SUCCESS') return 5;
        if (query.eventType === 'AUTH_LOGIN_FAIL') return 1;
        if (query.eventType === 'CONTENT_RESOURCE_DELETE') return 2;
        if (query.targetUserEmail === testStudentEmail && query.actorEmail) return 3; // admin interventions
        return 12; // total
      };

      ActivityLog.findOne = () => ({
        sort: () => ({
          select: () => ({
            lean: async () => ({
              createdAt: new Date('2026-10-18T00:00:00Z'),
              summary: 'User logged in'
            })
          })
        })
      });

      try {
        const summary = await activityService.getUserActivitySummary({
          userEmail: testStudentEmail
        });

        assert.equal(summary.totalEvents, 12);
        assert.equal(summary.successfulLogins, 5);
        assert.equal(summary.failedLogins, 1);
        assert.equal(summary.resourceDeletions, 2);
        assert.equal(summary.adminInterventions, 3);
        assert.equal(summary.hasActivityLogs, true);
        assert.ok(summary.recentActivityAt);
      } finally {
        ActivityLog.countDocuments = origCount;
        ActivityLog.findOne = origFindOne;
      }
    });
  });

  describe('3. Admin User Management & Default spit123 Password Integration', () => {
    test('POST /api/users with default password spit123 creates user and hashes password', async () => {
      let createdData = null;
      const origCreate = User.create;
      const origFindOne = User.findOne;

      User.findOne = async () => null; // No duplicate
      User.create = async (data) => {
        createdData = data;
        return {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({ ...data })
        };
      };

      try {
        const res = await fetch(`${baseUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: 'newuser@gmail.com',
            role: 'Student',
            name: 'New Student'
          })
        });

        assert.equal(res.status, 201);
        const data = await res.json();
        assert.equal(data.email, 'newuser@gmail.com');
        assert.ok(createdData.password, 'Must have hashed password');
        const matchesSpit123 = await bcrypt.compare('spit123', createdData.password);
        assert.equal(matchesSpit123, true, 'Default password must match spit123');
      } finally {
        User.create = origCreate;
        User.findOne = origFindOne;
      }
    });

    test('POST /api/users allows custom password override during creation', async () => {
      let createdData = null;
      const origCreate = User.create;
      const origFindOne = User.findOne;

      User.findOne = async () => null;
      User.create = async (data) => {
        createdData = data;
        return {
          ...data,
          _id: new mongoose.Types.ObjectId(),
          toObject: () => ({ ...data })
        };
      };

      try {
        const res = await fetch(`${baseUrl}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: 'custompass@gmail.com',
            role: 'Student',
            password: 'MyCustomSecurePassword99!'
          })
        });

        assert.equal(res.status, 201);
        assert.ok(createdData.password);
        const matchesCustom = await bcrypt.compare('MyCustomSecurePassword99!', createdData.password);
        assert.equal(matchesCustom, true);
      } finally {
        User.create = origCreate;
        User.findOne = origFindOne;
      }
    });

    test('DELETE /api/users/:email deletes user and prevents deleting root admin@spit.ac.in', async () => {
      // Root admin delete attempt must be blocked
      const rootRes = await fetch(`${baseUrl}/api/users/admin@spit.ac.in`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      assert.equal(rootRes.status, 400);

      // Deleting ordinary user is permitted
      const origDeleteOne = User.deleteOne;
      let deletedQuery = null;
      User.deleteOne = async (q) => {
        deletedQuery = q;
        return { deletedCount: 1 };
      };

      try {
        const res = await fetch(`${baseUrl}/api/users/obsolete.user@gmail.com`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert.equal(res.status, 200);
        assert.ok(deletedQuery);
      } finally {
        User.deleteOne = origDeleteOne;
      }
    });
  });

  describe('4. Dedicated Admin User Activity & Summary Endpoints', () => {
    test('GET /api/admin/users/:userId/activity rejects unauthenticated request with 401', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/test@gmail.com/activity`);
      assert.equal(res.status, 401);
    });

    test('GET /api/admin/users/:userId/activity rejects non-admin student with 403', async () => {
      const res = await fetch(`${baseUrl}/api/admin/users/test@gmail.com/activity`, {
        headers: { 'Authorization': `Bearer ${studentToken}` }
      });
      assert.equal(res.status, 403);
    });

    test('GET /api/admin/users/:userId/activity returns paginated activity for Administrator', async () => {
      const origFindOne = User.findOne;
      const origGetUserActivity = activityService.getUserActivity;

      User.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        email: testStudentEmail,
        role: 'Student',
        status: 'Active',
        createdAt: new Date(),
        toObject: () => ({ email: testStudentEmail, role: 'Student' })
      });

      activityService.getUserActivity = async () => ({
        events: [
          {
            eventId: 'EVT-TEST',
            eventType: 'AUTH_LOGIN_SUCCESS',
            category: 'AUTH',
            actorEmail: testStudentEmail,
            summary: 'Login success',
            outcome: 'SUCCESS',
            actionDirection: 'BY_USER',
            createdAt: new Date()
          }
        ],
        pagination: { total: 1, page: 1, limit: 10, pages: 1 }
      });

      try {
        const res = await fetch(`${baseUrl}/api/admin/users/${encodeURIComponent(testStudentEmail)}/activity?page=1&limit=10`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.user);
        assert.equal(data.user.email, testStudentEmail);
        assert.ok(Array.isArray(data.events));
        assert.equal(data.events.length, 1);
        assert.ok(data.pagination);
      } finally {
        User.findOne = origFindOne;
        activityService.getUserActivity = origGetUserActivity;
      }
    });

    test('GET /api/admin/users/:userId/activity/summary returns activity metrics for Administrator', async () => {
      const origFindOne = User.findOne;
      const origSummary = activityService.getUserActivitySummary;

      User.findOne = async () => ({
        _id: new mongoose.Types.ObjectId(),
        email: testStudentEmail,
        role: 'Student',
        status: 'Active',
        createdAt: new Date(),
        toObject: () => ({ email: testStudentEmail, role: 'Student' })
      });

      activityService.getUserActivitySummary = async () => ({
        totalEvents: 10,
        successfulLogins: 4,
        failedLogins: 1,
        resourceUploads: 2,
        resourceDeletions: 0,
        profileUpdates: 1,
        storySubmissions: 1,
        passwordEvents: 1,
        adminInterventions: 0,
        recentActivityAt: new Date().toISOString(),
        hasActivityLogs: true,
        isHistoricalDataAvailable: true
      });

      try {
        const res = await fetch(`${baseUrl}/api/admin/users/${encodeURIComponent(testStudentEmail)}/activity/summary`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.user);
        assert.equal(data.user.email, testStudentEmail);
        assert.ok(data.summary);
        assert.equal(typeof data.summary.totalEvents, 'number');
        assert.equal(typeof data.summary.successfulLogins, 'number');
        assert.equal(typeof data.summary.failedLogins, 'number');
      } finally {
        User.findOne = origFindOne;
        activityService.getUserActivitySummary = origSummary;
      }
    });
  });
});
