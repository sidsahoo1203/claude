const { GoalEntry, Reflection } = require('../models');
const time = require('../lib/time');
const { getDay } = require('./day');
const { streaks } = require('./history');

async function latestGoals() {
  const [goal, contribution] = await Promise.all(
    ['goal', 'contribution'].map((kind) => GoalEntry.findOne({ kind }).sort({ createdAt: -1, _id: -1 }).lean())
  );
  return { goal, contribution };
}

async function dashboard(at = time.now()) {
  const [goals, day, streak, reflected] = await Promise.all([
    latestGoals(),
    getDay(at.toISODate(), at),
    streaks(at),
    Reflection.exists({ date: at.toISODate() }),
  ]);
  return { ...goals, today: { date: day.date, ...day.summary, reflected: !!reflected }, streak };
}

module.exports = { dashboard, latestGoals };
