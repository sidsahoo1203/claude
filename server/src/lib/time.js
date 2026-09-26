// All "what day / what hour is it" decisions go through this module.
// Day boundaries and hour blocks are in APP_TZ, never server-local time or UTC.
const { DateTime } = require('luxon');
const config = require('../config');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Tests replace the clock to exercise time rules deterministically.
let clock = () => Date.now();

function setClock(fn) {
  clock = fn || (() => Date.now());
}

function now() {
  return DateTime.fromMillis(clock(), { zone: config.tz });
}

function todayStr() {
  return now().toISODate();
}

function isValidDate(str) {
  return typeof str === 'string' && DATE_RE.test(str) && DateTime.fromISO(str, { zone: config.tz }).isValid;
}

function dayStart(date) {
  return DateTime.fromISO(date, { zone: config.tz }).startOf('day');
}

function addDays(date, n) {
  return dayStart(date).plus({ days: n }).toISODate();
}

function hourStart(date, hour) {
  return dayStart(date).set({ hour });
}

function hourEnd(date, hour) {
  return hourStart(date, hour).plus({ hours: 1 });
}

function logDeadline(date, hour) {
  return hourEnd(date, hour).plus({ hours: config.logWindowHours });
}

/**
 * Status of an hour block relative to now:
 *  logged       a block exists
 *  future       the hour has not finished yet (includes the hour in progress)
 *  open         finished, not logged, still inside the late-logging window
 *  unaccounted  not logged and the window has closed (permanent)
 */
function hourStatus(date, hour, hasBlock, at = now()) {
  if (hasBlock) return 'logged';
  if (at < hourEnd(date, hour)) return 'future';
  if (at < logDeadline(date, hour)) return 'open';
  return 'unaccounted';
}

// Weeks start on Monday.
function weekStart(date) {
  return dayStart(date).startOf('week').toISODate();
}

function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// Mongoose timestamp option: createdAt comes from the same (server) clock as everything else.
const createdOnly = { createdAt: true, updatedAt: false, currentTime: () => new Date(clock()) };

module.exports = {
  createdOnly,
  setClock,
  now,
  todayStr,
  isValidDate,
  dayStart,
  addDays,
  hourStart,
  hourEnd,
  logDeadline,
  hourStatus,
  weekStart,
  datesBetween,
};
