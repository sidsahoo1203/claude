#!/usr/bin/env node
// Local MongoDB for development with nothing to install (handy in GitHub Codespaces).
// Runs a real mongod (downloaded once by mongodb-memory-server) on 127.0.0.1:27017 and keeps
// the data on disk in .mongo-data/, so it survives restarts. Stop with Ctrl+C.
const path = require('path');
const fs = require('fs');
const net = require('net');
const { MongoMemoryServer } = require('mongodb-memory-server');

const PORT = Number(process.env.DEV_DB_PORT || 27017);
const dbPath = path.join(__dirname, '..', '..', '.mongo-data');

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function main() {
  if (await portInUse(PORT)) {
    console.log(`Something is already listening on 127.0.0.1:${PORT} (probably MongoDB). Nothing to do.`);
    return;
  }
  fs.mkdirSync(dbPath, { recursive: true });
  console.log('Starting MongoDB (the first run downloads it, ~100 MB)…');
  const server = await MongoMemoryServer.create({
    instance: { port: PORT, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
  });
  console.log(`MongoDB ready at mongodb://127.0.0.1:${PORT} (data in .mongo-data/). Leave this running; Ctrl+C to stop.`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    // doCleanup: false keeps the data directory.
    await server.stop({ doCleanup: false, force: false });
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('Could not start the dev database:', err.message);
  process.exit(1);
});
