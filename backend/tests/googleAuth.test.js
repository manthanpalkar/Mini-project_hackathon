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
});
