process.env.NODE_ENV = 'test';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../server');
const { User } = require('../models');
const { RESTRICTED_MESSAGE, isSpitDomain, verifyGoogleToken } = require('../services/googleAuth');

// Helper to generate test mock tokens
function createMockGoogleToken(payload) {
  const jsonStr = JSON.stringify(payload);
  const base64Str = Buffer.from(jsonStr, 'utf8').toString('base64');
  return `mock-google-token-${base64Str}`;
}

describe('Google OAuth & Domain Restriction', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalFindOne;
  let testReqCount = 0;

  function getHeaders() {
    testReqCount++;
    return {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `192.168.20.${testReqCount}`
    };
  }

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    // Set readyState to 1 to simulate healthy db connection in tests
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalFindOne = User.findOne;

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

  test('Domain Validator: strictly verifies @spit.ac.in emails', () => {
    assert.equal(isSpitDomain('student@spit.ac.in'), true);
    assert.equal(isSpitDomain('test.student@spit.ac.in'), true);
    assert.equal(isSpitDomain('fake@spit.ac.in.attacker.com'), false);
    assert.equal(isSpitDomain('student@gmail.com'), false);
    assert.equal(isSpitDomain('student@spit.edu'), false);
    assert.equal(isSpitDomain(''), false);
    assert.equal(isSpitDomain(null), false);
  });

  test('Google Token Verifier: verifies valid @spit.ac.in token', async () => {
    const validToken = createMockGoogleToken({
      sub: 'google-sub-spit-101',
      email: 'student.2026@spit.ac.in',
      email_verified: true,
      name: 'Aditya Patil'
    });

    const payload = await verifyGoogleToken(validToken);
    assert.equal(payload.sub, 'google-sub-spit-101');
    assert.equal(payload.email, 'student.2026@spit.ac.in');
    assert.equal(payload.name, 'Aditya Patil');
    assert.equal(payload.emailVerified, true);
  });

  test('Google Token Verifier: rejects non-@spit.ac.in email with exact required message', async () => {
    const externalToken = createMockGoogleToken({
      sub: 'google-sub-ext-102',
      email: 'outsider@gmail.com',
      email_verified: true,
      name: 'External Person'
    });

    await assert.rejects(
      async () => verifyGoogleToken(externalToken),
      (err) => {
        assert.equal(err.status, 403);
        assert.equal(err.message, RESTRICTED_MESSAGE);
        assert.equal(err.message, 'Access restricted to SPIT students. Please use your @spit.ac.in Google account.');
        return true;
      }
    );
  });

  test('Google Token Verifier: rejects unverified email addresses', async () => {
    const unverifiedToken = createMockGoogleToken({
      sub: 'google-sub-unver-103',
      email: 'unverified@spit.ac.in',
      email_verified: false,
      name: 'Unverified'
    });

    await assert.rejects(
      async () => verifyGoogleToken(unverifiedToken),
      (err) => {
        assert.match(err.message, /not verified/i);
        return true;
      }
    );
  });

  test('Google Auth Endpoint: rejects non-@spit.ac.in Google account with 403', async () => {
    const nonSpitToken = createMockGoogleToken({
      sub: 'google-sub-non-spit-1',
      email: 'intruder@gmail.com',
      email_verified: true,
      name: 'Intruder'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: nonSpitToken })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, RESTRICTED_MESSAGE);
    assert.equal(data.error, 'Access restricted to SPIT students. Please use your @spit.ac.in Google account.');
  });

  test('Google Auth Endpoint: returns NEEDS_SIGNUP for new @spit.ac.in Google user', async () => {
    // Stub User.findOne to return null (not existing)
    User.findOne = async () => null;

    const newToken = createMockGoogleToken({
      sub: 'google-sub-new-student-999',
      email: 'new.student999@spit.ac.in',
      email_verified: true,
      name: 'New SPIT Student'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: newToken })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.action, 'NEEDS_SIGNUP');
    assert.equal(data.email, 'new.student999@spit.ac.in');
    assert.equal(data.name, 'New SPIT Student');
  });

  test('Google Auth Endpoint: returns LOGIN_SUCCESS for returning user with matching googleSub', async () => {
    // Stub User.findOne to return existing active user
    User.findOne = async (query) => {
      if (query.googleSub === 'google-sub-existing-888') {
        return {
          email: 'existing.student@spit.ac.in',
          name: 'Existing Student',
          username: 'existing_stu',
          role: 'Student',
          status: 'Active',
          branch: 'Computer Engineering',
          currentYear: 'Fourth Year',
          onboarded: true,
          nameColor: '',
          save: async () => {}
        };
      }
      return null;
    };

    const returningToken = createMockGoogleToken({
      sub: 'google-sub-existing-888',
      email: 'existing.student@spit.ac.in',
      email_verified: true,
      name: 'Existing Student'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: returningToken })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.action, 'LOGIN_SUCCESS');
    assert.equal(data.email, 'existing.student@spit.ac.in');
    assert.equal(data.username, 'existing_stu');
    assert.equal(typeof data.token, 'string');
    assert.equal(data.role, 'Student');
  });

  test('Google Auth Endpoint: returns LINK_REQUIRED when user exists by email without googleSub', async () => {
    User.findOne = async (query) => {
      if (query.googleSub) return null; // No user by googleSub
      if (query.email) {
        return {
          email: 'password.student@spit.ac.in',
          name: 'Password Student',
          password: '$2a$10$validPasswordHashForExistingAccount',
          role: 'Student',
          status: 'Active'
        };
      }
      return null;
    };

    const linkToken = createMockGoogleToken({
      sub: 'google-sub-unlinked-777',
      email: 'password.student@spit.ac.in',
      email_verified: true,
      name: 'Password Student'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: linkToken })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.action, 'LINK_REQUIRED');
    assert.equal(data.email, 'password.student@spit.ac.in');
    assert.match(data.message, /already exists/i);
  });

  test('Google Signup: validates username and matching passwords', async () => {
    User.findOne = async () => null;

    const testToken = createMockGoogleToken({
      sub: 'google-sub-val-test',
      email: 'val.student@spit.ac.in',
      email_verified: true,
      name: 'Val Student'
    });

    // Mismatched passwords
    const res1 = await fetch(`${baseUrl}/api/auth/google/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: testToken,
        name: 'Val Student',
        username: 'valid_user',
        password: 'password123',
        confirmPassword: 'differentpassword'
      })
    });
    assert.equal(res1.status, 400);
    const data1 = await res1.json();
    assert.equal(data1.error, 'Passwords do not match.');

    // Invalid username with special characters
    const res2 = await fetch(`${baseUrl}/api/auth/google/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: testToken,
        name: 'Val Student',
        username: 'invalid user!@#',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });
    assert.equal(res2.status, 400);
    const data2 = await res2.json();
    assert.match(data2.error, /Username must be 3-30 characters/i);

    // Signup without username succeeds
    let savedUser = null;
    const origSave = User.prototype.save;
    User.prototype.save = async function() {
      savedUser = this;
      return this;
    };
    try {
      const res3 = await fetch(`${baseUrl}/api/auth/google/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: testToken,
          name: 'Val Student',
          password: 'password123',
          confirmPassword: 'password123'
        })
      });
      assert.equal(res3.status, 201);
      const data3 = await res3.json();
      assert.equal(data3.action, 'LOGIN_SUCCESS');
      assert.equal(data3.email, 'val.student@spit.ac.in');
      assert.equal(savedUser.username, undefined);
    } finally {
      User.prototype.save = origSave;
    }
  });

  test('Database Schema: User schema defines username, googleSub, and authProvider', () => {
    const paths = User.schema.paths;
    assert.ok(paths.username, 'User schema should have username path');
    assert.ok(paths.googleSub, 'User schema should have googleSub path');
    assert.ok(paths.authProvider, 'User schema should have authProvider path');
  });

  test('Google Auth Endpoint: route alias /api/users/google also resolves successfully', async () => {
    User.findOne = async () => null;

    const token = createMockGoogleToken({
      sub: 'google-sub-alias-test-111',
      email: 'alias.student@spit.ac.in',
      email_verified: true,
      name: 'Alias Test Student'
    });

    const res = await fetch(`${baseUrl}/api/users/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.action, 'NEEDS_SIGNUP');
    assert.equal(data.email, 'alias.student@spit.ac.in');
  });

  test('Database Schema: User schema password defaults to null without plaintext default', () => {
    const paths = User.schema.paths;
    assert.ok(paths.password, 'User schema should have password path');
    const newUser = new User({ email: 'test.nopass@spit.ac.in', role: 'Student' });
    assert.equal(newUser.password, null, 'Unspecified password must default to null, not a plaintext string');
  });

  test('Google Link Endpoint: rejects passwordless account with controlled 400 response', async () => {
    const origFindOne = User.findOne;
    User.findOne = async (query) => {
      if (query.email) {
        return {
          _id: new mongoose.Types.ObjectId(),
          email: 'passwordless.student@spit.ac.in',
          password: null,
          role: 'Student',
          status: 'Active'
        };
      }
      return null;
    };

    try {
      const linkToken = createMockGoogleToken({
        sub: 'google-sub-link-test-999',
        email: 'passwordless.student@spit.ac.in',
        email_verified: true,
        name: 'Passwordless Student'
      });

      const res = await fetch(`${baseUrl}/api/auth/google/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: linkToken, password: 'AnyPassword123!' })
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /does not have a local password/i);
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Google Link Endpoint: rejects incorrect password with 401 when account has password', async () => {
    const origFindOne = User.findOne;
    const bcrypt = require('bcryptjs');
    const validHash = await bcrypt.hash('CorrectPassword123!', 10);

    User.findOne = async (query) => {
      if (query.email) {
        return {
          _id: new mongoose.Types.ObjectId(),
          email: 'haspass.student@spit.ac.in',
          password: validHash,
          role: 'Student',
          status: 'Active'
        };
      }
      return null;
    };

    try {
      const linkToken = createMockGoogleToken({
        sub: 'google-sub-link-test-888',
        email: 'haspass.student@spit.ac.in',
        email_verified: true,
        name: 'Has Pass Student'
      });

      const res = await fetch(`${baseUrl}/api/auth/google/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: linkToken, password: 'WrongPassword123!' })
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.match(data.error, /incorrect password/i);
    } finally {
      User.findOne = origFindOne;
    }
  });

  // --- Passwordless Administrator-Provisioned Onboarding & Regression Tests ---

  test('Safe Onboarding: passwordless administrator-created account completes onboarding with verified Google token', async () => {
    const origFindOne = User.findOne;
    const mockUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'admin.provisioned@spit.ac.in',
      name: '',
      password: null,
      role: 'Student',
      status: 'Active',
      authProvider: 'local',
      googleSub: null,
      save: async function() { return this; }
    };

    User.findOne = async (query) => {
      if (query.googleSub && !query._id) return null; // No user currently linked with this googleSub
      if (query.email) return mockUser;
      if (query.googleSub && query._id) return null; // No other conflicting user
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-admin-prov-001',
        email: 'admin.provisioned@spit.ac.in',
        email_verified: true,
        name: 'Verified Student'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.action, 'LOGIN_SUCCESS');
      assert.equal(data.email, 'admin.provisioned@spit.ac.in');
      assert.equal(data.role, 'Student');
      assert.equal(typeof data.token, 'string');
      assert.equal(mockUser.googleSub, 'google-sub-admin-prov-001');
      assert.equal(mockUser.authProvider, 'google');
      assert.equal(mockUser.name, 'Verified Student');
      assert.equal(mockUser.password, null, 'Password must remain strictly null');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: unverified Google email is rejected without issuing session token', async () => {
    const origFindOne = User.findOne;
    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-unverified-002',
        email: 'unverified.user@spit.ac.in',
        email_verified: false,
        name: 'Unverified User'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /not verified/i);
      assert.equal(data.token, undefined, 'No token should be issued for unverified email');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: non-institutional email is rejected with 403 without issuing session token', async () => {
    const token = createMockGoogleToken({
      sub: 'google-sub-noninst-003',
      email: 'outsider@gmail.com',
      email_verified: true,
      name: 'External Person'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ idToken: token })
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.error, RESTRICTED_MESSAGE);
    assert.equal(data.token, undefined, 'No token should be issued for non-institutional account');
  });

  test('Safe Onboarding: client-supplied email mismatching verified Google token is rejected with 400', async () => {
    const token = createMockGoogleToken({
      sub: 'google-sub-mismatch-004',
      email: 'real.user@spit.ac.in',
      email_verified: true,
      name: 'Real User'
    });

    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        idToken: token,
        email: 'attacker.impersonate@spit.ac.in'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /email mismatch/i);
    assert.equal(data.token, undefined);
  });

  test('Safe Onboarding: Google subject already associated with another account is rejected with 409', async () => {
    const origFindOne = User.findOne;
    // Returning user found by googleSub has a different email
    User.findOne = async (query) => {
      if (query.googleSub) {
        return {
          _id: new mongoose.Types.ObjectId(),
          email: 'first.owner@spit.ac.in',
          googleSub: 'google-sub-shared-005',
          role: 'Student',
          status: 'Active'
        };
      }
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-shared-005',
        email: 'different.person@spit.ac.in',
        email_verified: true,
        name: 'Different Person'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.error, /associated with a different email|already associated|already linked/i);
      assert.equal(data.token, undefined, 'No token should be issued when Google identity conflicts');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: existing account with local password still requires credential verification (LINK_REQUIRED)', async () => {
    const origFindOne = User.findOne;
    const bcrypt = require('bcryptjs');
    const existingHash = await bcrypt.hash('SecretLocalPass123!', 10);

    const mockUserWithPassword = {
      _id: new mongoose.Types.ObjectId(),
      email: 'password.holder@spit.ac.in',
      name: 'Password Holder',
      password: existingHash,
      role: 'Student',
      status: 'Active',
      authProvider: 'local',
      googleSub: null
    };

    User.findOne = async (query) => {
      if (query.googleSub) return null;
      if (query.email) return mockUserWithPassword;
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-passholder-006',
        email: 'password.holder@spit.ac.in',
        email_verified: true,
        name: 'Password Holder'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.action, 'LINK_REQUIRED');
      assert.equal(data.email, 'password.holder@spit.ac.in');
      assert.equal(data.token, undefined, 'No session token issued when password linking is required');
      assert.equal(mockUserWithPassword.googleSub, null, 'googleSub must not be automatically bound');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: existing account with conflicting Google subject is not overwritten', async () => {
    const origFindOne = User.findOne;
    const mockUserWithDifferentSub = {
      _id: new mongoose.Types.ObjectId(),
      email: 'already.linked@spit.ac.in',
      name: 'Already Linked',
      password: null,
      role: 'Student',
      status: 'Active',
      googleSub: 'google-sub-original-111',
      authProvider: 'google'
    };

    User.findOne = async (query) => {
      // Step 1: find by new sub returns null (new sub not in DB)
      if (query.googleSub && query.googleSub === 'google-sub-attacker-222') return null;
      // Step 2: find by email returns the user who has a different googleSub
      if (query.email) return mockUserWithDifferentSub;
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-attacker-222',
        email: 'already.linked@spit.ac.in',
        email_verified: true,
        name: 'Attacker Sub'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.match(data.error, /already linked to a different Google identity/i);
      assert.equal(data.token, undefined);
      assert.equal(mockUserWithDifferentSub.googleSub, 'google-sub-original-111', 'Original googleSub must remain intact');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: existing role and permissions remain strictly unchanged', async () => {
    const origFindOne = User.findOne;
    const jwt = require('jsonwebtoken');

    // Test with Administrator role
    const mockAdmin = {
      _id: new mongoose.Types.ObjectId(),
      email: 'prof.admin@spit.ac.in',
      name: 'Professor Admin',
      password: null,
      role: 'Administrator',
      status: 'Active',
      branch: 'Computer Engineering',
      currentYear: '',
      onboarded: true,
      authProvider: 'local',
      googleSub: null,
      save: async function() { return this; }
    };

    User.findOne = async (query) => {
      if (query.googleSub && !query._id) return null;
      if (query.email) return mockAdmin;
      if (query.googleSub && query._id) return null;
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-admin-role-008',
        email: 'prof.admin@spit.ac.in',
        email_verified: true,
        name: 'Professor Admin'
      });

      const res = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.action, 'LOGIN_SUCCESS');
      assert.equal(data.role, 'Administrator');
      assert.equal(data.isAdmin, true);
      assert.equal(mockAdmin.role, 'Administrator', 'Role must remain Administrator, not downgraded');

      // Verify claims inside the JWT token
      const decoded = jwt.decode(data.token);
      assert.equal(decoded.role, 'Administrator');
      assert.equal(decoded.email, 'prof.admin@spit.ac.in');
    } finally {
      User.findOne = origFindOne;
    }
  });

  test('Safe Onboarding: failed verification across error states issues no session token', async () => {
    // 1. Missing idToken
    const res1 = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });
    assert.equal(res1.status, 400);
    const data1 = await res1.json();
    assert.equal(data1.token, undefined);

    // 2. Inactive account
    const origFindOne = User.findOne;
    User.findOne = async (query) => {
      if (query.googleSub) return null;
      if (query.email) {
        return {
          _id: new mongoose.Types.ObjectId(),
          email: 'inactive.student@spit.ac.in',
          password: null,
          role: 'Student',
          status: 'Inactive'
        };
      }
      return null;
    };

    try {
      const token = createMockGoogleToken({
        sub: 'google-sub-inactive-009',
        email: 'inactive.student@spit.ac.in',
        email_verified: true,
        name: 'Inactive Student'
      });

      const res2 = await fetch(`${baseUrl}/api/auth/google`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idToken: token })
      });

      assert.equal(res2.status, 403);
      const data2 = await res2.json();
      assert.match(data2.error, /inactive/i);
      assert.equal(data2.token, undefined, 'Inactive account must receive no token');
    } finally {
      User.findOne = origFindOne;
    }
  });
});

