const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { DateTime } = require('luxon');
const { createApp } = require('../src/app');
const time = require('../src/lib/time');
const { seedDefaults } = require('../src/seed');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.syncIndexes();
}

async function stopDb() {
  time.setClock(null);
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

// Wipes the database directly (bypassing the app's no-delete rules) between tests.
async function resetDb() {
  await mongoose.connection.db.dropDatabase();
  await mongoose.syncIndexes();
  await seedDefaults();
}

// Freeze the server clock at a wall-clock time in Asia/Kolkata, e.g. '2026-09-26T10:30'.
function setIST(iso) {
  const ms = DateTime.fromISO(iso, { zone: 'Asia/Kolkata' }).toMillis();
  time.setClock(() => ms);
}

async function loggedInAgent() {
  const app = createApp();
  const agent = request.agent(app).set('X-Requested-With', 'hourglass');
  const res = await agent.post('/api/auth/login').send({ password: process.env.TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return agent;
}

async function categoryId(agent, name = 'Deep work') {
  const res = await agent.get('/api/categories');
  return res.body.find((c) => c.name === name)._id;
}

module.exports = { startDb, stopDb, resetDb, setIST, loggedInAgent, categoryId };
