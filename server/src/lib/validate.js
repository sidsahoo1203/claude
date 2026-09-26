const mongoose = require('mongoose');
const time = require('./time');
const { badRequest } = require('./errors');

function str(value, field, { min = 1, max = 500, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return '';
    throw badRequest(`${field} is required`);
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be text`);
  const v = value.trim();
  if (v.length < min) throw badRequest(`${field} is required`);
  if (v.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return v;
}

function intIn(value, field, lo, hi) {
  const n = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < lo || n > hi) throw badRequest(`${field} must be a whole number from ${lo} to ${hi}`);
  return n;
}

function oneOf(value, field, options) {
  if (!options.includes(value)) throw badRequest(`${field} must be one of: ${options.join(', ')}`);
  return value;
}

function date(value, field = 'date') {
  if (!time.isValidDate(value)) throw badRequest(`${field} must be a date like YYYY-MM-DD`);
  return value;
}

function objectId(value, field, { optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw badRequest(`${field} is required`);
  }
  if (!mongoose.isValidObjectId(value)) throw badRequest(`${field} is not a valid id`);
  return value;
}

module.exports = { str, intIn, oneOf, date, objectId };
