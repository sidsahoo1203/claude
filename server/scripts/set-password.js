#!/usr/bin/env node
// Hashes a new password with bcrypt and writes it to server/.env as PASSWORD_HASH.
// Also creates JWT_SECRET if missing. Existing sessions are invalidated.
// `npm run set-password -- --print` only prints the hash (for hosting dashboards).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const ENV_PATH = path.join(__dirname, '..', '.env');
const EXAMPLE_PATH = path.join(__dirname, '..', '.env.example');

function ask(question, hidden) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden && process.stdin.isTTY) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write('*');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    // Non-interactive: read from stdin (e.g. `echo secret | npm run set-password`)
    const data = fs.readFileSync(0, 'utf8');
    return data.split(/\r?\n/)[0];
  }
  const a = await ask('New password: ', true);
  const b = await ask('Repeat password: ', true);
  if (a !== b) throw new Error('Passwords do not match');
  return a;
}

function setVar(content, key, value) {
  const line = `${key}='${value}'`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  return re.test(content) ? content.replace(re, () => line) : `${content.replace(/\n?$/, '\n')}${line}\n`;
}

async function main() {
  const password = await readPassword();
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters');

  // --print: just output the hash (for a hosting dashboard's PASSWORD_HASH), don't touch .env.
  if (process.argv.includes('--print')) {
    console.log(`PASSWORD_HASH=${await bcrypt.hash(password, 12)}`);
    return;
  }

  let env = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, 'utf8')
    : fs.existsSync(EXAMPLE_PATH)
      ? fs.readFileSync(EXAMPLE_PATH, 'utf8')
      : '';

  env = setVar(env, 'PASSWORD_HASH', await bcrypt.hash(password, 12));
  if (!/^JWT_SECRET=['"]?[^'"\s]+/m.test(env)) {
    env = setVar(env, 'JWT_SECRET', crypto.randomBytes(48).toString('hex'));
  }
  fs.writeFileSync(ENV_PATH, env, { mode: 0o600 });
  console.log(`Password saved to ${ENV_PATH}. Restart the server; existing sessions are now logged out.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
