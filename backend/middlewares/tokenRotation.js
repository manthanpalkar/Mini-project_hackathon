const crypto = require("crypto");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof secret !== "string" || secret.trim().length < 32) {
    throw new Error("JWT_SECRET environment variable is missing or less than 32 characters.");
  }
  return secret.trim();
}

function base64UrlEncode(str) {
  return Buffer.from(str).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function createToken(payload, expiresInSec = 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSec };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const secret = getJwtSecret();
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function verifyAndRotateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. No bearer token provided." });
  }

  const token = authHeader.split(" ")[1];
  const parts = token.split(".");
  if (parts.length !== 3) {
    return res.status(401).json({ error: "Invalid authorization token format." });
  }

  const [headerB64, payloadB64, signature] = parts;
  let secret;
  try {
    secret = getJwtSecret();
  } catch (err) {
    return res.status(500).json({ error: "Internal server authentication configuration error." });
  }

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expectedSig) {
    return res.status(401).json({ error: "Invalid authorization token signature." });
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      return res.status(401).json({ error: "Authorization token expired." });
    }

    req.user = payload;

    // Check expiration window (rotate if exp is within 5 minutes = 300 seconds)
    if (payload.exp && payload.exp - now < 300) {
      const refreshedToken = createToken({ id: payload.id, email: payload.email }, 3600);
      res.setHeader("X-Refreshed-Token", refreshedToken);
    }

    next();
  } catch {
    return res.status(401).json({ error: "Failed to parse authorization token payload." });
  }
}

module.exports = { verifyAndRotateToken, createToken, getJwtSecret };
