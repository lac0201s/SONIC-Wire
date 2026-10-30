# Feature catalogue

Status legend: **Shipped** = reachable in the UI and covered by a test or a live
verification. **Server-only** = an API exists, no UI affordance yet. **Policy** =
declared behaviour with no execution path by design.

## Discovery & library

| ID | Feature | Status | Where | Evidence |
| --- | --- | --- | --- | --- |
| F-01 | Full-text search across title and tags | Shipped | `/app/library` search field, `/api/assets?q=` | `api.test.ts` filters/search test |
| F-02 | Filter by kind, status, source, collection | Shipped | Library toolbar chips | live: `?kind=video` returned 1 of 2 |
| F-03 | Sort by recent, oldest, title, size, duration | Shipped | Library sort select | contract test on `AssetQuerySchema` |
| F-04 | Cursor pagination (40 default, max 100) | Shipped | "Load more" in library | `AssetQuerySchema` bounds test |
| F-05 | Tag cloud with asset counts | Shipped | Library sidebar, `/api/tags` | live: 2 tags with counts |
| F-06 | List and grid presentation | Shipped | Library view toggle (persisted in Zustand) | component render test |
| F-07 | Command palette (`⌘K` / `Ctrl+K`) with keyboard navigation | Shipped | `CommandPalette` | arrow/enter/escape handling |
| F-08 | Empty states that explain the next action | Shipped | every route | `EmptyState` test |

## Acquisition

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-10 | Multipart upload with live progress and cancel | Shipped (`ImportPanel` → XHR `uploadFile`) | live upload of a 699 kB MP4 → 201 |
| F-11 | Hash-while-writing, dedupe by SHA-256 | Shipped | live re-upload returned `duplicate: true`, 200 |
| F-12 | MIME allowlist (audio/video/image) with 415 for anything else | Shipped | live `package.json` upload → 415 |
| F-13 | URL ingest with SSRF guard | Shipped | 8 live probes: loopback, localhost, link-local, `file:`, `::1`, `10.0.0.5`, `::ffff:127.0.0.1`, YouTube |
| F-14 | Redirect re-validation and DNS pinning | Shipped | `download.test.ts` redirect + loop tests |
| F-15 | Byte, time and rate caps on downloads | Shipped | `download.test.ts` cap/abort tests |
| F-16 | Provider policy refusal with a named restriction | Shipped | live YouTube ingest → 409 `provider_not_configured` |
| F-17 | URL ingest history and quota display | Shipped | Acquire page job list |

## Media intelligence

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-20 | Probe on upload, with retry and `missing` detection | Shipped | `pipeline.test.ts`, live probe |
| F-21 | Container/codec/dimension/bit-rate/duration facts | Shipped | live: `MP4 · video/mp4 · h264/aac · 640×360 · 3000 ms` |
| F-22 | Per-stream table | Shipped | inspector "Streams" panel |
| F-23 | Bounded waveform peaks (≤ 1200) | Shipped | live: 889 peaks for a 4 s file |
| F-24 | Poster-frame thumbnail | Shipped | live: 19,948-byte JPEG |
| F-25 | Reprobe action | Shipped | `/api/assets/:id/reprobe`, inspector button |
| F-26 | Range streaming (206 / 416 / ETag) | Shipped | live: `206`, `Content-Range: 0-1023/699016`, `416` |

## Transformation

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-30 | Nine presets across audio/video/image | Shipped | `pipeline.test.ts` preset validation |
| F-31 | Trim window with validation | Shipped | live 0–2000 ms trim → 2040 ms MP3 |
| F-32 | Encoder progress (0–1) surfaced on jobs | Shipped | SSE `job.updated` progress 0.02 → 0.97 |
| F-33 | Cancellation of a running encode (process group) | Shipped | `queue.test.ts` cancel-running |
| F-34 | Derived asset lineage and gallery | Shipped | inspector "Derived" list |
| F-35 | Every output re-probed before being marked ready | Shipped | `pipeline.ts` transform path |

## Media universe

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-40 | Tags: create on import, edit in inspector | Shipped | live tags `night`, `rushes` |
| F-41 | Collections: create, add assets, filter, delete | Shipped | live collection with 1 item |
| F-42 | Version counter on edit | Shipped | `PATCH /api/assets/:id` |
| F-43 | Delete with storage reclamation | Shipped | `DELETE /api/assets/:id` |
| F-44 | Bundle export (ZIP + JSON manifest, hashes verified) | Shipped | live export: 2 files, both SHA-256 matched |

## Workflows

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-50 | Create workflow with 1–12 typed steps | Shipped | live 5-step workflow |
| F-51 | Run against a ready asset with per-step results | Shipped | live run: 5/5 succeeded with durations |
| F-52 | Seed templates | Shipped | `seedWorkflowTemplates` on workspace create |
| F-53 | Run history | Shipped | Workflows page run list |
| F-54 | Step failure stops the run and reports which step | Shipped | handler wraps failures per step |

## Distributed processing

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-60 | Bounded worker pool (1–16) | Shipped | `JOB_WORKERS`, health check reports "0 active of 2 workers" |
| F-61 | Lease with heartbeat and stale requeue | Shipped | `queue.test.ts` recovery test |
| F-62 | Worker-loss detection | Shipped | `queue.test.ts` `worker_lost` |
| F-63 | Bounded retries with exponential backoff | Shipped | `queue.test.ts` retry test |
| F-64 | Deterministic errors are not retried | Shipped | `queue.test.ts` no-retry test |
| F-65 | Cancel queued and running jobs | Shipped | `queue.test.ts`, live cancel |
| F-66 | Scheduled start (`run_after`) | Shipped | `queue.test.ts` |
| F-67 | Live job stream (SSE) with heartbeat | Shipped | live: 12 events including progress ticks |

## Collaboration & governance

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-70 | Single-owner bootstrap with first-run detection | Shipped | live setup → 201, session cookie |
| F-71 | Login with rate limiting and audit of failures | Shipped | `service.test.ts` |
| F-72 | Owner password change (session-revalidating) | Shipped | `/api/auth/password` |
| F-73 | Break-glass owner reset CLI | Shipped | verified: hash rotated, sessions cleared, audit row written |
| F-74 | CSRF enforcement on every mutating route | Shipped | live: request without header → 403 |
| F-75 | Roles in schema, capability list per session | Shipped | session payload lists capabilities |
| F-76 | Audit ledger viewer | Shipped | Observatory audit table; 10+ actions recorded live |
| F-77 | Approvals (`waiting_approval` state) | Policy | job status exists, no approval action yet |

## Observatory

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-80 | Queue depth + 24 h outcome counters | Shipped | live: `failed24h 2, succeeded24h 5` |
| F-81 | p50/p95 latency for probe and transform | Shipped | live: probe 49/65 ms, transform 57/57 ms |
| F-82 | Storage breakdown + disk free | Shipped | live: 1.10 MB media, 49.6 kB derived, 19.5 GB free |
| F-83 | Runtime facts (RSS, heap, uptime, node, FFmpeg + encoders) | Shipped | `/api/observatory/summary` |
| F-84 | Diagnostics self-test | Shipped | `POST /api/system/diagnostics`, Settings button |
| F-85 | Health check with component detail | Shipped | `/api/health` |

## Settings & operations

| ID | Feature | Status | Evidence |
| --- | --- | --- | --- |
| F-90 | Workspace rename | Shipped | `PATCH /api/settings/workspace` |
| F-91 | Metadata export (JSON) | Server-only | `GET /api/settings/export-metadata` |
| F-92 | Purge with confirmation and count | Shipped | `POST /api/settings/purge` |
| F-93 | Provider catalogue + connect attempt with honest refusal | Shipped | live: 12 providers, 409 on connect |

## Deliberate omissions (not bugs)

Federated provider search, publishing, frame-accurate review comments, AI
transcription, multi-host workers, adaptive streaming. Each is in the roadmap with
the blocking dependency named.
