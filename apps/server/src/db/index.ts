import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrations } from './schema.js';

export type Database = DatabaseSync;
export type SqlValue = string | number | null | bigint | Uint8Array;

export function nowIso(): string {
  return new Date().toISOString();
}

export function openDatabase(file: string): Database {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  migrate(db);
  return db;
}

export function migrate(db: Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );`);
  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map((r) => r.id),
  );
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
        migration.id,
        nowIso(),
      );
      db.exec('COMMIT;');
    } catch (error) {
      db.exec('ROLLBACK;');
      throw new Error(`Migration ${migration.id} failed: ${(error as Error).message}`);
    }
  }
}

/**
 * Runs `fn` inside an immediate transaction. Nested calls reuse the outer
 * transaction so repository helpers compose safely.
 */
let depth = 0;
export function transaction<T>(db: Database, fn: () => T): T {
  if (depth > 0) return fn();
  db.exec('BEGIN IMMEDIATE;');
  depth += 1;
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  } finally {
    depth -= 1;
  }
}

export function queryAll<T>(db: Database, sql: string, ...params: SqlValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function queryOne<T>(db: Database, sql: string, ...params: SqlValue[]): T | null {
  const row = db.prepare(sql).get(...params);
  return (row as unknown as T | undefined) ?? null;
}

export function execute(db: Database, sql: string, ...params: SqlValue[]): number {
  const info = db.prepare(sql).run(...params);
  return Number(info.changes);
}

export function newId(): string {
  return randomUUID();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
