// Analytics read models. Each one is pre-aggregated in MongoDB with a pipeline; JS only fills
// empty buckets so charts get a complete, evenly spaced axis.
const { TimeBlock, Category } = require('../models');
const time = require('../lib/time');
const { dailyStats, streaks } = require('./history');

const DATE_OF = { $dateFromString: { dateString: '$date', format: '%Y-%m-%d', timezone: 'UTC' } };

const BUCKET_EXPR = {
  day: '$date',
  week: {
    $dateToString: {
      format: '%Y-%m-%d',
      date: { $dateTrunc: { date: DATE_OF, unit: 'week', startOfWeek: 'monday', timezone: 'UTC' } },
    },
  },
  month: { $substrBytes: ['$date', 0, 7] },
};

function bucketKeys(period, from, to) {
  if (period === 'day') return time.datesBetween(from, to);
  if (period === 'week') {
    const keys = [];
    for (let d = time.weekStart(from); d <= to; d = time.addDays(d, 7)) keys.push(d);
    return keys;
  }
  const keys = [];
  let d = time.dayStart(from).startOf('month');
  const end = time.dayStart(to);
  while (d <= end) {
    keys.push(d.toFormat('yyyy-MM'));
    d = d.plus({ months: 1 });
  }
  return keys;
}

async function categoriesOverTime(period, from, to) {
  const rows = await TimeBlock.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $group: { _id: { bucket: BUCKET_EXPR[period], category: '$category' }, hours: { $sum: 1 } } },
  ]);
  const cats = await Category.find({ _id: { $in: [...new Set(rows.map((r) => String(r._id.category)))] } })
    .sort({ createdAt: 1 })
    .lean();
  const buckets = bucketKeys(period, from, to);
  const index = new Map(buckets.map((b, i) => [b, i]));
  const series = cats.map((c) => ({ category: { _id: c._id, name: c.name, color: c.color, archived: c.archived }, values: buckets.map(() => 0) }));
  const byCat = new Map(series.map((s) => [String(s.category._id), s]));
  for (const r of rows) {
    const s = byCat.get(String(r._id.category));
    const i = index.get(r._id.bucket);
    if (s && i !== undefined) s.values[i] = r.hours;
  }
  return { period, from, to, buckets, series };
}

async function heatmap(year, at = time.now()) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const days = await dailyStats(from, to, at);
  const tracked = days.filter((d) => d.state === 'past' || d.state === 'today');
  return {
    year,
    today: at.toISODate(),
    days: days.map((d) => ({
      date: d.date,
      state: d.state,
      logged: d.logged ?? null,
      alignmentPct: d.alignmentPct ?? null,
      unaccounted: d.unaccounted ?? null,
    })),
    totals: {
      logged: tracked.reduce((s, d) => s + d.logged, 0),
      unaccounted: tracked.reduce((s, d) => s + d.unaccounted, 0),
      trackedDays: tracked.length,
      fullDays: tracked.filter((d) => d.unaccounted === 0).length,
    },
  };
}

async function energyByHour(from, to) {
  const rows = await TimeBlock.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $group: { _id: '$hour', avg: { $avg: '$energy' }, count: { $sum: 1 } } },
  ]);
  const byHour = new Map(rows.map((r) => [r._id, r]));
  return {
    from,
    to,
    hours: Array.from({ length: 24 }, (_, hour) => {
      const r = byHour.get(hour);
      return { hour, avgEnergy: r ? Math.round(r.avg * 100) / 100 : null, count: r ? r.count : 0 };
    }),
  };
}

// Sleep per night from the "Sleep" category. A night runs noon→noon, so sleep that crosses
// midnight stays together. Positions are hours since midnight of the night's date (can exceed 24).
async function sleepPattern(from, to) {
  const sleep = await Category.findOne({ nameKey: 'sleep' }).lean();
  if (!sleep) return { from, to, category: null, nights: [] };
  const early = { $lt: ['$hour', 12] };
  const rows = await TimeBlock.aggregate([
    { $match: { category: sleep._id, date: { $gte: from, $lte: time.addDays(to, 1) } } },
    {
      $addFields: {
        night: {
          $cond: [early, { $dateToString: { format: '%Y-%m-%d', date: { $dateAdd: { startDate: DATE_OF, unit: 'day', amount: -1 } } } }, '$date'],
        },
        pos: { $cond: [early, { $add: ['$hour', 24] }, '$hour'] },
      },
    },
    { $match: { night: { $gte: from, $lte: to } } },
    { $group: { _id: '$night', hours: { $sum: 1 }, first: { $min: '$pos' }, last: { $max: '$pos' } } },
    { $sort: { _id: 1 } },
  ]);
  const byNight = new Map(rows.map((r) => [r._id, r]));
  return {
    from,
    to,
    category: { _id: sleep._id, name: sleep.name, color: sleep.color },
    nights: time.datesBetween(from, to).map((night) => {
      const r = byNight.get(night);
      return r
        ? { night, hours: r.hours, bedtime: r.first % 24, wake: (r.last + 1) % 24, start: r.first, end: r.last + 1 }
        : { night, hours: 0, bedtime: null, wake: null, start: null, end: null };
    }),
  };
}

async function weekCompare(a, b) {
  const aEnd = time.addDays(a, 6);
  const bEnd = time.addDays(b, 6);
  const inRange = (s, e) => ({ $and: [{ $gte: ['$date', s] }, { $lte: ['$date', e] }] });
  const rows = await TimeBlock.aggregate([
    { $match: { $or: [{ date: { $gte: a, $lte: aEnd } }, { date: { $gte: b, $lte: bEnd } }] } },
    {
      $group: {
        _id: '$category',
        a: { $sum: { $cond: [inRange(a, aEnd), 1, 0] } },
        b: { $sum: { $cond: [inRange(b, bEnd), 1, 0] } },
      },
    },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $unwind: '$cat' },
    { $sort: { 'cat.createdAt': 1 } },
  ]);
  return {
    a: { start: a, end: aEnd, total: rows.reduce((s, r) => s + r.a, 0) },
    b: { start: b, end: bEnd, total: rows.reduce((s, r) => s + r.b, 0) },
    categories: rows.map((r) => ({ _id: r._id, name: r.cat.name, color: r.cat.color, a: r.a, b: r.b, diff: r.a - r.b })),
  };
}

module.exports = { categoriesOverTime, heatmap, energyByHour, sleepPattern, weekCompare, streaks };
