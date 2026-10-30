import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Role, User, Workspace } from '@sonicwire/contracts';
import { config } from '../../config.js';
import { execute, newId, nowIso, queryOne, transaction, type Database } from '../../db/index.js';
import { conflict, unauthorized } from '../../http/errors.js';
import { seedWorkflowTemplates } from '../workflows/templates.js';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  if (!nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n > 1 << 20 || r > 32 || p > 16) return false; // reject absurd cost params
  const salt = Buffer.from(saltRaw, 'base64');
  const expected = Buffer.from(hashRaw, 'base64');
  const derived = scryptSync(password, salt, expected.length, { N: n, r, p });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
}

export function countUsers(db: Database): number {
  const row = queryOne<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users');
  return row?.n ?? 0;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
  };
}

export interface AuthContext {
  user: User;
  workspace: Workspace;
  sessionId: string;
  csrfToken: string;
  role: Role;
}

interface SessionJoinRow {
  session_id: string;
  csrf_token: string;
  expires_at: string;
  user_id: string;
  email: string;
  display_name: string;
  created_at: string;
  workspace_id: string;
  workspace_name: string;
  workspace_created_at: string;
  role: Role;
}

export interface CreatedSession {
  token: string;
  csrfToken: string;
  expiresAt: string;
  workspace: Workspace;
  user: User;
}

/** First-run bootstrap: creates the owner user plus their first workspace. */
export function createOwner(
  db: Database,
  input: { email: string; password: string; displayName: string; workspaceName: string },
): CreatedSession {
  return transaction(db, () => {
    if (countUsers(db) > 0) {
      throw conflict('SonicWire is already initialised');
    }
    const now = nowIso();
    const userId = newId();
    const workspaceId = newId();
    execute(
      db,
      'INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      userId,
      input.email,
      input.displayName,
      hashPassword(input.password),
      now,
    );
    execute(
      db,
      'INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)',
      workspaceId,
      input.workspaceName,
      now,
    );
    execute(
      db,
      `INSERT INTO memberships (user_id, workspace_id, role, created_at) VALUES (?, ?, 'owner', ?)`,
      userId,
      workspaceId,
      now,
    );
    seedWorkflowTemplates(db, workspaceId);
    return createSessionFor(db, userId, workspaceId, 'owner');
  });
}

export function authenticate(
  db: Database,
  email: string,
  password: string,
): { userId: string; workspaceId: string; role: Role } {
  const row = queryOne<UserRow & { password_hash: string }>(
    db,
    'SELECT * FROM users WHERE email = ?',
    email,
  );
  // Always run a hash comparison to keep timing uniform for unknown accounts.
  const stored = row?.password_hash ?? hashPassword('nonexistent-placeholder');
  const ok = verifyPassword(password, stored) && row !== null;
  if (!ok || !row) throw unauthorized('Email or password is incorrect');
  const membership = queryOne<{ workspace_id: string; role: Role }>(
    db,
    'SELECT workspace_id, role FROM memberships WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
    row.id,
  );
  if (!membership) throw unauthorized('Account has no workspace membership');
  return { userId: row.id, workspaceId: membership.workspace_id, role: membership.role };
}

export function createSessionFor(
  db: Database,
  userId: string,
  workspaceId: string,
  role: Role,
  userAgent?: string,
): CreatedSession {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + config.SESSION_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  execute(
    db,
    `INSERT INTO sessions (id, user_id, token_hash, csrf_token, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    userId,
    sha256(token),
    csrfToken,
    userAgent ?? null,
    createdAt.toISOString(),
    createdAt.toISOString(),
    expiresAt,
  );
  const user = queryOne<UserRow>(db, 'SELECT * FROM users WHERE id = ?', userId);
  const workspace = queryOne<{ id: string; name: string; created_at: string }>(
    db,
    'SELECT id, name, created_at FROM workspaces WHERE id = ?',
    workspaceId,
  );
  if (!user || !workspace) throw unauthorized('Session could not be created');
  return {
    token,
    csrfToken,
    expiresAt,
    user: toUser(user),
    workspace: { id: workspace.id, name: workspace.name, role, createdAt: workspace.created_at },
  };
}

export function resolveSession(db: Database, token: string): AuthContext | null {
  const row = queryOne<SessionJoinRow>(
    db,
    `SELECT s.id AS session_id, s.csrf_token, s.expires_at,
            u.id AS user_id, u.email, u.display_name, u.created_at,
            w.id AS workspace_id, w.name AS workspace_name, w.created_at AS workspace_created_at,
            m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN memberships m ON m.user_id = u.id
       JOIN workspaces w ON w.id = m.workspace_id
      WHERE s.token_hash = ?
      ORDER BY m.created_at ASC
      LIMIT 1`,
    sha256(token),
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    execute(db, 'DELETE FROM sessions WHERE id = ?', row.session_id);
    return null;
  }
  execute(db, 'UPDATE sessions SET last_seen_at = ? WHERE id = ?', nowIso(), row.session_id);
  return {
    user: {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      role: row.role,
      createdAt: row.workspace_created_at,
    },
    sessionId: row.session_id,
    csrfToken: row.csrf_token,
    role: row.role,
  };
}

export function deleteSession(db: Database, sessionId: string): void {
  execute(db, 'DELETE FROM sessions WHERE id = ?', sessionId);
}

export function purgeExpiredSessions(db: Database): number {
  return execute(db, 'DELETE FROM sessions WHERE expires_at < ?', nowIso());
}

export function recordLoginFailure(db: Database, email: string): void {
  // Audit trail for failed authentication attempts (no password material).
  execute(
    db,
    `INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, NULL, NULL, 'auth.login_failed', 'email', ?, NULL, ?)`,
    newId(),
    email,
    nowIso(),
  );
}
