const { Category } = require('./models');

// Colours are the dataviz reference palette's dark-surface steps, in an order that passes the
// colour-blind-safety validator for adjacent series (charts stack categories in creation order).
const DEFAULT_CATEGORIES = [
  { name: 'Deep work', color: '#3987e5' },
  { name: 'Study', color: '#d95926' },
  { name: 'Exercise', color: '#199e70' },
  { name: 'Sleep', color: '#9085e9' },
  { name: 'Social', color: '#c98500' },
  { name: 'Entertainment', color: '#d55181' },
  { name: 'Chores', color: '#008300' },
];

// Seeds default categories on first run only (never re-adds after the user has any).
async function seedDefaults() {
  const count = await Category.countDocuments();
  if (count > 0) return false;
  for (const c of DEFAULT_CATEGORIES) await Category.create(c);
  return true;
}

module.exports = { seedDefaults, DEFAULT_CATEGORIES };
