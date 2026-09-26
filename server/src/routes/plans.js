const express = require('express');
const { PlanEntry, Category } = require('../models');
const { wrap, badRequest, forbidden } = require('../lib/errors');
const v = require('../lib/validate');
const time = require('../lib/time');
const { plansFor, PLAN_POPULATE } = require('../services/plans');

const router = express.Router();

router.get(
  '/:date',
  wrap(async (req, res) => {
    const date = v.date(req.params.date);
    const plans = await plansFor([date]);
    const at = time.now();
    const hours = [];
    for (let hour = 0; hour < 24; hour++) {
      const p = plans.get(`${date}#${hour}`);
      hours.push({
        hour,
        startsAt: time.hourStart(date, hour).toISO(),
        locked: at >= time.hourStart(date, hour),
        plan: p ? p.current : null,
        revisions: p ? p.revisions : [],
      });
    }
    res.json({ date, today: at.toISODate(), editable: plannableDates(at), hours });
  })
);

function plannableDates(at) {
  const today = at.toISODate();
  return [today, time.addDays(today, 1)];
}

// Validates one plan revision against the rules: today/tomorrow only, hour not started,
// category active. Returns the document to insert.
async function buildRevision(body, date, at) {
  const hour = v.intIn(body.hour, 'hour', 0, 23);
  const startsAt = time.hourStart(date, hour);
  if (at >= startsAt) throw forbidden(`${String(hour).padStart(2, '0')}:00 has already started; its plan is locked.`);
  if (body.cleared === true) return { date, hour, startsAt: startsAt.toJSDate(), cleared: true };
  const activity = v.str(body.activity, 'activity', { max: 500, optional: true });
  const categoryId = v.objectId(body.category, 'category');
  const category = await Category.findById(categoryId).lean();
  if (!category) throw badRequest('Category not found');
  if (category.archived) throw badRequest('Archived categories cannot be used for new plans');
  return { date, hour, startsAt: startsAt.toJSDate(), activity, category: category._id };
}

function checkDate(date, at) {
  if (!plannableDates(at).includes(date)) throw forbidden('You can only plan today and tomorrow.');
}

// Append-only: each call adds a new revision; nothing is overwritten.
router.post(
  '/',
  wrap(async (req, res) => {
    const at = time.now();
    const date = v.date(req.body.date);
    checkDate(date, at);
    const doc = await buildRevision(req.body, date, at);
    const created = await PlanEntry.create(doc);
    res.status(201).json(await PlanEntry.findById(created._id).populate(PLAN_POPULATE).lean());
  })
);

// Same plan for several hours at once: { date, hours: [..], activity, category } or { date, hours, cleared: true }.
router.post(
  '/bulk',
  wrap(async (req, res) => {
    const at = time.now();
    const date = v.date(req.body.date);
    checkDate(date, at);
    const hours = req.body.hours;
    if (!Array.isArray(hours) || hours.length === 0 || hours.length > 24) throw badRequest('hours must be a list of 1-24 hours');
    if (new Set(hours).size !== hours.length) throw badRequest('hours must not repeat');
    const docs = [];
    for (const hour of hours) docs.push(await buildRevision({ ...req.body, hour }, date, at));
    const created = await PlanEntry.insertMany(docs);
    res.status(201).json({ created: created.length });
  })
);

module.exports = router;
