process.env.NODE_ENV = 'test';
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { app, RESET_SECRET } = require('../server');
const { User, PasswordResetChallenge } = require('../models');
const { 
  getLastMockEmail, 
  clearMockEmails, 
  getMockEmails, 
  setMockSender, 
  isBrevoConfigured, 
  buildLoopEmailHtml, 
  buildLoopEmailText,
  sendPasswordResetEmail
} = require('../services/emailService');

describe('LOOP Forgot Password & Password Recovery Workflows', () => {
  let server;
  let baseUrl;
  let originalReadyState;
  let originalUserFindOne;
  let originalChallengeFindOne;
  let originalChallengeCreate;
  let originalChallengeUpdateMany;
  let originalChallengeFindOneAndUpdate;
  let reqCount = 0;

  // In-memory test databases
  let mockUsers = {};
  let mockChallenges = [];

  const testEmail = 'student.test@spit.ac.in';
  const googleOnlyEmail = 'oauth.student@spit.ac.in';
  const initialPassword = 'InitialSecretPassword123!';
  let initialPasswordHash;

  function getHeaders() {
    reqCount++;
    return {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.20.30.${reqCount % 250 + 1}`
    };
  }

  async function postJson(path, payload) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    const headers = Object.fromEntries(res.headers.entries());
    return { status: res.status, data, headers };
  }

  before(async () => {
    initialPasswordHash = await bcrypt.hash(initialPassword, 8);

    // Mock readyState
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true
    });

    // Save originals
    originalUserFindOne = User.findOne;
    originalChallengeFindOne = PasswordResetChallenge.findOne;
    originalChallengeCreate = PasswordResetChallenge.create;
    originalChallengeUpdateMany = PasswordResetChallenge.updateMany;
    originalChallengeFindOneAndUpdate = PasswordResetChallenge.findOneAndUpdate;

    // Start ephemeral server
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

    User.findOne = originalUserFindOne;
    PasswordResetChallenge.findOne = originalChallengeFindOne;
    PasswordResetChallenge.create = originalChallengeCreate;
    PasswordResetChallenge.updateMany = originalChallengeUpdateMany;
    PasswordResetChallenge.findOneAndUpdate = originalChallengeFindOneAndUpdate;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    clearMockEmails();
    mockChallenges = [];

    // Reset mock users
    mockUsers = {
      [testEmail]: {
        _id: 'user_std_001',
        email: testEmail,
        name: 'Test Student',
        password: initialPasswordHash,
        role: 'Student',
        status: 'Active',
        onboarded: true,
        save: async function() { return this; }
      },
      [googleOnlyEmail]: {
        _id: 'user_oauth_002',
        email: googleOnlyEmail,
        name: 'OAuth Student',
        password: null, // Passwordless account
        googleSub: 'google-sub-oauth-002',
        role: 'Student',
        status: 'Active',
        onboarded: true,
        save: async function() { return this; }
      }
    };

    // User.findOne mock
    User.findOne = async (query) => {
      if (!query) return null;
      const checkEmail = (matcher) => {
        for (const [em, user] of Object.entries(mockUsers)) {
          if (matcher instanceof RegExp && matcher.test(em)) return user;
          if (typeof matcher === 'string' && matcher.toLowerCase() === em.toLowerCase()) return user;
          if (matcher && matcher.$in) {
            for (const item of matcher.$in) {
              if (item instanceof RegExp && item.test(em)) return user;
              if (typeof item === 'string' && item.toLowerCase() === em.toLowerCase()) return user;
            }
          }
        }
        return null;
      };

      if (query.email) {
        const found = checkEmail(query.email);
        if (found) return found;
      }
      if (query.$or) {
        for (const cond of query.$or) {
          if (cond.email) {
            const found = checkEmail(cond.email);
            if (found) return found;
          }
        }
      }
      return null;
    };

    // PasswordResetChallenge.findOne mock
    PasswordResetChallenge.findOne = (query) => {
      let filtered = [...mockChallenges];
      if (query && query.email) {
        if (typeof query.email === 'string') {
          filtered = filtered.filter(c => c.email.toLowerCase() === query.email.toLowerCase());
        } else if (query.email.$in) {
          filtered = filtered.filter(c => query.email.$in.some(e => e.toLowerCase() === c.email.toLowerCase()));
        }
      }
      if (query && query.status) {
        if (typeof query.status === 'string') {
          filtered = filtered.filter(c => c.status === query.status);
        } else if (query.status.$in) {
          filtered = filtered.filter(c => query.status.$in.includes(c.status));
        }
      }
      if (query && query.expiresAt && query.expiresAt.$gt) {
        filtered = filtered.filter(c => new Date(c.expiresAt) > query.expiresAt.$gt);
      }

      // Sort builder
      const chain = {
        sort: (sortObj) => {
          if (sortObj && sortObj.createdAt === -1) {
            filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          }
          return Promise.resolve(filtered[0] || null);
        },
        then: (onResolve, onReject) => {
          return Promise.resolve(filtered[0] || null).then(onResolve, onReject);
        }
      };
      return chain;
    };

    // PasswordResetChallenge.create mock
    PasswordResetChallenge.create = async (doc) => {
      const record = {
        consumed: false,
        attempts: 0,
        status: 'pending',
        ...doc,
        _id: 'challenge_' + Math.random().toString(36).substring(2, 9),
        createdAt: new Date(),
        updatedAt: new Date(),
        save: async function() { return this; }
      };
      mockChallenges.push(record);
      return record;
    };

    // PasswordResetChallenge.updateMany mock
    PasswordResetChallenge.updateMany = async (query, update) => {
      let matched = 0;
      for (const c of mockChallenges) {
        if (query.email && c.email.toLowerCase() !== query.email.toLowerCase()) continue;
        if (query.status && c.status !== query.status) continue;
        if (update.$set) {
          Object.assign(c, update.$set);
        }
        matched++;
      }
      return { matchedCount: matched, modifiedCount: matched };
    };

    // PasswordResetChallenge.findOneAndUpdate mock
    PasswordResetChallenge.findOneAndUpdate = async (query, update, options) => {
      for (const c of mockChallenges) {
        if (query.email && c.email.toLowerCase() !== query.email.toLowerCase()) continue;
        if (query.resetTokenHash && c.resetTokenHash !== query.resetTokenHash) continue;
        if (query.consumed !== undefined && c.consumed !== query.consumed) continue;
        if (query.status && c.status !== query.status) continue;
        if (query.resetTokenExpiresAt && query.resetTokenExpiresAt.$gt) {
          if (new Date(c.resetTokenExpiresAt) <= query.resetTokenExpiresAt.$gt) continue;
        }

        if (update.$set) {
          Object.assign(c, update.$set);
        }
        c.updatedAt = new Date();
        return c;
      }
      return null;
    };
  });

  // TEST 1: Request reset with valid email
  test('Valid request: generates 6-digit code, saves challenge, sends email, returns generic response', async () => {
    const { status, data } = await postJson('/api/auth/forgot-password', { email: testEmail });

    assert.equal(status, 200);
    assert.match(data.message, /If an account with that email exists/i);
    assert.equal(data.token, undefined, 'Must not return session token');

    // Verify email was dispatched
    const email = getLastMockEmail();
    assert.ok(email, 'Email should have been dispatched');
    assert.equal(email.to, testEmail);
    assert.ok(email.code, 'Dispatched email must contain code');
    assert.match(email.code, /^\d{6}$/, 'Code must be exactly 6 digits');

    // Verify challenge created in storage
    assert.equal(mockChallenges.length, 1);
    assert.equal(mockChallenges[0].email, testEmail);
    assert.equal(mockChallenges[0].status, 'pending');
    assert.equal(mockChallenges[0].attempts, 0);

    // Verify HMAC-SHA256 hash
    const expectedHash = crypto.createHmac('sha256', RESET_SECRET).update(email.code).digest('hex');
    assert.equal(mockChallenges[0].codeHash, expectedHash);
  });

  // TEST 2: Route alias /api/users/forgot-password
  test('Route alias: /api/users/forgot-password functions identically', async () => {
    const { status, data } = await postJson('/api/users/forgot-password', { email: testEmail });
    assert.equal(status, 200);
    assert.match(data.message, /If an account with that email exists/i);
    assert.equal(mockChallenges.length, 1);
  });

  // TEST 3: Unknown email does not enumerate or dispatch email
  test('Unknown email: returns identical generic response without enumeration or email delivery', async () => {
    const { status, data } = await postJson('/api/auth/forgot-password', { email: 'nonexistent.user@spit.ac.in' });

    assert.equal(status, 200);
    assert.match(data.message, /If an account with that email exists/i);

    const email = getLastMockEmail();
    assert.equal(email, null, 'No email should be dispatched for unknown user');
    assert.equal(mockChallenges.length, 0, 'No challenge should be stored for unknown user');
  });

  // TEST 4: Passwordless / Google OAuth only account
  test('Google-only account: guided to Google sign-in and does not send reset email', async () => {
    const { status, data } = await postJson('/api/auth/forgot-password', { email: googleOnlyEmail });

    assert.equal(status, 400);
    assert.equal(data.code, 'GOOGLE_ACCOUNT_ONLY');
    assert.match(data.error, /Password reset isn’t available for this account/i);
    assert.match(data.error, /Continue with Google/i);

    const email = getLastMockEmail();
    assert.equal(email, null, 'No email should be dispatched for passwordless Google OAuth account');
    assert.equal(mockChallenges.length, 0, 'No challenge should be created for passwordless account');
  });

  // TEST 5: Input validation for forgot password
  test('Input validation: rejects empty or invalid email with HTTP 400', async () => {
    const res1 = await postJson('/api/auth/forgot-password', {});
    assert.equal(res1.status, 400);

    const res2 = await postJson('/api/auth/forgot-password', { email: '   ' });
    assert.equal(res2.status, 400);

    const res3 = await postJson('/api/auth/forgot-password', { email: 'a'.repeat(101) });
    assert.equal(res3.status, 400);
  });

  // TEST 6: Resend Cooldown (60s)
  test('Cooldown: second request within 60s is rate-limited with HTTP 429', async () => {
    // First request
    const first = await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(first.status, 200);

    // Second request immediately
    const second = await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(second.status, 429);
    assert.equal(second.data.code, 'COOLDOWN_ACTIVE');
    assert.ok(second.data.retryAfter > 0);
  });

  // TEST 7: Resend after cooldown invalidates previous code
  test('Invalidation: new code request invalidates previous pending challenges', async () => {
    // First request
    await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(mockChallenges.length, 1);
    const firstCode = getLastMockEmail().code;

    // Fast-forward lastIssuedAt to beyond 60s
    mockChallenges[0].lastIssuedAt = new Date(Date.now() - 65 * 1000);

    // Second request
    const second = await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(second.status, 200);
    assert.equal(mockChallenges.length, 2);

    // Previous challenge should be invalidated
    assert.equal(mockChallenges[0].status, 'invalidated');
    assert.equal(mockChallenges[1].status, 'pending');

    // Attempting to verify the old code should fail
    const verifyOld = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: firstCode
    });
    assert.equal(verifyOld.status, 400);
  });

  // TEST 8: Verify code format validation
  test('Verify Code: rejects non-6-digit codes with HTTP 400 INVALID_FORMAT', async () => {
    const res1 = await postJson('/api/auth/verify-reset-code', { email: testEmail, code: '123' });
    assert.equal(res1.status, 400);
    assert.equal(res1.data.code, 'INVALID_FORMAT');

    const res2 = await postJson('/api/auth/verify-reset-code', { email: testEmail, code: 'abcdef' });
    assert.equal(res2.status, 400);
    assert.equal(res2.data.code, 'INVALID_FORMAT');
  });

  // TEST 9: Verify code with incorrect code increments attempts
  test('Verify Code: incorrect code increments attempts and reports remaining count', async () => {
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;
    const wrongCode = realCode === '123456' ? '654321' : '123456';

    const res = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: wrongCode
    });

    assert.equal(res.status, 400);
    assert.equal(res.data.code, 'INVALID_CODE');
    assert.equal(res.data.remainingAttempts, 4);
    assert.equal(mockChallenges[0].attempts, 1);
  });

  // TEST 10: Max attempts lockout (5 attempts)
  test('Max attempts: 5 failed attempts locks the code with HTTP 429', async () => {
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;
    const wrongCode = realCode === '123456' ? '654321' : '123456';

    for (let i = 1; i <= 4; i++) {
      const res = await postJson('/api/auth/verify-reset-code', {
        email: testEmail,
        code: wrongCode
      });
      assert.equal(res.status, 400);
      assert.equal(res.data.remainingAttempts, 5 - i);
    }

    // 5th attempt -> locks out
    const fifth = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: wrongCode
    });
    assert.equal(fifth.status, 429);
    assert.equal(fifth.data.code, 'MAX_ATTEMPTS_EXCEEDED');
    assert.equal(mockChallenges[0].status, 'locked');

    // 6th attempt (even with the correct code) should now be rejected
    const sixth = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: realCode
    });
    assert.equal(sixth.status, 429);
    assert.equal(sixth.data.code, 'MAX_ATTEMPTS_EXCEEDED');
  });

  // TEST 11: Expired code (>10 minutes)
  test('Expired code: rejected with HTTP 400 CODE_EXPIRED', async () => {
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;

    // Simulate expiration
    mockChallenges[0].expiresAt = new Date(Date.now() - 1000);

    const res = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: realCode
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.code, 'CODE_EXPIRED');
  });

  // TEST 12: Successful code verification
  test('Successful code verification: generates resetToken and returns 200 without session token', async () => {
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;

    const res = await postJson('/api/auth/verify-reset-code', {
      email: testEmail,
      code: realCode
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.resetToken, 'Must issue resetToken');
    assert.equal(res.data.token, undefined, 'Must NOT issue session token');

    assert.equal(mockChallenges[0].status, 'verified');
    assert.ok(mockChallenges[0].resetTokenHash);

    // Verify resetTokenHash is SHA256 of resetToken
    const expectedHash = crypto.createHash('sha256').update(res.data.resetToken).digest('hex');
    assert.equal(mockChallenges[0].resetTokenHash, expectedHash);
  });

  // TEST 13: Reset password password mismatch & length validation
  test('Reset password: validates matching passwords and minimum length', async () => {
    // Setup verified challenge
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;
    const verifyRes = await postJson('/api/auth/verify-reset-code', { email: testEmail, code: realCode });
    const resetToken = verifyRes.data.resetToken;

    // Mismatched passwords
    const resMismatch = await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken,
      newPassword: 'NewPassword123!',
      confirmPassword: 'DifferentPassword123!'
    });
    assert.equal(resMismatch.status, 400);
    assert.match(resMismatch.data.error, /do not match/i);

    // Too short (<6 chars)
    const resShort = await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken,
      newPassword: '123',
      confirmPassword: '123'
    });
    assert.equal(resShort.status, 400);
    assert.match(resShort.data.error, /between 6 and 100/i);
  });

  // TEST 14: Successful reset and single-use token consumption
  test('Reset password: successfully updates bcrypt password and consumes reset token atomically', async () => {
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;
    const verifyRes = await postJson('/api/auth/verify-reset-code', { email: testEmail, code: realCode });
    const resetToken = verifyRes.data.resetToken;

    const newPassword = 'BrandNewSecurePassword456!';

    // Reset password
    const resetRes = await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken,
      newPassword,
      confirmPassword: newPassword
    });

    assert.equal(resetRes.status, 200);
    assert.match(resetRes.data.message, /Password reset successfully/i);
    assert.equal(resetRes.data.token, undefined, 'Must NOT issue session token on reset');

    // Verify challenge consumed
    assert.equal(mockChallenges[0].consumed, true);
    assert.equal(mockChallenges[0].status, 'consumed');

    // Verify user password updated with bcrypt hash
    const user = mockUsers[testEmail];
    const isNewValid = await bcrypt.compare(newPassword, user.password);
    assert.equal(isNewValid, true, 'User password must match new password');

    const isOldValid = await bcrypt.compare(initialPassword, user.password);
    assert.equal(isOldValid, false, 'Old password must no longer match');

    // SINGLE-USE CHECK: Attempt to reuse the exact same reset token
    const reuseRes = await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken,
      newPassword: 'AnotherPassword789!',
      confirmPassword: 'AnotherPassword789!'
    });
    assert.equal(reuseRes.status, 400);
    assert.equal(reuseRes.data.code, 'INVALID_TOKEN');
  });

  // TEST 15: Login verification with new vs old password
  test('Login verification: user logs in with new password, old password fails', async () => {
    // Setup & perform full reset
    await postJson('/api/auth/forgot-password', { email: testEmail });
    const realCode = getLastMockEmail().code;
    const verifyRes = await postJson('/api/auth/verify-reset-code', { email: testEmail, code: realCode });
    const resetToken = verifyRes.data.resetToken;
    const newPassword = 'FinalUpdatedPassword2026!';

    await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken,
      newPassword,
      confirmPassword: newPassword
    });

    // Mock User.findOne for login
    User.findOne = async (query) => {
      if (query && query.$or) {
        for (const cond of query.$or) {
          if (cond.email && cond.email.test(testEmail)) return mockUsers[testEmail];
          if (cond.username && cond.username.test('teststudent')) return mockUsers[testEmail];
        }
      }
      return null;
    };

    // Attempt login with OLD password -> MUST FAIL
    const oldLogin = await postJson('/api/users/login', {
      email: testEmail,
      password: initialPassword
    });
    assert.equal(oldLogin.status, 401);

    // Attempt login with NEW password -> MUST SUCCEED
    const newLogin = await postJson('/api/users/login', {
      email: testEmail,
      password: newPassword
    });
    assert.equal(newLogin.status, 200);
    assert.equal(newLogin.data.email, testEmail);
    assert.ok(newLogin.data.token, 'Session token should be issued on manual login');
  });

  // TEST 16: Zero session tokens across all recovery steps
  test('Token safety: zero session tokens issued across all forgot-password endpoints', async () => {
    // Step 1: Request
    const r1 = await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(r1.data.token, undefined);

    // Step 2: Verify code
    const code = getLastMockEmail().code;
    const r2 = await postJson('/api/auth/verify-reset-code', { email: testEmail, code });
    assert.equal(r2.data.token, undefined);

    // Step 3: Reset password
    const r3 = await postJson('/api/auth/reset-password', {
      email: testEmail,
      resetToken: r2.data.resetToken,
      newPassword: 'TestingTokenAbsence999!',
      confirmPassword: 'TestingTokenAbsence999!'
    });
    assert.equal(r3.data.token, undefined);
  });

  // TEST 17: Brevo API integration and configuration detection
  test('Brevo API: correctly identifies valid vs invalid API key formats', () => {
    const originalKey = process.env.BREVO_API_KEY;
    try {
      process.env.BREVO_API_KEY = 'xkeysib-mock1234567890abcdef1234567890abcdef-1234567890abcdef';
      assert.equal(isBrevoConfigured(), true);

      process.env.BREVO_API_KEY = 'invalid_key_prefix';
      assert.equal(isBrevoConfigured(), false);

      delete process.env.BREVO_API_KEY;
      assert.equal(isBrevoConfigured(), false);
    } finally {
      if (originalKey !== undefined) {
        process.env.BREVO_API_KEY = originalKey;
      } else {
        delete process.env.BREVO_API_KEY;
      }
    }
  });

  // TEST 18: Template verification: HTML and text representations
  test('Email Templates: HTML and text include SPIT branding, 6-digit code, and security advice', () => {
    const testCode = '482910';
    const recipient = 'student.audit@spit.ac.in';

    const html = buildLoopEmailHtml({ to: recipient, code: testCode });
    assert.ok(html.includes(testCode), 'HTML template must contain the OTP code');
    assert.ok(html.includes('LOOP'), 'HTML template must contain LOOP branding');
    assert.ok(html.includes('SPIT'), 'HTML template must contain SPIT badge');
    assert.ok(html.includes('10 minutes'), 'HTML template must mention 10-minute expiry');
    assert.ok(html.includes(recipient), 'HTML template should include recipient');

    const text = buildLoopEmailText({ to: recipient, code: testCode });
    assert.ok(text.includes(testCode), 'Plaintext template must contain the OTP code');
    assert.ok(text.includes('10 minutes'), 'Plaintext template must mention 10-minute expiry');
  });

  // TEST 19: Provider error handling: handles email provider failures gracefully
  test('Email Provider Error: propagates errors when dispatch fails', async () => {
    try {
      setMockSender(async () => {
        throw new Error('Simulated upstream Brevo API network outage');
      });

      await assert.rejects(
        () => sendPasswordResetEmail({ to: testEmail, code: '999888' }),
        /Simulated upstream Brevo API network outage/
      );
    } finally {
      setMockSender(null);
    }
  });

  // TEST 20: Input validation for email service parameters
  test('Email Service: validates mandatory recipient and code arguments', async () => {
    await assert.rejects(
      () => sendPasswordResetEmail({ to: '', code: '123456' }),
      /Recipient email is required/
    );

    await assert.rejects(
      () => sendPasswordResetEmail({ to: 'valid@spit.ac.in', code: '' }),
      /Verification code is required/
    );
  });

  // TEST 21: Brevo dispatch rejection or timeout isolates error and invalidates challenge
  test('Brevo Error Isolation: dispatch failure invalidates challenge and returns HTTP 502 EMAIL_DELIVERY_FAILED', async () => {
    try {
      setMockSender(async () => {
        throw new Error('Brevo API HTTP 401: Unauthorized invalid API key');
      });

      const { status, data } = await postJson('/api/auth/forgot-password', { email: testEmail });
      assert.equal(status, 502);
      assert.equal(data.code, 'EMAIL_DELIVERY_FAILED');
      assert.match(data.error, /Failed to deliver verification code email/i);
      // Ensure API key or internals are NOT leaked to client
      assert.equal(data.error.includes('xkeysib'), false);
      assert.equal(data.error.includes('Unauthorized'), false);

      // Verify that NO pending challenge remains usable
      const pendingChallenges = mockChallenges.filter(c => c.email === testEmail && c.status === 'pending');
      assert.equal(pendingChallenges.length, 0, 'No challenge should remain pending after delivery failure');
    } finally {
      setMockSender(null);
    }
  });

  // TEST 22: Provider acceptance returns success: true and creates usable challenge
  test('Provider Acceptance: successful dispatch returns success: true and pending challenge', async () => {
    const { status, data } = await postJson('/api/auth/forgot-password', { email: testEmail });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /If an account with that email exists/i);

    const pending = mockChallenges.filter(c => c.email === testEmail && c.status === 'pending');
    assert.equal(pending.length, 1);
  });

  // TEST 23: Unknown account returns identical generic response without creating any challenge
  test('Unknown Account Safety: returns identical generic response with zero stored challenges', async () => {
    const { status, data } = await postJson('/api/auth/forgot-password', { email: 'ghost.user.999@spit.ac.in' });
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.match(data.message, /If an account with that email exists/i);

    const challenges = mockChallenges.filter(c => c.email === 'ghost.user.999@spit.ac.in');
    assert.equal(challenges.length, 0);
  });

  // TEST 23b: Response Anti-Enumeration: complete status code, response body, and headers match identically
  test('Anti-Enumeration Equality: existing account and nonexistent account receive identical status, body, and headers', async () => {
    const resValid = await postJson('/api/auth/forgot-password', { email: testEmail });
    const resGhost = await postJson('/api/auth/forgot-password', { email: 'nonexistent.probe@spit.ac.in' });

    assert.equal(resValid.status, 200);
    assert.equal(resGhost.status, 200);
    assert.deepStrictEqual(resValid.data, resGhost.data);
    assert.equal(resValid.headers['content-type'], resGhost.headers['content-type']);

    // Ensure response fields do not leak account existence
    assert.deepStrictEqual(Object.keys(resValid.data).sort(), ['message', 'success']);
    assert.equal(resValid.data.emailSent, undefined);
    assert.equal(resGhost.data.emailSent, undefined);
  });

  // TEST 24: Universal Multi-User Support: Multiple distinct accounts dynamically receive their own OTPs
  test('Universal Multi-User: User A, User B, and User C each receive distinct OTPs at their own emails', async () => {
    const userA = 'user.alpha@spit.ac.in';
    const userB = 'user.beta@spit.ac.in';
    const userC = 'user.gamma@spit.ac.in';

    mockUsers[userA] = {
      _id: 'usr_alpha_1',
      email: userA,
      name: 'User Alpha',
      password: await bcrypt.hash('AlphaPass123!', 8),
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };
    mockUsers[userB] = {
      _id: 'usr_beta_2',
      email: userB,
      name: 'User Beta',
      password: await bcrypt.hash('BetaPass123!', 8),
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };
    mockUsers[userC] = {
      _id: 'usr_gamma_3',
      email: userC,
      name: 'User Gamma',
      password: await bcrypt.hash('GammaPass123!', 8),
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };

    clearMockEmails();

    // 1. Request OTP for User A
    const resA = await postJson('/api/auth/forgot-password', { email: userA });
    assert.equal(resA.status, 200);
    assert.equal(resA.data.success, true);

    // 2. Request OTP for User B
    const resB = await postJson('/api/auth/forgot-password', { email: userB });
    assert.equal(resB.status, 200);
    assert.equal(resB.data.success, true);

    // 3. Request OTP for User C
    const resC = await postJson('/api/auth/forgot-password', { email: userC });
    assert.equal(resC.status, 200);
    assert.equal(resC.data.success, true);

    // Verify all 3 received emails to their own distinct recipient addresses
    const emails = getMockEmails();
    assert.equal(emails.length, 3);
    assert.equal(emails[0].to, userA);
    assert.equal(emails[1].to, userB);
    assert.equal(emails[2].to, userC);

    // Verify OTP codes are distinct
    assert.notEqual(emails[0].code, emails[1].code);
    assert.notEqual(emails[1].code, emails[2].code);
  });

  // TEST 25: Cross-User Account Isolation: OTP from User A cannot reset User B
  test('Cross-User Account Isolation: OTP A cannot verify for User B, and reset updates only intended user', async () => {
    const userA = 'user.alpha@spit.ac.in';
    const userB = 'user.beta@spit.ac.in';

    mockUsers[userA] = {
      _id: 'usr_alpha_1',
      email: userA,
      name: 'User Alpha',
      password: await bcrypt.hash('AlphaPass123!', 8),
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };
    mockUsers[userB] = {
      _id: 'usr_beta_2',
      email: userB,
      name: 'User Beta',
      password: await bcrypt.hash('BetaPass123!', 8),
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };

    const originalHashB = mockUsers[userB].password;

    clearMockEmails();
    await postJson('/api/auth/forgot-password', { email: userA });
    const emailA = getLastMockEmail();
    assert.equal(emailA.to, userA);
    const codeA = emailA.code;

    // Attempt to verify codeA against User B's email -> must fail
    const crossVerify = await postJson('/api/auth/verify-reset-code', { email: userB, code: codeA });
    assert.equal(crossVerify.status, 400);

    // Verify codeA correctly for User A
    const validVerifyA = await postJson('/api/auth/verify-reset-code', { email: userA, code: codeA });
    assert.equal(validVerifyA.status, 200);
    const { resetToken } = validVerifyA.data;
    assert.ok(resetToken);

    // Reset password for User A
    const resetRes = await postJson('/api/auth/reset-password', {
      email: userA,
      resetToken,
      newPassword: 'BrandNewPassword123!',
      confirmPassword: 'BrandNewPassword123!'
    });
    assert.equal(resetRes.status, 200);

    // User A's password updated, User B's password strictly unchanged
    assert.notEqual(mockUsers[userA].password, initialPasswordHash);
    assert.equal(mockUsers[userB].password, originalHashB);
  });

  // TEST 26: Automatic Eligibility for Newly Registered Users
  test('Automatic Eligibility: Newly created user dynamically supports recovery without manual configuration', async () => {
    const newStudent = 'fresh.student.2026@spit.ac.in';
    const initialPass = await bcrypt.hash('FreshPassword123!', 8);

    // Simulate newly registered student entering MongoDB
    mockUsers[newStudent] = {
      _id: 'usr_fresh_99',
      email: newStudent,
      name: 'Fresh Student',
      password: initialPass,
      role: 'Student',
      status: 'Active',
      save: async function() { return this; }
    };

    clearMockEmails();
    const res = await postJson('/api/auth/forgot-password', { email: newStudent });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);

    const emailSent = getLastMockEmail();
    assert.ok(emailSent);
    assert.equal(emailSent.to, newStudent);
    assert.match(emailSent.code, /^\d{6}$/);
  });
});
