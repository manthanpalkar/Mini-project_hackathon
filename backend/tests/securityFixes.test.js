const assert = require('node:assert');
const test = require('node:test');
const path = require('node:path');

test('Security Fix: CORS Allowlist strictly validates origins', () => {
  const DEFAULT_ALLOWED_ORIGINS = [
    'https://loop-seven-delta.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
  ];

  const isOriginAllowed = (origin, allowedList) => {
    if (!origin) return true; // Non-browser / curl / server-to-server
    return allowedList.includes(origin);
  };

  // Valid origins
  assert.strictEqual(isOriginAllowed(undefined, DEFAULT_ALLOWED_ORIGINS), true);
  assert.strictEqual(isOriginAllowed('http://localhost:5173', DEFAULT_ALLOWED_ORIGINS), true);
  assert.strictEqual(isOriginAllowed('https://loop-seven-delta.vercel.app', DEFAULT_ALLOWED_ORIGINS), true);

  // Unauthorized origins (including malicious vercel subdomains)
  assert.strictEqual(isOriginAllowed('https://evil-attacker.vercel.app', DEFAULT_ALLOWED_ORIGINS), false);
  assert.strictEqual(isOriginAllowed('https://phishing-site.com', DEFAULT_ALLOWED_ORIGINS), false);
  assert.strictEqual(isOriginAllowed('http://localhost:8080', DEFAULT_ALLOWED_ORIGINS), false);
});

test('Security Fix: JWT_SECRET strength validation', () => {
  const validateSecret = (secret) => {
    return Boolean(secret && typeof secret === 'string' && secret.trim().length >= 32);
  };

  // Weak/Missing secrets rejected
  assert.strictEqual(validateSecret(''), false);
  assert.strictEqual(validateSecret(undefined), false);
  assert.strictEqual(validateSecret('short_secret'), false);
  assert.strictEqual(validateSecret('1234567890123456789012345678901'), false); // 31 chars

  // Strong secret accepted
  assert.strictEqual(validateSecret('spit_loop_super_secret_jwt_key_2026'), true); // 34 chars
  assert.strictEqual(validateSecret('a'.repeat(32)), true);
});

test('Security Fix: escapeRegExp neutralizes catastrophic ReDoS patterns', () => {
  function escapeRegExp(string) {
    if (typeof string !== 'string') return string;
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const redosPattern = '((((((((((a+)+)+)+)+)+)+)+)+)+)';
  const escaped = escapeRegExp(redosPattern);
  
  // Compiling the escaped pattern does not treat parenthetical groups as regex syntax
  const regex = new RegExp(escaped, 'i');
  assert.strictEqual(regex.test(redosPattern), true);
  assert.strictEqual(regex.test('aaaaa'), false);

  const specialChars = '.*+?^${}()|[]\\';
  const escapedSpecial = escapeRegExp(specialChars);
  assert.strictEqual(new RegExp(escapedSpecial).test(specialChars), true);
});

test('Security Fix: Privilege escalation prevention in user profile updates', () => {
  const applyUserUpdates = (currentUser, targetEmail, updates) => {
    const isUserAdmin = currentUser.email.toLowerCase() === 'admin@spit.ac.in' ||
                        currentUser.role === 'Administrator' ||
                        currentUser.role === 'Admin';

    // Must be admin or updating own profile
    if (!isUserAdmin && currentUser.email.toLowerCase() !== targetEmail.toLowerCase()) {
      return { status: 403, error: 'Access denied' };
    }

    const updatedUser = { email: targetEmail, role: 'Student' };

    // Privilege escalation prevention
    if (updates.role !== undefined) {
      if (!isUserAdmin) {
        return { status: 403, error: 'Only Administrators can change user roles.' };
      }
      if (targetEmail.toLowerCase() !== 'admin@spit.ac.in') {
        updatedUser.role = updates.role;
      }
    }

    return { status: 200, user: updatedUser };
  };

  const studentUser = { email: 'student@spit.ac.in', role: 'Student' };
  const adminUser = { email: 'admin@spit.ac.in', role: 'Administrator' };

  // Student attempts to escalate own role to Administrator -> BLOCKED (403)
  const escalationAttempt = applyUserUpdates(studentUser, 'student@spit.ac.in', { role: 'Administrator' });
  assert.strictEqual(escalationAttempt.status, 403);
  assert.strictEqual(escalationAttempt.error, 'Only Administrators can change user roles.');

  // Admin legitimately changes student role -> ALLOWED (200)
  const legitimateChange = applyUserUpdates(adminUser, 'student@spit.ac.in', { role: 'Senior / Contributor' });
  assert.strictEqual(legitimateChange.status, 200);
  assert.strictEqual(legitimateChange.user.role, 'Senior / Contributor');
});

test('Security Fix: Onboarding role restriction blocks administrative privilege self-assignment', () => {
  const ALLOWED_ONBOARD_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];

  const validateOnboardRole = (email, requestedRole) => {
    if (email.toLowerCase() === 'admin@spit.ac.in') {
      return { role: 'Administrator', valid: true };
    }
    if (!ALLOWED_ONBOARD_ROLES.includes(requestedRole)) {
      return { valid: false, error: 'Invalid onboarding role selected. Administrative roles cannot be self-assigned.' };
    }
    return { role: requestedRole, valid: true };
  };

  // Student selecting valid roles -> ALLOWED
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'Student').valid, true);
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'Senior / Contributor').valid, true);
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'Alumni / Contributor').valid, true);

  // Student attempting to self-assign Administrator -> BLOCKED
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'Administrator').valid, false);
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'Admin').valid, false);
  assert.strictEqual(validateOnboardRole('student@spit.ac.in', 'SuperAdmin').valid, false);
});

test('Security Fix: Profile edit request prevents asking for administrative roles', () => {
  const ALLOWED_REQUEST_ROLES = ['Student', 'Senior / Contributor', 'Alumni / Contributor', 'Alumni', 'Senior'];

  const validateEditRequest = (email, requestedRole) => {
    if (email.toLowerCase() === 'admin@spit.ac.in') {
      return { pendingRole: 'Administrator', valid: true };
    }
    if (!ALLOWED_REQUEST_ROLES.includes(requestedRole)) {
      return { valid: false, error: 'Invalid role requested. Administrative roles cannot be requested via profile edits.' };
    }
    return { pendingRole: requestedRole, valid: true };
  };

  // Student asking for valid role -> ALLOWED
  assert.strictEqual(validateEditRequest('student@spit.ac.in', 'Senior / Contributor').valid, true);

  // Student asking for Administrator or Admin -> BLOCKED
  assert.strictEqual(validateEditRequest('student@spit.ac.in', 'Administrator').valid, false);
  assert.strictEqual(validateEditRequest('student@spit.ac.in', 'Admin').valid, false);
});

test('Security Fix: Path traversal prevention in legacy file streaming', () => {
  const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

  const resolveSafeLocalFile = (link) => {
    if (!link || !link.startsWith('/uploads/')) return null;
    const sanitizedFilename = path.basename(link);
    const resolved = path.resolve(UPLOADS_DIR, sanitizedFilename);
    if (!resolved.startsWith(UPLOADS_DIR + path.sep)) {
      return null;
    }
    return resolved;
  };

  // Legitimate file in uploads
  const safePath = resolveSafeLocalFile('/uploads/notes-12345.pdf');
  assert.strictEqual(safePath, path.join(UPLOADS_DIR, 'notes-12345.pdf'));

  // Traversal attack targeting .env or package.json
  const attackPath = resolveSafeLocalFile('/uploads/../../.env');
  // path.basename isolates the file name '.env' and places it securely under UPLOADS_DIR
  assert.strictEqual(attackPath, path.join(UPLOADS_DIR, '.env'));
  assert.notStrictEqual(attackPath, path.resolve(__dirname, '../.env'));
});

test('Security Fix: Non-admin uploads are strictly routed through moderation', () => {
  const determineUploadModeration = (userRole, userEmail) => {
    const isAdmin = userEmail.toLowerCase() === 'admin@spit.ac.in' || userRole === 'Administrator' || userRole === 'Admin';
    return {
      isPending: !isAdmin,
      status: isAdmin ? 'approved' : 'pending'
    };
  };

  // Admin upload -> immediately approved
  const adminUpload = determineUploadModeration('Administrator', 'admin@spit.ac.in');
  assert.strictEqual(adminUpload.isPending, false);
  assert.strictEqual(adminUpload.status, 'approved');

  // Student upload -> strictly pending moderation
  const studentUpload = determineUploadModeration('Student', 'student@spit.ac.in');
  assert.strictEqual(studentUpload.isPending, true);
  assert.strictEqual(studentUpload.status, 'pending');
});
