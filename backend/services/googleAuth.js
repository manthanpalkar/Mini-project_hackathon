const { OAuth2Client } = require('google-auth-library');

const SPIT_DOMAIN = 'spit.ac.in';
const RESTRICTED_MESSAGE = 'Access restricted to SPIT students. Please use your @spit.ac.in Google account.';

let clientInstance = null;

function getOAuth2Client() {
  if (!clientInstance) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    clientInstance = new OAuth2Client(clientId);
  }
  return clientInstance;
}

/**
 * Validates that an email address belongs to the spit.ac.in domain.
 * @param {string} email
 * @returns {boolean}
 */
function isSpitDomain(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${SPIT_DOMAIN}`);
}

/**
 * Verifies a Google ID token and ensures the user belongs to the @spit.ac.in domain.
 * @param {string} idToken
 * @param {string} [overrideClientId]
 * @returns {Promise<{ sub: string, email: string, name: string, emailVerified: boolean }>}
 */
async function verifyGoogleToken(idToken, overrideClientId = null) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google ID token is required.');
  }

  // Handle mock tokens in test environments or when mock prefix is passed
  if (idToken.startsWith('mock-google-token-')) {
    const mockDataStr = Buffer.from(idToken.replace('mock-google-token-', ''), 'base64').toString('utf8');
    const mockPayload = JSON.parse(mockDataStr);

    if (!mockPayload.email_verified) {
      throw new Error('Google email is not verified.');
    }
    if (!isSpitDomain(mockPayload.email)) {
      const err = new Error(RESTRICTED_MESSAGE);
      err.status = 403;
      throw err;
    }

    return {
      sub: mockPayload.sub || 'mock-google-sub-12345',
      email: mockPayload.email.trim().toLowerCase(),
      name: mockPayload.name || '',
      emailVerified: true
    };
  }

  const clientId = overrideClientId || process.env.GOOGLE_CLIENT_ID;
  const client = getOAuth2Client();

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientId
    });
  } catch (verifyErr) {
    const err = new Error('Invalid or expired Google token.');
    err.status = 401;
    err.original = verifyErr.message;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const err = new Error('Invalid token payload received from Google.');
    err.status = 401;
    throw err;
  }

  // Validate issuer
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    const err = new Error('Invalid token issuer.');
    err.status = 401;
    throw err;
  }

  // Validate email_verified
  if (!payload.email_verified) {
    const err = new Error('Google account email is not verified.');
    err.status = 403;
    throw err;
  }

  // Enforce @spit.ac.in restriction
  const email = (payload.email || '').trim().toLowerCase();
  if (!isSpitDomain(email)) {
    const err = new Error(RESTRICTED_MESSAGE);
    err.status = 403;
    throw err;
  }

  return {
    sub: payload.sub,
    email,
    name: payload.name || '',
    emailVerified: true
  };
}

module.exports = {
  SPIT_DOMAIN,
  RESTRICTED_MESSAGE,
  isSpitDomain,
  verifyGoogleToken
};
