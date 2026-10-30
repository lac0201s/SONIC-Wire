import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../../db/index.js';
import {
  authenticate,
  countUsers,
  createOwner,
  createSessionFor,
  deleteSession,
  hashPassword,
  purgeExpiredSessions,
  resolveSession,
  verifyPassword,
} from './service.js';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('password hashing', () => {
  it('verifies the correct password only', () => {
    const stored = hashPassword('correct-horse-battery');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('correct-horse-battery', stored)).toBe(true);
    expect(verifyPassword('correct-horse-batterY', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
  });

  it('produces a unique salt per hash', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'));
  });

  it('rejects malformed stored hashes without throwing', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$16384$8$1$missing')).toBe(false);
    expect(verifyPassword('x', 'scrypt$999999999$8$1$c2FsdA==$aGFzaA==')).toBe(false);
  });
});

describe('owner bootstrap and sessions', () => {
  it('creates exactly one owner and a workspace', () => {
    const session = createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    expect(countUsers(db)).toBe(1);
    expect(session.workspace.role).toBe('owner');
    expect(session.token.length).toBeGreaterThan(20);
    expect(() =>
      createOwner(db, {
        email: 'second@example.com',
        password: 'another-password',
        displayName: 'Two',
        workspaceName: 'Other',
      }),
    ).toThrowError();
  });

  it('authenticates a known user and refuses a wrong password', () => {
    createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    const identity = authenticate(db, 'owner@example.com', 'a-long-password');
    expect(identity.role).toBe('owner');
    expect(() => authenticate(db, 'owner@example.com', 'wrong-password')).toThrowError();
    expect(() => authenticate(db, 'nobody@example.com', 'a-long-password')).toThrowError();
  });

  it('resolves a session token and ignores unknown tokens', () => {
    const created = createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    const resolved = resolveSession(db, created.token);
    expect(resolved?.user.email).toBe('owner@example.com');
    expect(resolved?.workspace.name).toBe('Studio');
    expect(resolveSession(db, 'not-a-real-token')).toBeNull();
  });

  it('invalidates deleted sessions', () => {
    const created = createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    const resolved = resolveSession(db, created.token);
    expect(resolved).not.toBeNull();
    deleteSession(db, resolved!.sessionId);
    expect(resolveSession(db, created.token)).toBeNull();
  });

  it('purges expired sessions', () => {
    const created = createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    const resolved = resolveSession(db, created.token);
    db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').run(
      new Date(Date.now() - 1000).toISOString(),
      resolved!.sessionId,
    );
    expect(resolveSession(db, created.token)).toBeNull();
    purgeExpiredSessions(db);
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
    expect(remaining.n).toBe(0);
  });

  it('creates an isolated database file per installation', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sonicwire-auth-'));
    const fileDb = openDatabase(path.join(dir, 'db.sqlite'));
    expect(countUsers(fileDb)).toBe(0);
    fileDb.close();
  });

  it('issues a fresh csrf token per session', () => {
    const first = createOwner(db, {
      email: 'owner@example.com',
      password: 'a-long-password',
      displayName: 'Owner',
      workspaceName: 'Studio',
    });
    const second = createSessionFor(db, first.user.id, first.workspace.id, 'owner');
    expect(second.csrfToken).not.toBe(first.csrfToken);
    expect(second.token).not.toBe(first.token);
  });
});
