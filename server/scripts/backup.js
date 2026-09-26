#!/usr/bin/env node
// Full database backup with mongodump into backups/<timestamp in APP_TZ>/.
// Requires MongoDB Database Tools (mongodump) on PATH.
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { DateTime } = require('luxon');
const config = require('../src/config');

const root = path.join(__dirname, '..', '..', 'backups');
const stamp = DateTime.now().setZone(config.tz).toFormat("yyyy-MM-dd_HH-mm-ss");
const out = path.join(root, stamp);

const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['mongodump'], { encoding: 'utf8' });
if (which.status !== 0) {
  console.error(
    'mongodump not found. Install MongoDB Database Tools:\n' +
      '  https://www.mongodb.com/docs/database-tools/installation/\n' +
      '  macOS: brew install mongodb-database-tools   Ubuntu: apt install mongodb-database-tools'
  );
  process.exit(1);
}

fs.mkdirSync(root, { recursive: true });
console.log(`Backing up to ${out}`);
// The URI is passed as an argument, not printed, so credentials don't end up in logs.
const res = spawnSync('mongodump', [`--uri=${config.mongoUri}`, `--out=${out}`, '--quiet'], { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('mongodump failed');
  process.exit(res.status || 1);
}
console.log(`Backup complete: backups/${stamp}`);
