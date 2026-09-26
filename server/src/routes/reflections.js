const express = require('express');
const { Reflection } = require('../models');
const { wrap, notFound, conflict, forbidden, badRequest } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');
const config = require('../config');

const router = express.Router();

// A reflection can be written for today, or for yesterday until LOG_WINDOW_HOURS after midnight.
function writableDates(at = time.now()) {
  const today = at.toISODate();
  const yesterday = time.addDays(today, -1);
  const dates = [today];
  if (at < time.dayStart(today).plus({ hours: config.logWindowHours })) dates.unshift(yesterday);
  return dates;
}

router.get(
  '/open',
  wrap(async (req, res) => {
    const dates = writableDates();
    const existing = await Reflection.find({ date: { $in: dates } }, { date: 1 }).lean();
    const done = new Set(existing.map((r) => r.date));
    res.json(dates.map((date) => ({ date, written: done.has(date) })));
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const to = req.query.to ? v.date(req.query.to, 'to') : time.todayStr();
    const from = req.query.from ? v.date(req.query.from, 'from') : time.addDays(to, -30);
    if (from > to) throw badRequest('from must be before to');
    res.json(await Reflection.find({ date: { $gte: from, $lte: to } }).sort({ date: -1 }).lean());
  })
);

router.get(
  '/:date',
  wrap(async (req, res) => {
    const r = await Reflection.findOne({ date: v.date(req.params.date) }).lean();
    if (!r) throw notFound('No reflection for this date');
    res.json(r);
  })
);

// Append-only: one per date, locked on save.
router.post(
  '/',
  wrap(async (req, res) => {
    const date = v.date(req.body.date);
    const wentWell = v.str(req.body.wentWell, 'wentWell', { max: 2000 });
    const didntGoWell = v.str(req.body.didntGoWell, 'didntGoWell', { max: 2000 });
    const changeTomorrow = v.str(req.body.changeTomorrow, 'changeTomorrow', { max: 2000 });
    if (!writableDates().includes(date)) {
      throw forbidden('Reflections can only be written for today, or for yesterday within the logging window.');
    }
    if (await Reflection.exists({ date })) throw conflict('This day already has a reflection. You can add notes to it.');
    res.status(201).json(await Reflection.create({ date, wentWell, didntGoWell, changeTomorrow }));
  })
);

router.post(
  '/:date/notes',
  wrap(async (req, res) => {
    const date = v.date(req.params.date);
    const text = v.str(req.body && req.body.text, 'text', { max: 2000 });
    const r = await Reflection.findOneAndUpdate(
      { date },
      { $push: { notes: { text, createdAt: time.now().toJSDate() } } },
      { new: true }
    );
    if (!r) throw notFound('No reflection for this date');
    res.status(201).json(r);
  })
);

module.exports = router;
module.exports.writableDates = writableDates;
