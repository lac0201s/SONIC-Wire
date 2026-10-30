# ADR-0003 — Durable job queue in SQLite with leases

**Status:** accepted · 2026-10-30

## Context

Probing, thumbnailing, waveform analysis, transforms, exports and workflow runs are
long, fallible operations. They must survive restarts, be cancellable, report real
progress, retry transient failures only, and never exceed configured concurrency.
The mandate requires bounded queues, concurrency, retries and cancellation.

## Decision

Implement the queue in `jobs`/`job_events` tables:

- Claim: `UPDATE … SET status='running', worker_id=?, lease_expires_at=? WHERE id = (
  SELECT id FROM jobs WHERE status='queued' AND run_after<=now ORDER BY priority DESC,
  run_after ASC LIMIT 1)` inside a transaction.
- Heartbeat extends the lease; an expired lease means the worker died → requeue
  (counted as an attempt) or fail as `worker_lost` when attempts are exhausted.
- Retry only `internal`, `upstream_failed`, `rate_limited`, `provider_unavailable`,
  `timeout`; deterministic failures (validation, unsupported media, forbidden) never
  retry.
- Cancellation sets `cancel_requested` and aborts an `AbortSignal`; handlers must
  honour it (FFmpeg runs are killed as a process group).
- Progress and log lines are appended to `job_events` and published on an in-process
  event bus → SSE.

## Alternatives

| Alternative | Why rejected |
| --- | --- |
| BullMQ + Redis | Best-in-class, but adds a second service and loses the transactional coupling between "job row" and "asset row". |
| `p-queue` (in-memory) | Jobs vanish on restart; the PRD explicitly requires durability and recovery. |
| OS cron + scripts | No progress, no cancellation, no lineage. |
| Temporal | Correct shape, vastly too much infrastructure for a single machine. |

## Consequences

- Exactly-once is not promised; at-least-once with idempotent handlers is. Transform
  handlers tolerate a retry because each attempt writes a fresh derivative and the
  stale one is cleaned up.
- Worker count is a hard bound (`JOB_WORKERS`, 1–16, default 2).
- Multi-host deployment is out of scope: the lease protocol assumes one SQLite file
  (roadmap Phase 6).
- The queue's cancellation path had a real bug (the cancel flag read from a stale
  pre-claim row); it is now re-read at failure time and covered by
  `queue.test.ts > cancels a running job through the abort signal`.
