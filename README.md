# SonicWire

**Universal media intelligence and creation environment.** Local-first, single-owner,
no fabricated integrations: every number in the interface comes from a file that was
actually probed, a job that actually ran, or a provider policy that was actually read.

```
┌────────────────────────────┐        ┌──────────────────────────────────────────┐
│ apps/web — Vite + React 19 │  /api  │ apps/server — Fastify 5 + node:sqlite    │
│ marketing site  (/)        │ ─────▶ │ media pipeline ─▶ bundled FFmpeg/FFprobe │
│ console      (/app/*)      │        │ durable job queue, SSE, audit ledger      │
└────────────────────────────┘        └────────────────┬─────────────────────────┘
                     packages/contracts — zod schemas   │ HTTP (internal)
                                                        ▼
                                      ┌──────────────────────────────────────┐
                                      │ services/media-core — Python/FastAPI │
                                      │ loudness · silence · black frames ·  │
                                      │ scene cuts · decode health · peaks   │
                                      └──────────────────────────────────────┘
```

## What it does

| Domain | Implemented behaviour |
| --- | --- |
| Discovery / Acquisition | Upload with streaming hash verification, or ingest an authorized public URL through an SSRF-guarded, redirect-revalidating fetcher with byte/time caps and cancellation. |
| Media intelligence | FFprobe facts (container, codecs, dimensions, bit rates, duration, frame rates), bounded waveform peaks, poster-frame thumbnails, per-stream tables. Deep measurements in a second process: EBU R128 loudness, true peak, silence spans, black frames, scene cuts, decode health and a peak envelope. |
| Transformation | Nine FFmpeg presets (MP3/FLAC/WAV/Opus audio, 1080p/720p/MP4-remux/video-audio-strip, JPEG resize) with optional trimming, progress from the encoder, and process-group cancellation. |
| Media universe | Tags, collections, derived-asset lineage (`parentAssetId`), version counters, content-addressed dedupe by SHA-256. |
| Workflows | Durable multi-step runs (probe → thumbnail → waveform → transform → export) with per-step results, retries and a run history. |
| Distributed processing | Worker pool with SQLite leases, heartbeat recovery, bounded retries with backoff, per-job timeouts, `waiting_approval` state. |
| Observatory | Queue depth, p50/p95 probe and transform latency, storage breakdown, runtime facts, audit ledger, live SSE job stream. |
| Creator Studio | Inspector view with player, waveform seek, stream facts, tag/collection editing, transform panel, derivative lineage. |
| Collaboration / Social / Providers | A researched, public capability matrix for 12 providers stating what each official API actually permits — and refusing to scrape anything it does not. |

## Quickstart

```bash
npm install
npm run dev          # API on :8787, web on :5173 (proxying /api)
npm run dev:core     # optional: Python analysis service on :8791
```

Without the analysis service everything else works; the console states that deep
measurements are unavailable instead of showing invented numbers. Point the API at the
service with `MEDIA_CORE_URL=http://127.0.0.1:8791 npm run dev:server`.

Open <http://localhost:5173>, complete first-run setup (single owner), then use
**Acquire → Import** to add media.

```bash
npm run check        # typecheck → ui rules → 130 tests
npm run test         # 120 JS tests across contracts, API and web (plus 10 pytest)
npm run typecheck    # every workspace
npm run build        # contracts → server → web
npm start            # one process: API + built web app (WEB_DIST_DIR is wired up)
```

`npm start` requires a prior `npm run build`. Set `COOKIE_SECURE=false` only when
serving a throwaway HTTP instance; production expects TLS in front of the API.

## Requirements

- Node.js ≥ 22.5 with the built-in `node:sqlite` module (verified on v22.22.3).
- FFmpeg and FFprobe: bundled through `@ffmpeg-installer` (verified build
  `N-47683-g0e8eb07980-static`) with `libx264`, `aac`, `libmp3lame`, `libopus`,
  `flac` and `libvpx-vp9`. Override with `FFMPEG_PATH` / `FFPROBE_PATH`.
- Python 3.11 for the optional analysis service (`services/media-core/.venv` is created
  automatically by `npm run dev:core`).
- ~200 MB disk for the toolchain, plus whatever media you import.

Go is *not* used, and not for lack of trying: every Go distribution channel is outside
this sandbox's egress. [ADR-0006](docs/04-architecture/adr/ADR-0006-polyglot-analysis-service.md)
records the attempts and the evidence.

## Repository layout

```
apps/server        Fastify API, job queue, media pipeline, SQLite schema
apps/web           Vite + React 19 SPA: marketing surface and console
packages/contracts zod schemas shared by both sides
scripts/start.mjs  single-process production entry point
scripts/check-ui-rules.mjs  the design house rules as a build gate
scripts/reset-owner.mjs     local owner-password recovery
services/media-core Python analysis service (optional, documented in its own README)
docs/              product, design, architecture, security, quality, operations
```

## Documentation

- [Recon report](docs/00-recon/recon-report.md) — what the repository and host toolchain actually were before any code was written.
- [Research](docs/01-research/provider-capability-matrix.md) — provider capability matrix, competitor research, React Bits and taste-skill analyses, with confidence levels and sources.
- Design — [art direction](docs/02-design/art-direction-concepts.md), [visual research board](docs/02-design/visual-research-board.md), [tokens](docs/02-design/design-tokens.md), [typography and motion](docs/02-design/typography-motion.md), [design overhaul](docs/02-design/design-overhaul.md), [asset plan](docs/07-delivery/asset-plan.md).
- Product — [domain map](docs/03-product/domain-map.md), [feature catalogue](docs/03-product/feature-catalogue.md), [IA, screens and journeys](docs/03-product/ia-screens-journeys.md).
- Architecture — [data model](docs/04-architecture/data-model.md), [API contracts](docs/04-architecture/api-contracts.md), [analysis service](docs/04-architecture/analysis-service.md), [decision index](docs/decisions/decision-index.md) (7 ADRs).
- Security — [threat model](docs/05-security/threat-model.md), [privacy model](docs/05-security/privacy-model.md).
- Quality — [test strategy](docs/06-quality/test-strategy.md), [verification matrix](docs/06-quality/verification-matrix.md), [performance methodology](docs/06-quality/performance-methodology.md).
- Delivery — [roadmap](docs/07-delivery/roadmap.md), [traceability matrix](docs/07-delivery/traceability-matrix.md), [risk register](docs/risks/risk-register.md), [implementation status](docs/implementation-status.md).
- Operations — [deployment](docs/12-operations/deployment.md), [troubleshooting](docs/12-operations/troubleshooting.md).

## Honest limits

- Provider connectors are **not** implemented. The catalogue publishes researched
  policy and refuses to connect without operator-supplied credentials; nothing in
  the UI implies a working OAuth handshake.
- Acquisition over the public internet is blocked in a sandbox with no egress;
  the fetcher is exercised by tests against a local fixture server instead.
- AI transcription, semantic search and cloud rendering are deliberately out of
  scope for this build (see the roadmap) rather than stubbed.
- Visual verification in a real browser has not run: this sandbox has no Chrome,
  Chromium or Edge and no root to install one. The design rules are enforced by a
  static gate and jsdom tests, which is weaker than looking at the page, and the
  status document says so.
- Generated imagery is absent for the same honesty reason: the image generator refused
  every request this session, so no generated picture is shown or claimed.
