const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const COOKIE = 'tl_session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Changing the password (npm run set-password) changes this fingerprint and so
// invalidates every existing session.
function passwordFingerprint() {
  return crypto.createHash('sha256').update(config.passwordHash).digest('hex').slice(0, 16);
}

function issueSession(res) {
  const token = jwt.sign({ pv: passwordFingerprint() }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: config.cookieSameSite,
    secure: config.cookieSecure,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: config.cookieSameSite, secure: config.cookieSecure, path: '/' });
}

function isAuthenticated(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return false;
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    return payload.pv === passwordFingerprint();
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (!isAuthenticated(req)) return res.status(401).json({ error: 'Not logged in' });
  next();
}

module.exports = { issueSession, clearSession, isAuthenticated, requireAuth };
