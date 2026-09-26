const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { seedDefaults } = require('./seed');

async function main() {
  if (!config.passwordHash || !config.jwtSecret) {
    console.warn('WARNING: PASSWORD_HASH / JWT_SECRET not set. Run `npm run set-password` in server/.');
  }
  await mongoose.connect(config.mongoUri);
  await mongoose.syncIndexes();
  if (await seedDefaults()) console.log('Seeded default categories');
  createApp().listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port} (tz ${config.tz}, log window ${config.logWindowHours}h)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
