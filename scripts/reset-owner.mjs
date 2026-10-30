#!/usr/bin/env node
/**
 * Owner password recovery for a local installation.
 *
 * There is no remote reset by design: recovery requires filesystem access to the
 * database, which is the same privilege as reading the media. The script prints the
 * new temporary password exactly once and records the reset in the audit log.
 *
 * Usage:
 *   node --experimental-sqlite scripts/reset-owner.mjs [--data-dir ./var] [--email a@b.c]
 *
 * Requires Node 22.5+ for `node:sqlite`, and the API should be stopped first so the
 * session cache cannot resurrect a stale session.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const dataDir = path.resolve(readArg('--data-dir', process.env.DATA_DIR ?? './var'));
const email = readArg('--email', null);
const dbPath = path.join(dataDir, 'sonicwire.db');

if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Pass --data-dir <dir> or set DATA_DIR.`);
  process.exit(1);
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

const hashPassword = (password) => {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
};

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

const owner = email
  ? db.prepare('SELECT id, email FROM users WHERE email = ?').get(email)
  : db.prepare('SELECT id, email FROM users ORDER BY created_at LIMIT 1').get();

if (!owner) {
  console.error(email ? `No user with email ${email}.` : 'No users in this database.');
  db.close();
  process.exit(1);
}

const temporary = randomBytes(9).toString('base64url');
const now = new Date().toISOString();

db.exec('BEGIN');
try {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(temporary), owner.id);
  // Every existing session is invalidated: a reset must not leave a live login behind.
  const removed = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(owner.id);
  const membership = db
    .prepare('SELECT workspace_id FROM memberships WHERE user_id = ? LIMIT 1')
    .get(owner.id);
  db.prepare(
    `INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, 'auth.owner_reset', 'user', ?, ?, ?)`,
  ).run(
    randomBytes(16).toString('hex'),
    membership?.workspace_id ?? null,
    owner.id,
    owner.id,
    JSON.stringify({ sessionsRevoked: Number(removed.changes) }),
    now,
  );
  db.exec('COMMIT');
  console.log(`Owner: ${owner.email}`);
  console.log(`Temporary password: ${temporary}`);
  console.log(`Sessions revoked: ${Number(removed.changes)}`);
  console.log('Sign in and change this password immediately. The reset is in the audit log.');
} catch (error) {
  db.exec('ROLLBACK');
  console.error('Reset failed:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
