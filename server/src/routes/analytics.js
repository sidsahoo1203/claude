const express = require('express');
const { wrap, badRequest } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');
const a = require('../services/analytics');

const router = express.Router();

// Resolves ?from&to with a default look-back window ending today (APP_TZ).
function range(req, defaultDays) {
  const today = time.todayStr();
  const to = req.query.to ? v.date(req.query.to, 'to') : today;
  const from = req.query.from ? v.date(req.query.from, 'from') : time.addDays(to, -(defaultDays - 1));
  if (from > to) throw badRequest('from must be before to');
  if (time.dayStart(to).diff(time.dayStart(from), 'days').days > 3660) throw badRequest('range is too large');
  return { from, to };
}

const DEFAULT_LOOKBACK = { day: 14, week: 12 * 7, month: 365 };

router.get(
  '/categories',
  wrap(async (req, res) => {
    const period = v.oneOf(req.query.period || 'week', 'period', ['day', 'week', 'month']);
    const { from, to } = range(req, DEFAULT_LOOKBACK[period]);
    res.json(await a.categoriesOverTime(period, from, to));
  })
);

router.get(
  '/heatmap',
  wrap(async (req, res) => {
    const year = req.query.year ? v.intIn(req.query.year, 'year', 2000, 2100) : time.now().year;
    res.json(await a.heatmap(year));
  })
);

router.get(
  '/energy-by-hour',
  wrap(async (req, res) => {
    const { from, to } = range(req, 90);
    res.json(await a.energyByHour(from, to));
  })
);

router.get(
  '/sleep',
  wrap(async (req, res) => {
    const { from, to } = range(req, 30);
    res.json(await a.sleepPattern(from, to));
  })
);

router.get(
  '/week-compare',
  wrap(async (req, res) => {
    const thisWeek = time.weekStart(time.todayStr());
    const wa = time.weekStart(req.query.a ? v.date(req.query.a, 'a') : thisWeek);
    const wb = time.weekStart(req.query.b ? v.date(req.query.b, 'b') : time.addDays(wa, -7));
    res.json(await a.weekCompare(wa, wb));
  })
);

router.get(
  '/streaks',
  wrap(async (req, res) => {
    res.json(await a.streaks());
  })
);

module.exports = router;
