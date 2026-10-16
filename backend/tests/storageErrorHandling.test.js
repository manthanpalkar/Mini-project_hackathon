process.env.NODE_ENV = 'test';
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const { app } = require('../server');
const { User } = require('../models');

describe('Database Storage Error Handling & Registration Resiliency', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalCreate;
  let originalFindOne;
  let originalSave;

  before(async () => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    originalCreate = User.create;
    originalFindOne = User.findOne;
    originalSave = User.prototype.save;

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
    User.create = originalCreate;
    User.findOne = originalFindOne;
    User.prototype.save = originalSave;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('Standard Registration: returns friendly message without raw DB internals on MongoDB storage quota error', async () => {
    User.findOne = async () => null; // No duplicate user
    User.create = async () => {
      const quotaError = new Error('space quota exceeded');
      quotaError.name = 'MongoServerError';
      quotaError.code = 8000;
      throw quotaError;
    };

    const res = await fetch(`${baseUrl}/api/users/register-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'quota.test@spit.ac.in',
        password: 'password123'
      })
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'Registration is temporarily unavailable. Please try again later.');
    assert.equal(body.message, undefined);
  });

  test('Google Signup: returns friendly message without raw DB internals on MongoDB storage quota error', async () => {
    User.findOne = async () => null; // No duplicate username or email
    User.prototype.save = async function() {
      const quotaError = new Error('Command failed with error 8000 (AtlasError): space quota exceeded');
      quotaError.name = 'MongoServerError';
      quotaError.code = 8000;
      throw quotaError;
    };

    const mockPayload = {
      sub: 'google_sub_quota_test',
      email: 'student.quota@spit.ac.in',
      name: 'Quota Test Student',
      email_verified: true
    };
    const mockToken = `mock-google-token-${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}`;

    const res = await fetch(`${baseUrl}/api/auth/google/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: mockToken,
        name: 'Quota Test Student',
        username: 'quotastudent',
        password: 'password123',
        confirmPassword: 'password123'
      })
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'Registration is temporarily unavailable. Please try again later.');
    assert.equal(body.action, undefined);
  });
});
