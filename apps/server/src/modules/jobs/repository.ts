import type { Job, JobEvent, JobKind, JobStatus } from '@sonicwire/contracts';
import {
  execute,
  newId,
  nowIso,
  parseJson,
  queryAll,
  queryOne,
  type Database,
} from '../../db/index.js';

export interface JobRow {
  id: string;
  workspace_id: string;
  kind: JobKind;
  status: JobStatus;
  priority: number;
  payload: string;
  result: string | null;
  progress: number;
  attempts: number;
  max_attempts: number;
  error_code: string | null;
  error_message: string | null;
  cancel_requested: number;
  worker_id: string | null;
  lease_expires_at: string | null;
  run_after: string;
  created_by: string | null;
  parent_job_id: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

interface JobEventRow {
  seq: number;
  level: JobEvent['level'];
  message: string;
  data: string | null;
  created_at: string;
}

export function toJob(row: JobRow, events?: JobEvent[]): Job {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    progress: Number(row.progress ?? 0),
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    priority: row.priority,
    payload: parseJson<Record<string, unknown>>(row.payload, {}),
    result: parseJson<Record<string, unknown> | null>(row.result, null),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    cancelRequested: row.cancel_requested === 1,
    parentJobId: row.parent_job_id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    ...(events ? { events } : {}),
  };
}

export function jobEvents(db: Database, jobId: string, limit = 100): JobEvent[] {
  return queryAll<JobEventRow>(
    db,
    'SELECT seq, level, message, data, created_at FROM job_events WHERE job_id = ? ORDER BY seq ASC LIMIT ?',
    jobId,
    limit,
  ).map((row) => ({
    seq: row.seq,
    level: row.level,
    message: row.message,
    data: parseJson<Record<string, unknown> | null>(row.data, null),
    createdAt: row.created_at,
  }));
}

export function getJobRow(db: Database, workspaceId: string, jobId: string): JobRow | null {
  return queryOne<JobRow>(
    db,
    'SELECT * FROM jobs WHERE id = ? AND workspace_id = ?',
    jobId,
    workspaceId,
  );
}

export function getJob(db: Database, workspaceId: string, jobId: string): Job | null {
  const row = getJobRow(db, workspaceId, jobId);
  return row ? toJob(row, jobEvents(db, jobId)) : null;
}

export function listJobs(
  db: Database,
  workspaceId: string,
  filters: { status?: JobStatus; kind?: JobKind; limit: number },
): Job[] {
  const where = ['workspace_id = ?'];
  const args: (string | number)[] = [workspaceId];
  if (filters.status) {
    where.push('status = ?');
    args.push(filters.status);
  }
  if (filters.kind) {
    where.push('kind = ?');
    args.push(filters.kind);
  }
  return queryAll<JobRow>(
    db,
    `SELECT * FROM jobs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`,
    ...args,
    filters.limit,
  ).map((row) => toJob(row));
}

export function appendJobEvent(
  db: Database,
  jobId: string,
  level: JobEvent['level'],
  message: string,
  data?: Record<string, unknown> | null,
): JobEvent {
  const row = queryOne<{ seq: number }>(
    db,
    'SELECT COALESCE(MAX(seq), 0) AS seq FROM job_events WHERE job_id = ?',
    jobId,
  );
  const seq = (row?.seq ?? 0) + 1;
  const createdAt = nowIso();
  execute(
    db,
    'INSERT INTO job_events (id, job_id, seq, level, message, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    newId(),
    jobId,
    seq,
    level,
    message.slice(0, 2000),
    data ? JSON.stringify(data) : null,
    createdAt,
  );
  return {
    seq,
    level,
    message: message.slice(0, 2000),
    data: data ?? null,
    createdAt,
  };
}

export function setJobProgress(db: Database, jobId: string, progress: number): void {
  execute(
    db,
    'UPDATE jobs SET progress = ?, updated_at = ? WHERE id = ?',
    Math.max(0, Math.min(1, progress)),
    nowIso(),
    jobId,
  );
}

export function requestCancel(db: Database, workspaceId: string, jobId: string): JobRow | null {
  const row = getJobRow(db, workspaceId, jobId);
  if (!row) return null;
  if (row.status === 'succeeded' || row.status === 'failed' || row.status === 'cancelled') return row;
  execute(
    db,
    'UPDATE jobs SET cancel_requested = 1, updated_at = ? WHERE id = ?',
    nowIso(),
    jobId,
  );
  // A queued job never runs; a running job is aborted by its worker.
  execute(
    db,
    `UPDATE jobs SET status = 'cancelled', finished_at = ?, updated_at = ?
      WHERE id = ? AND status = 'queued'`,
    nowIso(),
    nowIso(),
    jobId,
  );
  return getJobRow(db, workspaceId, jobId);
}

export function recoverStaleJobs(db: Database): { requeued: number; failed: number } {
  const now = nowIso();
  const stale = queryAll<JobRow>(
    db,
    `SELECT * FROM jobs WHERE status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < ?)`,
    now,
  );
  let requeued = 0;
  let failed = 0;
  for (const job of stale) {
    if (job.cancel_requested === 1) {
      execute(
        db,
        `UPDATE jobs SET status = 'cancelled', finished_at = ?, error_code = 'cancelled',
         error_message = 'Cancelled while the worker was offline', updated_at = ? WHERE id = ?`,
        now,
        now,
        job.id,
      );
      failed += 1;
    } else if (job.attempts >= job.max_attempts) {
      execute(
        db,
        `UPDATE jobs SET status = 'failed', finished_at = ?, error_code = 'worker_lost',
         error_message = 'Worker stopped before the job completed and retries were exhausted', updated_at = ? WHERE id = ?`,
        now,
        now,
        job.id,
      );
      failed += 1;
    } else {
      execute(
        db,
        `UPDATE jobs SET status = 'queued', worker_id = NULL, lease_expires_at = NULL, run_after = ?, updated_at = ? WHERE id = ?`,
        now,
        now,
        job.id,
      );
      requeued += 1;
    }
  }
  return { requeued, failed };
}

export function jobMetrics(db: Database, workspaceId: string): {
  queue: { queued: number; running: number; failed24h: number; succeeded24h: number; cancelled24h: number };
  durations: { kind: string; startedAt: string; finishedAt: string }[];
} {
  const count = (status: JobStatus): number =>
    queryOne<{ n: number }>(
      db,
      'SELECT COUNT(*) AS n FROM jobs WHERE workspace_id = ? AND status = ?',
      workspaceId,
      status,
    )?.n ?? 0;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const sinceCount = (status: JobStatus): number =>
    queryOne<{ n: number }>(
      db,
      'SELECT COUNT(*) AS n FROM jobs WHERE workspace_id = ? AND status = ? AND COALESCE(finished_at, updated_at) >= ?',
      workspaceId,
      status,
      since,
    )?.n ?? 0;

  const durations = queryAll<{ kind: string; started_at: string; finished_at: string }>(
    db,
    `SELECT kind, started_at, finished_at FROM jobs
      WHERE workspace_id = ? AND status = 'succeeded' AND finished_at >= ? AND started_at IS NOT NULL
      ORDER BY finished_at DESC LIMIT 500`,
    workspaceId,
    since,
  ).map((row) => ({ kind: row.kind, startedAt: row.started_at, finishedAt: row.finished_at }));

  return {
    queue: {
      queued: count('queued'),
      running: count('running'),
      failed24h: sinceCount('failed'),
      succeeded24h: sinceCount('succeeded'),
      cancelled24h: sinceCount('cancelled'),
    },
    durations,
  };
}
