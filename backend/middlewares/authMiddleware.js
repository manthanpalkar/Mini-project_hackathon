const jwt = require('jsonwebtoken');

function getSecret() {
  return process.env.JWT_SECRET || 'spit_loop_super_secret_jwt_key_2026_production_grade_32chars';
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Access token is required. Please login.', code: 'TOKEN_MISSING' });
  }

  try {
    const decoded = jwt.verify(token, getSecret());
    const email = (decoded.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ error: 'User session invalid. Email claim missing.', code: 'INVALID_TOKEN' });
    }

    req.user = {
      id: decoded.id || decoded.userId || decoded._id,
      _id: decoded.id || decoded.userId || decoded._id,
      email,
      name: decoded.name || email.split('@')[0],
      role: decoded.role || 'Student',
      status: decoded.status || 'Active'
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Session expired or token invalid. Please sign in again.',
      code: 'TOKEN_EXPIRED'
    });
  }
}

function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, getSecret());
    const email = (decoded.email || '').toLowerCase().trim();
    req.user = {
      id: decoded.id || decoded.userId || decoded._id,
      _id: decoded.id || decoded.userId || decoded._id,
      email,
      name: decoded.name || email.split('@')[0],
      role: decoded.role || 'Student',
      status: decoded.status || 'Active'
    };
  } catch (_) {
    req.user = null;
  }
  next();
}

module.exports = {
  authenticateToken,
  optionalAuthenticateToken
};
