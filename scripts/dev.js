#!/usr/bin/env node
// `npm run dev`: starts the local database, the API and the web client together, with labelled
// output. Ctrl+C stops all three. Skips the local database when server/.env points elsewhere
// (e.g. Atlas) or one is already running.
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');

const root = path.join(__dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmIn = (dir, script) => ['--prefix', dir, 'run', '--silent', script];
const COLORS = { db: 35, api: 36, web: 33, dev: 32 };
const children = [];

function log(tag, line) {
  process.stdout.write(`\x1b[${COLORS[tag]}m[${tag}]\x1b[0m ${line}\n`);
}

function fail(msg) {
  log('dev', `\x1b[31m${msg}\x1b[0m`);
  if (children.length) stop(1);
  else process.exit(1);
}

function readEnv() {
  const file = path.join(root, 'server', '.env');
  if (!fs.existsSync(file)) return null;
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

async function waitForPort(port, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

const isWin = process.platform === 'win32';

// Each child gets its own process group so stop() can signal npm *and* what it started.
function run(tag, args) {
  const child = spawn(npm, args, {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '1' },
    detached: !isWin,
    shell: isWin,
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach((l) => log(tag, l));
    });
  }
  child.on('exit', (code) => {
    if (!stopping) {
      log(tag, `exited (${code}). Stopping everything.`);
      stop(code || 1);
    }
  });
  return child;
}

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try {
      if (isWin) c.kill('SIGINT');
      else process.kill(-c.pid, 'SIGINT');
    } catch {
      // already gone
    }
  }
  // mongod needs a moment to shut down cleanly; give everything up to 10s.
  setTimeout(() => process.exit(code), 10000).unref();
  Promise.all(children.map((c) => (c.exitCode === null ? new Promise((r) => c.on('exit', r)) : null))).then(() =>
    process.exit(code)
  );
}
// Safety net: never leave a database or server running behind us.
process.on('exit', () => {
  for (const c of children) {
    if (c.exitCode !== null) continue;
    try {
      if (isWin) c.kill();
      else process.kill(-c.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
});
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

async function main() {
  for (const dir of ['server', 'client']) {
    if (!fs.existsSync(path.join(root, dir, 'node_modules'))) fail('Dependencies missing. Run: npm run install:all');
  }
  const env = readEnv();
  if (!env || !env.PASSWORD_HASH) {
    fail('No password set yet. Run: npm run set-password   (then npm run dev again)');
  }

  const uri = env.MONGODB_URI || 'mongodb://localhost:27017/timelog';
  const localDb = /\/\/(localhost|127\.0\.0\.1)(:27017)?\//.test(uri);
  if (localDb) {
    if (await portOpen(27017)) {
      log('dev', 'MongoDB already running on 27017.');
    } else {
      run('db', npmIn('server', 'db'));
      log('dev', 'Waiting for MongoDB (first run downloads it, can take a minute)…');
      if (!(await waitForPort(27017, 180000))) fail('MongoDB did not start within 3 minutes.');
    }
  } else {
    log('dev', 'Using the remote database from server/.env.');
  }

  run('api', npmIn('server', 'dev'));
  run('web', npmIn('client', 'dev'));
  const apiPort = Number(env.PORT || 4000);
  if ((await waitForPort(apiPort, 60000)) && (await waitForPort(5173, 60000))) {
    log('dev', '\x1b[1mReady → http://localhost:5173\x1b[0m  (in Codespaces: Ports tab → 5173). Ctrl+C stops everything.');
  }
}

main().catch((e) => fail(e.message));
