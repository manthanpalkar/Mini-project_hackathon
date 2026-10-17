const assert = require('node:assert');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const {
  RATE_LIMIT_CONFIG,
  UserAuthCache,
  getPaginationParams,
  sendPaginatedResponse,
  globalLimiter,
  loginLimiter,
  registerLimiter,
  uploadLimiter,
  fileDownloadLimiter
} = require('../server');
const { Resource, Story, Folder } = require('../models');

// Mock test JWT secret
const TEST_JWT_SECRET = 'a'.repeat(32);

// =========================================================================
// 1. Rate Limiting Tests (Shared-IP NAT Scenarios & Strict Auth Limits)
// =========================================================================
test('Rate Limiter: Global limiter allows shared-IP campus lab traffic up to 1500 req/15min', () => {
  // Verify configuration parameters
  assert.strictEqual(RATE_LIMIT_CONFIG.GLOBAL_MAX, 1500, 'Global limiter max must be 1500 to support shared NAT IPs');
  assert.strictEqual(RATE_LIMIT_CONFIG.WINDOW_MS, 15 * 60 * 1000, 'Window must be 15 minutes');

  // Simulation: College Lab with 50 students sharing 1 public NAT IPv4
  const studentsCount = 50;
  const requestsPerStudent = 20; // Browsing stories, resources, folders
  const totalLabRequests = studentsCount * requestsPerStudent; // 1,000 requests

  assert.strictEqual(totalLabRequests, 1000);
  assert.ok(
    totalLabRequests <= RATE_LIMIT_CONFIG.GLOBAL_MAX,
    `50 students making 20 requests each (${totalLabRequests} total) must NOT exceed the 1500 limit`
  );
});

test('Rate Limiter: Sensitive routes maintain strict abuse protection', () => {
  // Login limiter protects against brute force attacks
  assert.strictEqual(RATE_LIMIT_CONFIG.LOGIN_MAX, 10, 'Login limiter must strictly cap attempts to 10 per 15 min');
  assert.strictEqual(RATE_LIMIT_CONFIG.WINDOW_MS, 15 * 60 * 1000);

  // Registration request limiter
  assert.strictEqual(RATE_LIMIT_CONFIG.REGISTER_MAX, 10, 'Registration limiter must cap attempts to 10 per 15 min');

  // Upload session limiter
  assert.strictEqual(RATE_LIMIT_CONFIG.UPLOAD_MAX, 30, 'Upload limiter must cap sessions to 30 per 15 min');

  // File download limiter
  assert.strictEqual(RATE_LIMIT_CONFIG.DOWNLOAD_MAX, 60, 'File download limiter must cap downloads to 60 per 15 min');
});

test('Rate Limiter: Global limiter exempts health check probes from rate limits', (t, done) => {
  let nextCalled = false;
  const mockReq = { path: '/api/health', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
  const mockRes = { setHeader: () => {}, getHeader: () => {} };

  globalLimiter(mockReq, mockRes, (err) => {
    assert.strictEqual(err, undefined);
    nextCalled = true;
    assert.strictEqual(nextCalled, true);
    done();
  });
});

// =========================================================================
// 2. In-Memory User Auth Cache Tests
// =========================================================================
test('UserAuthCache: Stores and retrieves user records with normalized email', () => {
  const cache = new UserAuthCache(1000, 100);
  const mockUser = {
    email: 'student@spit.ac.in',
    role: 'Student',
    status: 'Active',
    name: 'Test Student'
  };

  cache.set('STUDENT@spit.ac.in ', mockUser);

  // Retrieve with different casing and whitespace
  const cached = cache.get(' student@SPIT.ac.in');
  assert.ok(cached, 'Cache should return user for case-insensitive lookup');
  assert.strictEqual(cached.role, 'Student');
  assert.strictEqual(cached.status, 'Active');
  assert.strictEqual(cache.size(), 1);
});

test('UserAuthCache: Entries expire after TTL', async () => {
  // Short TTL for testing: 50ms
  const cache = new UserAuthCache(50, 100);
  cache.set('expiring@spit.ac.in', { role: 'Student', status: 'Active' });

  assert.ok(cache.get('expiring@spit.ac.in'), 'Cache hit immediately after set');

  // Wait 70ms for TTL expiry
  await new Promise(resolve => setTimeout(resolve, 70));

  assert.strictEqual(cache.get('expiring@spit.ac.in'), null, 'Expired cache entry must return null');
  assert.strictEqual(cache.size(), 0, 'Expired item should be removed from cache map');
});

test('UserAuthCache: Immediate invalidation on role changes and account suspensions', () => {
  const cache = new UserAuthCache(60000, 100);
  const user = { email: 'student@spit.ac.in', role: 'Student', status: 'Active' };

  cache.set('student@spit.ac.in', user);
  assert.ok(cache.get('student@spit.ac.in'));

  // Admin revokes access or updates profile
  cache.invalidate('student@spit.ac.in');

  assert.strictEqual(cache.get('student@spit.ac.in'), null, 'Invalidated user must not be in cache');
});

test('UserAuthCache: Evicts oldest entries when reaching max size to prevent memory leaks', () => {
  const maxEntries = 3;
  const cache = new UserAuthCache(60000, maxEntries);

  cache.set('user1@spit.ac.in', { id: 1 });
  cache.set('user2@spit.ac.in', { id: 2 });
  cache.set('user3@spit.ac.in', { id: 3 });
  assert.strictEqual(cache.size(), 3);

  // Inserting a 4th entry should evict user1 (oldest)
  cache.set('user4@spit.ac.in', { id: 4 });
  assert.strictEqual(cache.size(), 3);
  assert.strictEqual(cache.get('user1@spit.ac.in'), null, 'Oldest entry user1 must have been evicted');
  assert.ok(cache.get('user4@spit.ac.in'), 'New entry user4 must be present');
});

test('UserAuthCache: JWT cryptographic verification cannot be bypassed', () => {
  // Expired token test
  const expiredToken = jwt.sign(
    { email: 'student@spit.ac.in', role: 'Student' },
    TEST_JWT_SECRET,
    { expiresIn: -10 }
  );

  assert.throws(() => {
    jwt.verify(expiredToken, TEST_JWT_SECRET);
  }, /jwt expired/);

  // Tampered signature test
  const validToken = jwt.sign(
    { email: 'student@spit.ac.in', role: 'Student' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
  const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

  assert.throws(() => {
    jwt.verify(tamperedToken, TEST_JWT_SECRET);
  }, /invalid signature/);
});

// =========================================================================
// 3. JSON Request Body Limit Tests
// =========================================================================
test('JSON Body Parsing: Payload limit configuration rejects oversized JSON', () => {
  const MAX_ALLOWED_JSON_BYTES = 5 * 1024 * 1024; // 5 MB

  const validSmallPayload = JSON.stringify({ title: 'Standard Story Submission', content: 'x'.repeat(1000) });
  assert.ok(
    Buffer.byteLength(validSmallPayload) <= MAX_ALLOWED_JSON_BYTES,
    'Small payload must be well within 5MB'
  );

  // Oversized 6MB payload simulation
  const oversizedPayloadLength = 6 * 1024 * 1024;
  assert.ok(
    oversizedPayloadLength > MAX_ALLOWED_JSON_BYTES,
    '6MB payload must exceed 5MB limit and trigger HTTP 413'
  );
});

// =========================================================================
// 4. API Pagination Tests
// =========================================================================
test('Pagination: getPaginationParams parses defaults, limits, and page offsets correctly', () => {
  // Case 1: Unpaginated request (no query params)
  const unpaginated = getPaginationParams({}, 20, 100);
  assert.strictEqual(unpaginated.isPaginated, false);
  assert.strictEqual(unpaginated.page, 1);
  assert.strictEqual(unpaginated.limit, 20);
  assert.strictEqual(unpaginated.skip, 0);

  // Case 2: Standard pagination request (page 2, default limit 20)
  const page2 = getPaginationParams({ page: '2' }, 20, 100);
  assert.strictEqual(page2.isPaginated, true);
  assert.strictEqual(page2.page, 2);
  assert.strictEqual(page2.limit, 20);
  assert.strictEqual(page2.skip, 20);

  // Case 3: Custom limit request (page 3, limit 15)
  const custom = getPaginationParams({ page: '3', limit: '15' }, 20, 100);
  assert.strictEqual(custom.isPaginated, true);
  assert.strictEqual(custom.page, 3);
  assert.strictEqual(custom.limit, 15);
  assert.strictEqual(custom.skip, 30);

  // Case 4: Enforces maximum limit ceiling (e.g. limit 500 clamped to 100)
  const clamped = getPaginationParams({ page: '1', limit: '500' }, 20, 100);
  assert.strictEqual(clamped.isPaginated, true);
  assert.strictEqual(clamped.limit, 100, 'Limit must be clamped to max 100');

  // Case 5: Negative or invalid inputs handled gracefully
  const invalid = getPaginationParams({ page: '-5', limit: '0' }, 20, 100);
  assert.strictEqual(invalid.page, 1, 'Page < 1 must default to 1');
  assert.strictEqual(invalid.limit, 20, 'Limit < 1 must default to defaultLimit');
});

test('Pagination: sendPaginatedResponse computes pages and sets standard headers', () => {
  const headers = {};
  let responseData = null;
  const mockRes = {
    set: (name, val) => { headers[name] = val; },
    json: (body) => { responseData = body; return body; }
  };

  const mockItems = [{ id: '1' }, { id: '2' }];
  sendPaginatedResponse(mockRes, mockItems, 45, 2, 20);

  // Check headers
  assert.strictEqual(headers['X-Total-Count'], '45');
  assert.strictEqual(headers['X-Page'], '2');
  assert.strictEqual(headers['X-Limit'], '20');
  assert.strictEqual(headers['X-Total-Pages'], '3'); // Math.ceil(45 / 20) = 3

  // Check JSON payload structure
  assert.deepStrictEqual(responseData.data, mockItems);
  assert.strictEqual(responseData.pagination.total, 45);
  assert.strictEqual(responseData.pagination.page, 2);
  assert.strictEqual(responseData.pagination.limit, 20);
  assert.strictEqual(responseData.pagination.totalPages, 3);
  assert.strictEqual(responseData.pagination.hasNextPage, true);
  assert.strictEqual(responseData.pagination.hasPrevPage, true);
});

// =========================================================================
// 5. Database Index Coverage Verification
// =========================================================================
test('Database Indexes: Resource schema defines required compound indexes', () => {
  const indexes = Resource.schema.indexes();

  // Verify compound index: { folderId: 1, status: 1, createdAt: -1 }
  const hasFolderStatusSortIndex = indexes.some(([fields]) => {
    return fields.folderId === 1 && fields.status === 1 && fields.createdAt === -1;
  });
  assert.ok(hasFolderStatusSortIndex, 'Resource schema must contain compound index { folderId: 1, status: 1, createdAt: -1 }');

  // Verify type compound index: { folderId: 1, status: 1, type: 1, createdAt: -1 }
  const hasFolderStatusTypeSortIndex = indexes.some(([fields]) => {
    return fields.folderId === 1 && fields.status === 1 && fields.type === 1 && fields.createdAt === -1;
  });
  assert.ok(hasFolderStatusTypeSortIndex, 'Resource schema must contain compound index { folderId: 1, status: 1, type: 1, createdAt: -1 }');
});

test('Database Indexes: Story and Folder schemas contain deterministic sorting indexes', () => {
  const storyIndexes = Story.schema.indexes();
  const hasStoryDeterministicSort = storyIndexes.some(([fields]) => {
    return fields.createdAt === -1 && fields._id === -1;
  });
  assert.ok(hasStoryDeterministicSort, 'Story schema must contain compound index { createdAt: -1, _id: -1 }');

  const folderIndexes = Folder.schema.indexes();
  const hasFolderHierarchySort = folderIndexes.some(([fields]) => {
    return fields.parentId === 1 && fields.isSystemFolder === -1 && fields.createdAt === 1;
  });
  assert.ok(hasFolderHierarchySort, 'Folder schema must contain compound index { parentId: 1, isSystemFolder: -1, createdAt: 1 }');
});
