const { PlanEntry } = require('../models');

const PLAN_POPULATE = { path: 'category', select: 'name color archived' };

// Effective plan per "date#hour" (latest revision wins) for the given dates.
// Returns Map key -> { current: revision|null (null if cleared), revisions: [...] }.
async function plansFor(dates) {
  const revisions = await PlanEntry.find({ date: { $in: dates } })
    .sort({ createdAt: 1, _id: 1 })
    .populate(PLAN_POPULATE)
    .lean();
  const map = new Map();
  for (const r of revisions) {
    const key = `${r.date}#${r.hour}`;
    const entry = map.get(key) || { current: null, revisions: [] };
    entry.revisions.push(r);
    entry.current = r.cleared ? null : r;
    map.set(key, entry);
  }
  return map;
}

/**
 * Adherence of one hour: only decided once the hour is logged or unaccounted.
 *  hit     logged with the planned category
 *  miss    logged with another category, or unaccounted
 *  null    no plan, or not decided yet (future / still open)
 */
function adherence(plan, status, block) {
  if (!plan) return null;
  if (status === 'logged') return String(block.category._id || block.category) === String(plan.category._id || plan.category) ? 'hit' : 'miss';
  if (status === 'unaccounted') return 'miss';
  return null;
}

module.exports = { plansFor, adherence, PLAN_POPULATE };
