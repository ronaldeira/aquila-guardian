// auth.js — single-tenant session auth. The operator sets ADMIN_PASSWORD in .env;
// /api/auth/login trades the password for a session token stored in an HttpOnly cookie.
// Tokens live in memory only (no persistence needed — operator just re-logs in after
// a restart).

var crypto = require('crypto');

var SESSIONS = new Map();
var SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function issueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession() {
  var token = issueToken();
  SESSIONS.set(token, { createdAt: Date.now() });
  return token;
}

function destroySession(token) {
  if (token) SESSIONS.delete(token);
}

function isValid(token) {
  if (!token) return false;
  var session = SESSIONS.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    SESSIONS.delete(token);
    return false;
  }
  return true;
}

function extractToken(req) {
  // Prefer the HttpOnly cookie, fall back to X-Auth-Token for API clients
  var cookie = req.headers.cookie || '';
  var match = cookie.match(/aquila_session=([a-f0-9]+)/);
  if (match) return match[1];
  return req.headers['x-auth-token'] || '';
}

function requireAuth(req, res, next) {
  var token = extractToken(req);
  if (!isValid(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function isAuthenticated(req) {
  return isValid(extractToken(req));
}

// Verifies the raw password against ADMIN_PASSWORD env in constant time so we don't
// leak a timing oracle for short/long password guesses.
function checkPassword(raw) {
  var expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  if (raw.length !== expected.length) {
    // Still run the compare to keep timing steady — just against a dummy buffer
    crypto.timingSafeEqual(Buffer.from('x'), Buffer.from('x'));
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(raw), Buffer.from(expected));
  } catch (e) {
    return false;
  }
}

module.exports = {
  requireAuth: requireAuth,
  isAuthenticated: isAuthenticated,
  createSession: createSession,
  destroySession: destroySession,
  checkPassword: checkPassword,
  extractToken: extractToken
};
