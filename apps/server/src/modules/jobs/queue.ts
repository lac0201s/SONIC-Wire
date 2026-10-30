import type { JobKind, JobStatus } from '@sonicwire/contracts';
import { config } from '../../config.js';
import {
  execute,
  newId,
  nowIso,
  queryOne,
  transaction,
  type Database,
} from '../../db/index.js';
import { logger } from '../../logger.js';
import { realtimeBus } from '../events/bus.js';
import { isAppError } from '../../http/errors.js';
import {
  appendJobEvent,
  getJobRow,
  recoverStaleJobs,
  setJobProgress,
  toJob,
  type JobRow,
} from './repository.js';

export interface JobContext {
  jobId: string;
  workspaceId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  signal: AbortSignal;
  progress: (value: number, message?: string) => void;
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;
  /** Marks the failure as non-retryable for the current attempt. */
  failFast: () => void;
}

export type JobHandler = (context: JobContext) => Promise<Record<string, unknown> | void>;

export interface EnqueueInput {
  workspaceId: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  priority?: number;
  parentJobId?: string | null;
  createdBy?: string | null;
  runAfterMs?: number;
  maxAttempts?: number;
}

interface ActiveJob {
  abort: AbortController;
  startedAt: number;
}

/**
 * Durable, lease-based job queue backed by SQLite.
 *
 * Guarantees:
 *  - a job is claimed by at most one worker (compare-and-swap on status),
 *  - crashed workers are recovered by lease expiry on boot,
 *  - cancellation is propagated through an AbortSignal into child processes,
 *  - retries are bounded with exponential backoff plus jitter,
 *  - every transition is observable through job_events and the realtime bus.
 */
export class JobQueue {
  private readonly db: Database;
  private readonly handlers = new Map<JobKind, JobHandler>();
  private readonly active = new Map<string, ActiveJob>();
  private readonly workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  private timers: NodeJS.Timeout[] = [];
  private heartbeat: NodeJS.Timeout | null = null;
  private running = false;

  constructor(db: Database) {
    this.db = db;
  }

  register(kind: JobKind, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  enqueue(input: EnqueueInput): string {
    const id = newId();
    const now = nowIso();
    const runAfter = new Date(Date.now() + (input.runAfterMs ?? 0)).toISOString();
    execute(
      this.db,
      `INSERT INTO jobs (
        id, workspace_id, kind, status, priority, payload, progress, attempts, max_attempts,
        run_after, created_by, parent_job_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'queued', ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
      id,
      input.workspaceId,
      input.kind,
      input.priority ?? 100,
      JSON.stringify(input.payload),
      input.maxAttempts ?? config.JOB_MAX_ATTEMPTS,
      runAfter,
      input.createdBy ?? null,
      input.parentJobId ?? null,
      now,
      now,
    );
    appendJobEvent(this.db, id, 'info', 'Job queued', { kind: input.kind });
    this.publish(id);
    return id;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const recovery = recoverStaleJobs(this.db);
    if (recovery.requeued || recovery.failed) {
      logger.warn(recovery, 'recovered jobs from a previous run');
    }
    for (let index = 0; index < config.JOB_WORKERS; index += 1) {
      const timer = setInterval(() => void this.tick(), 120);
      timer.unref();
      this.timers.push(timer);
    }
    this.heartbeat = setInterval(() => this.renewLeases(), Math.max(5000, (config.JOB_LEASE_SECONDS * 1000) / 3));
    this.heartbeat.unref();
    logger.info({ workers: config.JOB_WORKERS, workerId: this.workerId }, 'job queue started');
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const timer of this.timers) clearInterval(timer);
    this.timers = [];
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    for (const [jobId, active] of this.active) {
      active.abort.abort();
      logger.warn({ jobId }, 'aborting job during shutdown');
    }
    const deadline = Date.now() + 5000;
    while (this.active.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  get activeCount(): number {
    return this.active.size;
  }

  private publish(jobId: string): void {
    const row = getJobRowRaw(this.db, jobId);
    if (!row) return;
    realtimeBus.publish({ type: 'job.updated', job: toJob(row) });
  }

  private tick(): void {
    if (!this.running) return;
    if (this.active.size >= config.JOB_WORKERS) return;
    const claimed = this.claimNext();
    if (!claimed) return;
    void this.execute(claimed);
    // Keep draining while capacity remains.
    if (this.active.size < config.JOB_WORKERS) setImmediate(() => this.tick());
  }

  private claimNext(): JobRow | null {
    return transaction(this.db, () => {
      const candidate = queryOne<{ id: string }>(
        this.db,
        `SELECT id FROM jobs
          WHERE status = 'queued' AND cancel_requested = 0 AND run_after <= ?
          ORDER BY priority ASC, created_at ASC LIMIT 1`,
        nowIso(),
      );
      if (!candidate) return null;
      const now = nowIso();
      const lease = new Date(Date.now() + config.JOB_LEASE_SECONDS * 1000).toISOString();
      const changes = execute(
        this.db,
        `UPDATE jobs SET status = 'running', worker_id = ?, attempts = attempts + 1,
           started_at = COALESCE(started_at, ?), lease_expires_at = ?, updated_at = ?
         WHERE id = ? AND status = 'queued'`,
        this.workerId,
        now,
        lease,
        now,
        candidate.id,
      );
      if (changes === 0) return null;
      return getJobRowRaw(this.db, candidate.id);
    });
  }

  private renewLeases(): void {
    if (this.active.size === 0) return;
    const lease = new Date(Date.now() + config.JOB_LEASE_SECONDS * 1000).toISOString();
    for (const jobId of this.active.keys()) {
      execute(
        this.db,
        `UPDATE jobs SET lease_expires_at = ? WHERE id = ? AND status = 'running'`,
        lease,
        jobId,
      );
    }
  }

  private checkCancellation(jobId: string, controller: AbortController): void {
    const row = getJobRowRaw(this.db, jobId);
    if (row?.cancel_requested === 1 && !controller.signal.aborted) {
      controller.abort(new Error('cancelled'));
    }
  }

  private async execute(row: JobRow): Promise<void> {
    const handler = this.handlers.get(row.kind);
    const abort = new AbortController();
    this.active.set(row.id, { abort, startedAt: Date.now() });
    let failFast = false;
    const timeout = setTimeout(() => abort.abort(new Error('job timed out')), config.JOB_TIMEOUT_SECONDS * 1000);
    const cancelPoll = setInterval(() => this.checkCancellation(row.id, abort), 400);
    cancelPoll.unref();

    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    appendJobEvent(this.db, row.id, 'info', 'Job started', { attempt: row.attempts });
    this.publish(row.id);

    const progress = (value: number, message?: string) => {
      setJobProgress(this.db, row.id, value);
      if (message) appendJobEvent(this.db, row.id, 'info', message);
      this.publish(row.id);
    };

    const context: JobContext = {
      jobId: row.id,
      workspaceId: row.workspace_id,
      kind: row.kind,
      payload,
      signal: abort.signal,
      progress,
      log: (level, message, data) => {
        appendJobEvent(this.db, row.id, level, message, data ?? null);
        const event = { seq: 0, level, message, data: data ?? null, createdAt: nowIso() };
        realtimeBus.publish({ type: 'job.event', jobId: row.id, event });
      },
      failFast: () => {
        failFast = true;
      },
    };

    try {
      if (!handler) throw new Error(`No handler registered for job kind ${row.kind}`);
      const result = (await handler(context)) ?? {};
      execute(
        this.db,
        `UPDATE jobs SET status = 'succeeded', progress = 1, result = ?, finished_at = ?,
           lease_expires_at = NULL, error_code = NULL, error_message = NULL, updated_at = ?
         WHERE id = ?`,
        JSON.stringify(result),
        nowIso(),
        nowIso(),
        row.id,
      );
      appendJobEvent(this.db, row.id, 'info', 'Job succeeded', result);
    } catch (error) {
      const aborted = abort.signal.aborted;
      // Read the cancel flag fresh: the claimed row is a snapshot taken before
      // the operator could have requested cancellation.
      const currentRow = getJobRowRaw(this.db, row.id);
      const cancelled = aborted && (currentRow?.cancel_requested ?? 0) === 1;
      const timedOut = aborted && !cancelled;
      const message = error instanceof Error ? error.message : String(error);
      const code = isAppError(error) ? error.code : timedOut ? 'timeout' : 'internal';
      const attempts = row.attempts;
      // Only transient conditions are retried. Deterministic failures
      // (bad input, SSRF refusals, unsupported codecs, missing files) fail fast.
      const RETRYABLE_CODES = new Set(['internal', 'upstream_failed', 'rate_limited', 'provider_unavailable', 'timeout']);
      const retryable =
        !failFast &&
        !cancelled &&
        attempts < row.max_attempts &&
        RETRYABLE_CODES.has(code);

      if (cancelled) {
        execute(
          this.db,
          `UPDATE jobs SET status = 'cancelled', finished_at = ?, error_code = 'cancelled',
             error_message = 'Cancelled by user', lease_expires_at = NULL, updated_at = ? WHERE id = ?`,
          nowIso(),
          nowIso(),
          row.id,
        );
        appendJobEvent(this.db, row.id, 'warn', 'Job cancelled');
      } else if (retryable) {
        const delay = Math.min(60_000, 2 ** attempts * 1000) + Math.floor(Math.random() * 500);
        execute(
          this.db,
          `UPDATE jobs SET status = 'queued', run_after = ?, error_code = ?, error_message = ?,
             lease_expires_at = NULL, worker_id = NULL, progress = 0, updated_at = ? WHERE id = ?`,
          new Date(Date.now() + delay).toISOString(),
          code,
          message.slice(0, 1000),
          nowIso(),
          row.id,
        );
        appendJobEvent(
          this.db,
          row.id,
          'warn',
          `Attempt ${attempts} failed; retrying in ${Math.round(delay / 1000)}s`,
          { code, message },
        );
      } else {
        execute(
          this.db,
          `UPDATE jobs SET status = 'failed', finished_at = ?, error_code = ?, error_message = ?,
             lease_expires_at = NULL, updated_at = ? WHERE id = ?`,
          nowIso(),
          code,
          message.slice(0, 1000),
          nowIso(),
          row.id,
        );
        appendJobEvent(this.db, row.id, 'error', `Job failed: ${message}`, { code });
        logger.warn({ jobId: row.id, kind: row.kind, code, err: error }, 'job failed');
      }
    } finally {
      clearTimeout(timeout);
      clearInterval(cancelPoll);
      this.active.delete(row.id);
      this.publish(row.id);
    }
  }

  cancel(_workspaceId: string, jobId: string): boolean {
    const active = this.active.get(jobId);
    if (active) active.abort.abort(new Error('cancelled'));
    return true;
  }

  async drain(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.active.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  statusCounts(): Record<JobStatus, number> {
    const rows = this.db
      .prepare('SELECT status, COUNT(*) AS n FROM jobs GROUP BY status')
      .all() as { status: JobStatus; n: number }[];
    const counts: Record<JobStatus, number> = {
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      waiting_approval: 0,
    };
    for (const row of rows) counts[row.status] = row.n;
    return counts;
  }
}

function getJobRowRaw(db: Database, jobId: string): JobRow | null {
  return queryOne<JobRow>(db, 'SELECT * FROM jobs WHERE id = ?', jobId);
}
