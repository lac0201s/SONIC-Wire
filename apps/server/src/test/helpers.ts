import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { openDatabase, type Database } from '../db/index.js';
import { Storage } from '../modules/storage/storage.js';
import { JobQueue } from '../modules/jobs/queue.js';
import { registerJobHandlers } from '../modules/jobs/handlers.js';
import { buildApp } from '../http/app.js';
import { config } from '../config.js';

export interface TestContext {
  db: Database;
  storage: Storage;
  queue: JobQueue;
  app: FastifyInstance;
  dir: string;
}

export async function createTestContext(): Promise<TestContext> {
  const dir = mkdtempSync(path.join(tmpdir(), 'sonicwire-test-'));
  const storage = new Storage(dir);
  await storage.init();
  const db = openDatabase(path.join(dir, 'test.db'));
  const queue = new JobQueue(db);
  registerJobHandlers(queue, { db, storage, config });
  const app = await buildApp({ db, storage, queue, startedAt: Date.now() });
  await app.ready();
  return { db, storage, queue, app, dir };
}

export async function closeTestContext(context: TestContext): Promise<void> {
  await context.queue.stop();
  await context.app.close();
  context.db.close();
}

export interface AuthCookie {
  cookie: string;
  csrf: string;
}

export async function bootstrapOwner(
  context: TestContext,
  input: { email?: string; password?: string } = {},
): Promise<AuthCookie> {
  const response = await context.app.inject({
    method: 'POST',
    url: '/api/auth/setup',
    payload: {
      email: input.email ?? 'owner@test.local',
      password: input.password ?? 'correct-horse-battery',
      displayName: 'Test Owner',
      workspaceName: 'Test Workspace',
    },
  });
  if (response.statusCode !== 201) {
    throw new Error(`Setup failed: ${response.statusCode} ${response.body}`);
  }
  const setCookie = response.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookie = String(raw ?? '').split(';')[0] ?? '';
  const body = response.json() as { csrfToken: string };
  return { cookie, csrf: body.csrfToken };
}

export function authHeaders(auth: AuthCookie): Record<string, string> {
  return { cookie: auth.cookie, 'x-sonicwire-csrf': auth.csrf };
}
