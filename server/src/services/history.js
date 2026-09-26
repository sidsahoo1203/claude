const { TimeBlock, Category } = require('../models');
const time = require('../lib/time');

// Tracking starts on the date of the first logged hour. Days before it are "untracked"
// rather than 24 unaccounted hours.
async function firstTrackedDate() {
  const first = await TimeBlock.findOne({}, { date: 1 }).sort({ date: 1 }).lean();
  return first ? first.date : null;
}

// Per-day aggregates for [from, to] via one aggregation pipeline.
async function aggregateDays(from, to) {
  const rows = await TimeBlock.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { date: '$date', category: '$category' },
        n: { $sum: 1 },
        toward: { $sum: { $cond: [{ $eq: ['$alignment', 'toward'] }, 1, 0] } },
        against: { $sum: { $cond: [{ $eq: ['$alignment', 'against'] }, 1, 0] } },
        energy: { $sum: '$energy' },
        hours: { $push: '$hour' },
        relapses: { $sum: { $cond: [{ $ifNull: ['$stopDoingItem', false] }, 1, 0] } },
      },
    },
    { $sort: { '_id.date': 1, n: -1, '_id.category': 1 } },
    {
      $group: {
        _id: '$_id.date',
        logged: { $sum: '$n' },
        toward: { $sum: '$toward' },
        against: { $sum: '$against' },
        energySum: { $sum: '$energy' },
        relapses: { $sum: '$relapses' },
        hours: { $push: '$hours' },
        categories: { $push: { category: '$_id.category', hours: '$n' } },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    map.set(r._id, { ...r, hours: new Set(r.hours.flat()) });
  }
  return map;
}

function unaccountedFor(date, loggedHours, at) {
  let n = 0;
  for (let h = 0; h < 24; h++) {
    if (!loggedHours.has(h) && time.hourStatus(date, h, false, at) === 'unaccounted') n++;
  }
  return n;
}

// Stats for every date in [from, to] (inclusive), with unaccounted hours derived.
async function dailyStats(from, to, at = time.now()) {
  const [agg, firstDate, categories] = await Promise.all([
    aggregateDays(from, to),
    firstTrackedDate(),
    Category.find({}, { name: 1, color: 1 }).lean(),
  ]);
  const catById = new Map(categories.map((c) => [String(c._id), c]));
  const today = at.toISODate();
  return time.datesBetween(from, to).map((date) => {
    if (date > today) return { date, state: 'future' };
    if (!firstDate || date < firstDate) return { date, state: 'untracked' };
    const a = agg.get(date);
    const logged = a ? a.logged : 0;
    const top = a && a.categories[0];
    return {
      date,
      state: date === today ? 'today' : 'past',
      logged,
      unaccounted: unaccountedFor(date, a ? a.hours : new Set(), at),
      toward: a ? a.toward : 0,
      against: a ? a.against : 0,
      alignmentPct: logged ? Math.round((a.toward / logged) * 100) : null,
      avgEnergy: logged ? Math.round((a.energySum / logged) * 10) / 10 : null,
      relapses: a ? a.relapses : 0,
      dominant: top ? { ...catById.get(String(top.category)), hours: top.hours } : null,
      categories: a
        ? a.categories.map((c) => ({ ...catById.get(String(c.category)), hours: c.hours }))
        : [],
    };
  });
}

// Streak = consecutive days with zero unaccounted hours. Today counts while it has none so far.
async function streaks(at = time.now()) {
  const firstDate = await firstTrackedDate();
  const today = at.toISODate();
  if (!firstDate) return { current: 0, longest: 0, firstDate: null };
  const days = await dailyStats(firstDate, today, at);
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.unaccounted === 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return { current: run, longest, firstDate };
}

module.exports = { dailyStats, streaks, firstTrackedDate, aggregateDays };
