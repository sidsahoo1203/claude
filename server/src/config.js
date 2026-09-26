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
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  cookieSecure: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production',
};

if (!IANAZone.isValidZone(config.tz)) {
  throw new Error(`APP_TZ "${config.tz}" is not a valid IANA time zone`);
}

module.exports = config;
