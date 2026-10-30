import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execute, nowIso, openDatabase, queryOne, type Database } from '../../db/index.js';
import { JobQueue } from './queue.js';
import { getJob, recoverStaleJobs, requestCancel } from './repository.js';
import { AppError } from '../../http/errors.js';

let db: Database;
let queue: JobQueue;
let workspaceId: string;

function seedWorkspace(database: Database): string {
  const id = crypto.randomUUID();
  database
    .prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)')
    .run(id, 'Test', nowIso());
  return id;
}

async function waitForStatus(
  database: Database,
  jobId: string,
  statuses: string[],
  timeoutMs = 8000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = queryOne<{ status: string }>(database, 'SELECT status FROM jobs WHERE id = ?', jobId);
    if (row && statuses.includes(row.status)) return row.status;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Job ${jobId} never reached ${statuses.join('/')}`);
}

beforeEach(() => {
  const dir = mkdtempSync(path.join(tmpdir(), 'sonicwire-queue-'));
  db = openDatabase(path.join(dir, 'queue.db'));
  workspaceId = seedWorkspace(db);
  queue = new JobQueue(db);
});

afterEach(async () => {
  await queue.stop();
  db.close();
});

describe('job queue', () => {
  it('runs a registered handler and records the result', async () => {
    queue.register('media.probe', async (ctx) => {
      ctx.progress(0.5, 'halfway');
      return { ok: true };
    });
    queue.start();
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: { assetId: 'a1' } });
    await waitForStatus(db, jobId, ['succeeded']);
    const job = getJob(db, workspaceId, jobId);
    expect(job?.status).toBe('succeeded');
    expect(job?.progress).toBe(1);
    expect(job?.result).toMatchObject({ ok: true });
    expect(job?.events?.some((event) => event.message === 'halfway')).toBe(true);
  });

  it('retries transient failures with backoff and eventually fails', async () => {
    let attempts = 0;
    queue.register('media.probe', async () => {
      attempts += 1;
      throw new AppError('upstream_failed', 'network hiccup');
    });
    queue.start();
    const jobId = queue.enqueue({
      workspaceId,
      kind: 'media.probe',
      payload: {},
      maxAttempts: 2,
    });
    await waitForStatus(db, jobId, ['failed'], 15000);
    expect(attempts).toBe(2);
    const job = getJob(db, workspaceId, jobId);
    expect(job?.errorCode).toBe('upstream_failed');
    expect(job?.attempts).toBe(2);
  });

  it('does not retry deterministic failures', async () => {
    let attempts = 0;
    queue.register('media.probe', async () => {
      attempts += 1;
      throw new AppError('unsupported_media', 'cannot decode');
    });
    queue.start();
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {}, maxAttempts: 5 });
    await waitForStatus(db, jobId, ['failed']);
    expect(attempts).toBe(1);
  });

  it('cancels a running job through the abort signal', async () => {
    queue.register('media.probe', async (ctx) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        ctx.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
      return {};
    });
    queue.start();
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {} });
    await waitForStatus(db, jobId, ['running']);
    requestCancel(db, workspaceId, jobId);
    queue.cancel(workspaceId, jobId);
    await waitForStatus(db, jobId, ['cancelled']);
    expect(getJob(db, workspaceId, jobId)?.status).toBe('cancelled');
  });

  it('cancels a queued job without running it', async () => {
    queue.register('media.probe', async () => ({ ran: true }));
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {} });
    requestCancel(db, workspaceId, jobId);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(getJob(db, workspaceId, jobId)?.status).toBe('cancelled');
  });

  it('recovers jobs whose worker lease expired', () => {
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {} });
    execute(
      db,
      `UPDATE jobs SET status = 'running', attempts = 1, lease_expires_at = ?, worker_id = 'ghost' WHERE id = ?`,
      new Date(Date.now() - 60_000).toISOString(),
      jobId,
    );
    const result = recoverStaleJobs(db);
    expect(result.requeued).toBe(1);
    expect(queryOne<{ status: string }>(db, 'SELECT status FROM jobs WHERE id = ?', jobId)?.status).toBe('queued');
  });

  it('fails jobs that exhausted retries when their worker died', () => {
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {}, maxAttempts: 1 });
    execute(
      db,
      `UPDATE jobs SET status = 'running', attempts = 1, lease_expires_at = ?, worker_id = 'ghost' WHERE id = ?`,
      new Date(Date.now() - 60_000).toISOString(),
      jobId,
    );
    const result = recoverStaleJobs(db);
    expect(result.failed).toBe(1);
    const job = getJob(db, workspaceId, jobId);
    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('worker_lost');
  });

  it('respects run_after scheduling', async () => {
    queue.register('media.probe', async () => ({ ran: true }));
    queue.start();
    const jobId = queue.enqueue({ workspaceId, kind: 'media.probe', payload: {}, runAfterMs: 400 });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(getJob(db, workspaceId, jobId)?.status).toBe('queued');
    await waitForStatus(db, jobId, ['succeeded'], 5000);
  });
});
