# Domain map

The PRD names twelve domains. This table states, for each one, what is **implemented**,
what is **modelled but not executable**, and what is **absent by decision**. Nothing
in the UI claims more than the middle column allows.

| # | Domain | Implemented in this build | Modelled / policy | Absent (roadmap) |
| --- | --- | --- | --- | --- |
| 1 | **Discovery** | Library search (`q` across title + tag), filters by kind/status/source/collection, five sort orders, cursor pagination, tag cloud with counts, provider capability matrix as public discovery surface | Provider *content* search is declared `official-api`/`none` per provider and not executed | Cross-provider federated search, semantic search |
| 2 | **Media Intelligence** | FFprobe facts (container, codecs, profile, level, pixel format, bit rates, sample rate, channels, frame rate, rotation, colour metadata where present), per-stream table, bounded waveform peaks (≤ 1200), poster-frame thumbnail, quality fact flags | — | Perceptual quality metrics (VMAF/PSNR), scene detection, dialogue transcription |
| 3 | **Acquisition** | Streaming multipart upload with hash-while-writing; URL ingest through a validating fetcher (protocol allowlist, credential refusal, hostname blocklist, private-range refusal incl. IPv6 wrappers, redirect re-validation, pinned DNS, byte/time caps, throttling, hash verification, atomic rename); dedupe by SHA-256 | 12-provider policy matrix; `link-only` providers refuse ingest with the named restriction | OAuth connectors, scheduled pulls |
| 4 | **Transformation** | 9 FFmpeg presets with argument allowlists, optional trim, encoder-progress reporting, child-process group cancellation, derived-asset lineage, re-probe of every output | Preset catalogue exposed via `/api/system/capabilities` | Non-linear edit timelines, GPU encodes, AI upscaling |
| 5 | **Media Universe** | Assets, derivatives (`parentAssetId`), tags, collections, versions, stream table, storage accounting (media / derived / cache / free) | — | Collections sharing, rights windows, expiry |
| 6 | **Social** | Provider policy for 9 social/video platforms incl. publishing constraints and auditing requirements; `provider_connections` table with explicit status | Publish capability is declared per provider but **no publish action exists** | Actual publishing (blocked: credentials, audits) |
| 7 | **Creator Studio** | Inspector: player (range-streaming), waveform seek, stream facts, transform panel, derivative gallery, tag/collection editing, reprobe, delete, export | — | Timeline editing, captioning, colour grading |
| 8 | **Workflows** | Durable workflow definitions, 7 step types, per-step results with durations and messages, run history, seeded templates, child jobs | Approval gating modelled as `waiting_approval` job status | Visual workflow canvas, conditional branches |
| 9 | **Distributed Processing** | Worker pool (default 2, bounded 1–16), SQLite leases with heartbeat, stale-lease requeue, worker-loss detection, bounded retries with exponential backoff, per-job timeouts, cancellation of running and queued jobs, SSE progress | Lease + recovery semantics tested (`queue.test.ts`) | Multi-host workers, external queue |
| 10 | **Media Experience** | Range-request playback (206/416, ETag, `Accept-Ranges`), audio waveform seek, image preview, keyboard-accessible controls | — | HLS/DASH adaptive streaming, frame-accurate playback |
| 11 | **Collaboration** | Single-owner workspace with roles (`owner`/`editor`/`viewer`) in the schema, membership table, audit ledger attributing every mutation to an actor | Role capability list is enforced server-side for mutating routes | Multi-user invites, comments, review approvals |
| 12 | **Observatory** | Queue depth + 24 h outcomes, p50/p95 latency for probe and transform, storage breakdown, runtime facts (RSS, heap, uptime, node version, FFmpeg versions + encoders), audit log viewer, live SSE stream, diagnostics | — | Long-horizon metrics retention, alerting, tracing |

## Cross-cutting services

| Service | Where |
| --- | --- |
| Auth (scrypt, single owner, session cookie, CSRF) | `modules/auth`, `http/auth-plugin.ts` |
| Audit ledger | `modules/audit`, surfaced in observatory |
| Rate limiting | `@fastify/rate-limit` per route class |
| Realtime | `realtimeBus` → SSE `/api/events` |
| Storage | `modules/storage` (quarantine → media, exports, tmp; hash + size accounting) |
| Contracts | `packages/contracts` zod schemas shared by client and server |

## Domain boundary rules

1. A domain may not read another domain's tables directly; it goes through that
   module's exported functions (`getAssetRow`, `getWorkflow`, …).
2. Every job handler is registered in one place (`registerJobHandlers`) so the queue
   has a closed set of kinds and each kind has exactly one implementation.
3. Provider policy lives in `providers/registry.ts` only — no other module may decide
   whether a URL is fetchable.
