const express = require('express');
const { Category, TimeBlock, PlanEntry, GoalEntry, StopDoingItem, Reflection, Letter } = require('../models');
const { wrap } = require('../lib/errors');
const config = require('../config');
const { DateTime } = require('luxon');
const time = require('../lib/time');

const router = express.Router();

function attachment(res, name, type) {
  res.setHeader('Content-Type', type);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Cache-Control', 'no-store');
}

// Everything, as JSON. Sealed letters are included without their body (it is never read
// from the database before unlocksAt); `npm run backup` captures them in full.
router.get(
  '/json',
  wrap(async (req, res) => {
    const now = time.now();
    const at = now.toJSDate();
    const [categories, timeBlocks, plans, goals, stopDoing, reflections, unlocked, sealed] = await Promise.all([
      Category.find().sort({ createdAt: 1 }).lean(),
      TimeBlock.find().sort({ date: 1, hour: 1 }).lean(),
      PlanEntry.find().sort({ date: 1, hour: 1, createdAt: 1 }).lean(),
      GoalEntry.find().sort({ createdAt: 1 }).lean(),
      StopDoingItem.find().sort({ createdAt: 1 }).lean(),
      Reflection.find().sort({ date: 1 }).lean(),
      Letter.find({ unlocksAt: { $lte: at } }).select('+body').lean(),
      Letter.find({ unlocksAt: { $gt: at } }).lean(),
    ]);
    const letters = [
      ...unlocked.map((l) => ({ ...l, sealed: false })),
      ...sealed.map((l) => ({ ...l, sealed: true })),
    ].sort((x, y) => x.createdAt - y.createdAt);
    attachment(res, `hourglass-export-${now.toISODate()}.json`, 'application/json; charset=utf-8');
    res.send(
      JSON.stringify(
        {
          exportedAt: now.toISO(),
          timezone: config.tz,
          logWindowHours: config.logWindowHours,
          counts: {
            categories: categories.length,
            timeBlocks: timeBlocks.length,
            planRevisions: plans.length,
            goalEntries: goals.length,
            stopDoingItems: stopDoing.length,
            reflections: reflections.length,
            letters: letters.length,
          },
          categories,
          timeBlocks,
          planRevisions: plans,
          goalEntries: goals,
          stopDoingItems: stopDoing,
          reflections,
          letters,
        },
        null,
        2
      )
    );
  })
);

// CSV cell: quoted, and prefixed if it could be read as a spreadsheet formula.
function cell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

router.get(
  '/blocks.csv',
  wrap(async (req, res) => {
    const blocks = await TimeBlock.find()
      .sort({ date: 1, hour: 1 })
      .populate({ path: 'category', select: 'name' })
      .populate({ path: 'stopDoingItem', select: 'title' })
      .lean();
    const fmt = (d) => DateTime.fromJSDate(d, { zone: config.tz }).toFormat("yyyy-MM-dd'T'HH:mm:ssZZ");
    const header = ['date', 'hour', 'start', 'end', 'activity', 'category', 'energy', 'alignment', 'stop_doing_relapse', 'logged_at', 'late_minutes', 'notes'];
    const lines = [header.join(',')];
    for (const b of blocks) {
      lines.push(
        [
          b.date,
          b.hour,
          fmt(b.startsAt),
          fmt(b.endsAt),
          b.activity,
          b.category ? b.category.name : '',
          b.energy,
          b.alignment,
          b.stopDoingItem ? b.stopDoingItem.title : '',
          fmt(b.loggedAt),
          b.lateMinutes,
          (b.notes || []).map((n) => `[${fmt(n.createdAt)}] ${n.text}`).join(' | '),
        ]
          .map(cell)
          .join(',')
      );
    }
    attachment(res, `hourglass-time-logs-${time.todayStr()}.csv`, 'text/csv; charset=utf-8');
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  })
);

module.exports = router;
