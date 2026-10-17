const assert = require("node:assert");
const test = require("node:test");
const { verifyAndRotateToken, createToken, getJwtSecret } = require("../middlewares/tokenRotation");

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
const VALID_TEST_SECRET = "a-very-secure-jwt-secret-that-exceeds-thirty-two-chars-2026";

test("JWT Secret Validation in tokenRotation: rejects missing, empty, or weak secret", () => {
  // Test missing secret
  delete process.env.JWT_SECRET;
  assert.throws(
    () => getJwtSecret(),
    /JWT_SECRET environment variable is missing or less than 32 characters/
  );

  // Test empty string
  process.env.JWT_SECRET = "   ";
  assert.throws(
    () => getJwtSecret(),
    /JWT_SECRET environment variable is missing or less than 32 characters/
  );

  // Test weak secret (< 32 chars)
  process.env.JWT_SECRET = "short_insecure_secret_123";
  assert.throws(
    () => getJwtSecret(),
    /JWT_SECRET environment variable is missing or less than 32 characters/
  );

  // Test valid secret (>= 32 chars)
  process.env.JWT_SECRET = VALID_TEST_SECRET;
  assert.strictEqual(getJwtSecret(), VALID_TEST_SECRET);
});

test("verifyAndRotateToken rejects requests without bearer token", () => {
  process.env.JWT_SECRET = VALID_TEST_SECRET;
  const req = { headers: {} };
  let statusCode = null;
  let jsonRes = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonRes = payload;
      return this;
    }
  };

  verifyAndRotateToken(req, res, () => {});
  assert.strictEqual(statusCode, 401);
  assert.ok(jsonRes.error.includes("No bearer token"));
});

test("verifyAndRotateToken rejects tokens with invalid signature", () => {
  process.env.JWT_SECRET = VALID_TEST_SECRET;
  const token = createToken({ id: "user123", email: "test@spit.ac.in" }, 3600);
  const tamperedToken = token.slice(0, -5) + "abcde";

  const req = { headers: { authorization: `Bearer ${tamperedToken}` } };
  let statusCode = null;
  let jsonRes = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonRes = payload;
      return this;
    }
  };

  verifyAndRotateToken(req, res, () => {});
  assert.strictEqual(statusCode, 401);
  assert.ok(jsonRes.error.includes("Invalid authorization token signature"));
});

test("verifyAndRotateToken allows valid token and rotates near-expiration token", () => {
  process.env.JWT_SECRET = VALID_TEST_SECRET;
  // Token expiring in 2 minutes (120 seconds)
  const token = createToken({ id: "user123", email: "test@spit.ac.in" }, 120);

  const req = { headers: { authorization: `Bearer ${token}` } };
  const headersSet = {};
  const res = {
    setHeader(key, val) {
      headersSet[key] = val;
    }
  };

  let nextCalled = false;
  verifyAndRotateToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.id, "user123");
  assert.ok(headersSet["X-Refreshed-Token"]);

  // Restore original environment
  if (ORIGINAL_JWT_SECRET) {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }
});
