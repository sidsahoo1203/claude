const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { IANAZone } = require('luxon');

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/timelog',
  tz: process.env.APP_TZ || 'Asia/Kolkata',
  logWindowHours: int('LOG_WINDOW_HOURS', 12),
  passwordHash: process.env.PASSWORD_HASH || '',
  jwtSecret: process.env.JWT_SECRET || '',
  // Comma-separated list of allowed browser origins (e.g. local dev + GitHub Pages).
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  // 'strict' when the client is served from the same site as the API; 'none' when it is hosted
  // elsewhere (e.g. GitHub Pages → API on another domain). 'none' always implies Secure.
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'strict').toLowerCase(),
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
};

if (!['strict', 'lax', 'none'].includes(config.cookieSameSite)) {
  throw new Error('COOKIE_SAMESITE must be strict, lax or none');
}
if (config.cookieSameSite === 'none') config.cookieSecure = true;

if (!IANAZone.isValidZone(config.tz)) {
  throw new Error(`APP_TZ "${config.tz}" is not a valid IANA time zone`);
}

module.exports = config;
