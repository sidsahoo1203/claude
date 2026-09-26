const mongoose = require('mongoose');
const { TimeBlock, Reflection, StopDoingItem } = require('../models');
const time = require('../lib/time');
const { dailyStats } = require('./history');
const { getDay } = require('./day');

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// Everything for one Monday–Sunday week on one page.
async function weeklyReview(anyDate, at = time.now()) {
  const start = time.weekStart(anyDate);
  const end = time.addDays(start, 6);
  const dates = time.datesBetween(start, end);

  const [days, dayViews, byCategory, relapseRows, reflections] = await Promise.all([
    dailyStats(start, end, at),
    Promise.all(dates.map((d) => (d <= at.toISODate() ? getDay(d, at) : null))),
    TimeBlock.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$category',
          hours: { $sum: 1 },
          toward: { $sum: { $cond: [{ $eq: ['$alignment', 'toward'] }, 1, 0] } },
          energySum: { $sum: '$energy' },
        },
      },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
      { $unwind: '$cat' },
      { $project: { _id: 1, hours: 1, toward: 1, energySum: 1, name: '$cat.name', color: '$cat.color', archived: '$cat.archived' } },
      { $sort: { hours: -1, name: 1 } },
    ]),
    TimeBlock.aggregate([
      { $match: { date: { $gte: start, $lte: end }, stopDoingItem: { $ne: null } } },
      { $sort: { startsAt: 1 } },
      { $group: { _id: '$stopDoingItem', count: { $sum: 1 }, blocks: { $push: { date: '$date', hour: '$hour', activity: '$activity' } } } },
    ]),
    Reflection.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean(),
  ]);

  const items = await StopDoingItem.find({ _id: { $in: relapseRows.map((r) => new mongoose.Types.ObjectId(r._id)) } }).lean();
  const itemById = new Map(items.map((i) => [String(i._id), i]));

  const tracked = days.filter((d) => d.state === 'past' || d.state === 'today');
  const logged = tracked.reduce((s, d) => s + d.logged, 0);
  const toward = tracked.reduce((s, d) => s + d.toward, 0);
  const energySum = tracked.reduce((s, d) => s + d.energySum, 0);
  const unaccounted = tracked.reduce((s, d) => s + d.unaccounted, 0);
  const summaries = dayViews.filter(Boolean).map((d) => d.summary);
  const planDecided = summaries.reduce((s, d) => s + d.planDecided, 0);
  const planHits = summaries.reduce((s, d) => s + d.planHits, 0);

  return {
    start,
    end,
    today: at.toISODate(),
    totals: {
      logged,
      unaccounted,
      alignmentPct: pct(toward, logged),
      adherencePct: pct(planHits, planDecided),
      planHits,
      planDecided,
      avgEnergy: logged ? Math.round((energySum / logged) * 10) / 10 : null,
      relapses: relapseRows.reduce((s, r) => s + r.count, 0),
      reflections: reflections.length,
    },
    categories: byCategory.map((c) => ({
      _id: c._id,
      name: c.name,
      color: c.color,
      archived: c.archived,
      hours: c.hours,
      alignmentPct: pct(c.toward, c.hours),
      avgEnergy: Math.round((c.energySum / c.hours) * 10) / 10,
    })),
    days: days.map((d, i) => ({
      ...d,
      adherencePct: dayViews[i] ? dayViews[i].summary.adherencePct : null,
      reflected: reflections.some((r) => r.date === d.date),
    })),
    relapses: relapseRows
      .map((r) => ({ item: itemById.get(String(r._id)) || null, count: r.count, blocks: r.blocks }))
      .sort((a, b) => b.count - a.count),
    reflections,
  };
}

module.exports = { weeklyReview };
