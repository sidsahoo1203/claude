const { Category } = require('./models');

const DEFAULT_CATEGORIES = [
  { name: 'Deep work', color: '#7c5cff' },
  { name: 'Study', color: '#3fa7ff' },
  { name: 'Exercise', color: '#2ed47a' },
  { name: 'Sleep', color: '#5566aa' },
  { name: 'Social', color: '#ffb547' },
  { name: 'Entertainment', color: '#ff5c8a' },
  { name: 'Chores', color: '#9aa4b2' },
];

// Seeds default categories on first run only (never re-adds after the user has any).
async function seedDefaults() {
  const count = await Category.countDocuments();
  if (count > 0) return false;
  for (const c of DEFAULT_CATEGORIES) await Category.create(c);
  return true;
}

module.exports = { seedDefaults, DEFAULT_CATEGORIES };
