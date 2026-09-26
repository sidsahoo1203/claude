const { TimeBlock } = require('../models');
const config = require('../config');
const time = require('../lib/time');

const BLOCK_POPULATE = [
  { path: 'category', select: 'name color archived' },
  { path: 'stopDoingItem', select: 'title status' },
];

function summarize(hours) {
  const count = (s) => hours.filter((h) => h.status === s).length;
  const logged = hours.filter((h) => h.block);
  const toward = logged.filter((h) => h.block.alignment === 'toward').length;
  const against = logged.filter((h) => h.block.alignment === 'against').length;
  const energySum = logged.reduce((sum, h) => sum + h.block.energy, 0);
  return {
    logged: logged.length,
    unaccounted: count('unaccounted'),
    open: count('open'),
    future: count('future'),
    toward,
    against,
    neutral: logged.length - toward - against,
    // Alignment % = hours logged "toward goal" / hours logged.
    alignmentPct: logged.length ? Math.round((toward / logged.length) * 100) : null,
    avgEnergy: logged.length ? Math.round((energySum / logged.length) * 10) / 10 : null,
  };
}

// Full 24-hour view of one day with a status for every hour.
async function getDay(date, at = time.now()) {
  const blocks = await TimeBlock.find({ date }).populate(BLOCK_POPULATE).lean();
  const byHour = new Map(blocks.map((b) => [b.hour, b]));
  const hours = [];
  for (let hour = 0; hour < 24; hour++) {
    const block = byHour.get(hour) || null;
    hours.push({
      hour,
      startsAt: time.hourStart(date, hour).toISO(),
      endsAt: time.hourEnd(date, hour).toISO(),
      logDeadline: time.logDeadline(date, hour).toISO(),
      status: time.hourStatus(date, hour, !!block, at),
      block,
    });
  }
  return { date, today: at.toISODate(), hours, summary: summarize(hours) };
}

// Every hour that can still be logged right now (may include hours from earlier days).
async function getOpenHours(at = time.now()) {
  const oldest = at.minus({ hours: 1 + config.logWindowHours }).toISODate();
  const out = [];
  for (const date of time.datesBetween(oldest, at.toISODate())) {
    const day = await getDay(date, at);
    for (const h of day.hours) if (h.status === 'open') out.push({ date, ...h });
  }
  return out;
}

module.exports = { getDay, getOpenHours, summarize, BLOCK_POPULATE };
