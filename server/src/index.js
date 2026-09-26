const mongoose = require('mongoose');
const config = require('./config');
const { createApp } = require('./app');
const { seedDefaults } = require('./seed');

async function main() {
  if (!config.passwordHash || !config.jwtSecret) {
    console.warn('WARNING: PASSWORD_HASH / JWT_SECRET not set. Run `npm run set-password` in server/.');
  }
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    const safeUri = config.mongoUri.replace(/\/\/[^@/]*@/, '//***@');
    console.error(`\nCould not connect to MongoDB at ${safeUri} (${err.message}).`);
    console.error('Start a database first, then this server restarts automatically:');
    console.error('  • quickest (no install, works in Codespaces):  npm run db   (in another terminal)');
    console.error('  • or use MongoDB Atlas: set MONGODB_URI in server/.env\n');
    process.exit(1);
  }
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
