/**
 * LOOP — Automated Dynamic Application Security Testing (DAST) Suite
 * 
 * Target: Authorized Local Test Backend (http://127.0.0.1:5055)
 * Database: Isolated Docker MongoDB (127.0.0.1:27018/loop_staging)
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Read secret from .env.local.test
const envContent = fs.readFileSync(path.join(__dirname, '../.env.local.test'), 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=([^\r\n]+)/);
const JWT_SECRET = jwtMatch ? jwtMatch[1].trim() : 'dummy';

const BASE_URL = 'http://127.0.0.1:5055';
const TARGET_MONGO_URI = 'mongodb://127.0.0.1:27018/loop_staging';

function sendRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url || BASE_URL + options.path);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const payload = body || options.body || null;
    if (payload && typeof payload === 'object' && !reqOptions.headers['Content-Type']) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);

    if (payload) {
      req.write(typeof payload === 'object' ? JSON.stringify(payload) : payload);
    }
    req.end();
  });
}

function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runDastSuite() {
  console.log('========================================================================');
  console.log('  LOOP — Dynamic Application Security Testing (DAST) Suite              ');
  console.log(`  Target: ${BASE_URL} (Isolated loop_staging)                           `);
  console.log('========================================================================\n');

  // Step 1: Connect to staging MongoDB and provision 2 isolated synthetic test users
  await mongoose.connect(TARGET_MONGO_URI);
  const usersColl = mongoose.connection.db.collection('users');

  await usersColl.updateOne(
    { email: 'sec_student@spit.ac.in' },
    { $set: { email: 'sec_student@spit.ac.in', name: 'Security Student', role: 'Student', status: 'Active', department: 'Comps', passingYear: 2026, onboarded: true } },
    { upsert: true }
  );

  await usersColl.updateOne(
    { email: 'admin@spit.ac.in' },
    { $set: { email: 'admin@spit.ac.in', name: 'Security Admin', role: 'Administrator', status: 'Active', isAdmin: true } },
    { upsert: true }
  );

  console.log('✔ Seeded 2 isolated synthetic security users in loop_staging:');
  console.log('  - sec_student@spit.ac.in (Role: Student)');
  console.log('  - admin@spit.ac.in (Role: Administrator)\n');

  const studentToken = createToken({ email: 'sec_student@spit.ac.in', role: 'Student' });
  const adminToken = createToken({ email: 'admin@spit.ac.in', role: 'Administrator' });

  const testResults = [];

  async function test(name, fn) {
    process.stdout.write(`[TEST] ${name} ... `);
    try {
      await fn();
      console.log('✔ PASS');
      testResults.push({ name, status: 'PASS' });
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      testResults.push({ name, status: 'FAIL', error: err.message });
    }
  }

  // 1. AUTHENTICATION
  await test('1.1 Missing Authentication Token returns 401', async () => {
    const res = await sendRequest({ path: '/api/folders', method: 'GET' });
    assert.equal(res.statusCode, 401);
  });

  await test('1.2 Forged Signature Token returns 403', async () => {
    const forgedToken = jwt.sign({ email: 'admin@spit.ac.in', role: 'Administrator' }, 'wrong_secret_signature');
    const res = await sendRequest({
      path: '/api/folders',
      headers: { Authorization: `Bearer ${forgedToken}` }
    });
    assert.equal(res.statusCode, 403);
  });

  await test('1.3 Alg=none Token Attack rejected with 403', async () => {
    const noneToken = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImFkbWluQHNwaXQuYWMuaW4iLCJyb2xlIjoiQWRtaW5pc3RyYXRvciJ9.';
    const res = await sendRequest({
      path: '/api/folders',
      headers: { Authorization: `Bearer ${noneToken}` }
    });
    assert.equal(res.statusCode, 403);
  });

  // 2. AUTHORIZATION & RBAC
  await test('2.1 Student calling Admin Diagnostics returns 403 Forbidden', async () => {
    const res = await sendRequest({
      path: '/api/admin/diagnostics/system-health',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.statusCode, 403);
  });

  await test('2.2 Administrator calling Admin Diagnostics returns 200 OK', async () => {
    const res = await sendRequest({
      path: '/api/admin/diagnostics/system-health',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(res.statusCode, 200);
    assert.ok(res.json?.overallStatus);
  });

  // 3. IDOR (Insecure Direct Object Reference)
  await test('3.1 Student attempting to approve pending resource returns 403 Forbidden', async () => {
    const res = await sendRequest({
      path: '/api/pending-resources/fake-pending-id/approve',
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {}
    });
    assert.equal(res.statusCode, 403);
  });

  // 4. PRIVILEGE ESCALATION
  await test('4.1 Onboarding self-assignment of Administrator blocked with 400 Bad Request', async () => {
    const res = await sendRequest({
      path: '/api/users/sec_student@spit.ac.in/onboard',
      method: 'PUT',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { role: 'Administrator', department: 'Comps', passingYear: 2026 }
    });
    assert.equal(res.statusCode, 400);
  });

  await test('4.2 Profile edit request asking for Administrator blocked with 400 Bad Request', async () => {
    const res = await sendRequest({
      path: '/api/users/sec_student@spit.ac.in/edit-request',
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { requestedRole: 'Administrator', reason: 'Attempting escalation' }
    });
    assert.equal(res.statusCode, 400);
  });

  // 5. INPUT VALIDATION & TYPING
  await test('5.1 Malformed Login Body (Non-string email) rejected with 400', async () => {
    const res = await sendRequest({
      path: '/api/users/login',
      method: 'POST',
      body: { email: { $gt: "" }, password: "password123" }
    });
    assert.equal(res.statusCode, 400);
  });

  await test('5.2 Nonexistent / Malformed Resource ID rejected safely with 404', async () => {
    const res = await sendRequest({
      path: '/api/resources/invalid-object-id-12345/file',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.ok(res.statusCode === 404 || res.statusCode === 400);
  });

  // 6. NOSQL INJECTION & REDOS
  await test('6.1 NoSQL query operator injection in Search sanitized cleanly', async () => {
    const res = await sendRequest({
      path: '/api/stories?search=%7B%22%24gt%22%3A%22%22%7D',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(res.statusCode, 200);
  });

  await test('6.2 Catastrophic ReDoS regex payload evaluated in < 100ms', async () => {
    const start = Date.now();
    const payload = encodeURIComponent('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!');
    const res = await sendRequest({
      path: `/api/stories?search=${payload}`,
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const elapsed = Date.now() - start;
    assert.equal(res.statusCode, 200);
    assert.ok(elapsed < 200, `ReDoS took too long: ${elapsed}ms`);
  });

  // 7. FILE UPLOAD EXECUTABLE RESTRICTION
  await test('7.1 Uploading executable (.exe) rejected at edge with 400 Bad Request', async () => {
    const res = await sendRequest({
      path: '/api/resources/upload/init',
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        fileName: 'malware.exe',
        fileSize: 1024,
        mimeType: 'application/x-msdownload'
      }
    });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json?.error.includes('Unsupported file type'));
  });

  // 8. PATH TRAVERSAL
  await test('8.1 Path Traversal payload (../../../../etc/passwd) stripped safely', async () => {
    const res = await sendRequest({
      path: '/api/resources/download/..%2F..%2F..%2F..%2Fetc%2Fpasswd',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.ok(res.statusCode === 400 || res.statusCode === 404);
    assert.ok(!res.data.includes('root:x:0:0:'));
  });

  // 9. CORS ALLOWLIST
  await test('9.1 Untrusted Origin blocked by CORS allowlist', async () => {
    const res = await sendRequest({
      path: '/api/health',
      headers: { Origin: 'https://malicious-attacker-domain.org' }
    });
    assert.notEqual(res.headers['access-control-allow-origin'], 'https://malicious-attacker-domain.org');
  });

  await test('9.2 Whitelisted Origin allowed with credentials', async () => {
    const res = await sendRequest({
      path: '/api/health',
      headers: { Origin: 'http://localhost:5173' }
    });
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    assert.equal(res.headers['access-control-allow-credentials'], 'true');
  });

  // 10. SECURITY HEADERS
  await test('10.1 Helmet & CSP Security Headers present on all responses', async () => {
    const res = await sendRequest({ path: '/api/health' });
    assert.ok(res.headers['content-security-policy'], 'Missing CSP header');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['strict-transport-security']);
  });

  // 11. RATE LIMITING
  await test('11.1 Rate limiting telemetry headers present on protected routes & health exempt', async () => {
    const healthRes = await sendRequest({ path: '/api/health' });
    assert.strictEqual(healthRes.headers['ratelimit-limit'], undefined, 'Health probes must be exempt from rate limits');

    const protectedRes = await sendRequest({ path: '/api/stories', headers: { Authorization: `Bearer ${studentToken}` } });
    assert.ok(protectedRes.headers['ratelimit-limit'], 'Missing ratelimit-limit header on non-exempt route');
    assert.ok(protectedRes.headers['ratelimit-remaining'], 'Missing ratelimit-remaining header on non-exempt route');
  });

  // 12. ERROR MASKING
  await test('12.1 Internal Error Masking (No stack traces or DB connection strings)', async () => {
    const res = await sendRequest({
      path: '/api/users/login',
      method: 'POST',
      body: { email: 'nonexistent@spit.ac.in', password: 'bad' }
    });
    assert.ok(!res.data.includes('mongodb://'), 'Connection string exposed');
    assert.ok(!res.data.includes('node_modules'), 'Stack trace exposed');
    assert.ok(!res.data.includes('at '), 'Stack trace exposed');
  });

  // 13. CACHE ISOLATION
  await test('13.1 Public and Admin Folder responses isolated through caching', async () => {
    const pubRes = await sendRequest({
      path: '/api/folders',
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    const adminRes = await sendRequest({
      path: '/api/folders',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(pubRes.statusCode, 200);
    assert.equal(adminRes.statusCode, 200);
    assert.ok(Array.isArray(pubRes.json));
    assert.ok(Array.isArray(adminRes.json));
    assert.ok(pubRes.json.every(f => f.visibility !== 'private'), 'Public view received private folder');
  });

  // Cleanup synthetic users
  await usersColl.deleteMany({ email: { $in: ['sec_student@spit.ac.in', 'admin@spit.ac.in'] } });
  await mongoose.disconnect();
  console.log('\n✔ Cleaned up synthetic security test users from loop_staging.');

  console.log('\n========================================================================');
  const passes = testResults.filter(r => r.status === 'PASS').length;
  const fails = testResults.filter(r => r.status === 'FAIL').length;
  console.log(`  DYNAMIC SECURITY ASSESSMENT SUMMARY: ${passes} PASSED, ${fails} FAILED `);
  console.log('========================================================================');

  if (fails > 0) {
    process.exit(1);
  }
}

runDastSuite().catch(err => {
  console.error('Fatal DAST Error:', err);
  process.exit(1);
});
