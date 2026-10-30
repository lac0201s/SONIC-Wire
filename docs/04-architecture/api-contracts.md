# API contracts

Base path `/api`, version `v1` (advertised by `GET /api/system/capabilities`).
45 routes. Every request and response body is defined by a zod schema in
`packages/contracts/src/index.ts`; the server validates at the boundary and the web
client is typed from the same file, so a contract change fails both builds.

## 1. Envelope conventions

**Errors** — one shape, always:

```json
{ "error": { "code": "forbidden", "message": "Human sentence.", "details": null, "requestId": "uuid" } }
```

`code` is a closed set: `bad_request`, `unauthorized`, `forbidden`, `not_found`,
`conflict`, `payload_too_large`, `rate_limited`, `unsupported_media`,
`provider_unavailable`, `provider_not_configured`, `upstream_failed`, `internal`.
The client maps codes to UI treatment; it never string-matches messages.

**Auth** — an httpOnly `sonicwire_session` cookie (`SameSite=Lax`, `Secure` when
`COOKIE_SECURE` or production). Every mutating request must echo the session's
per-session CSRF token in `x-sonicwire-csrf`. Public routes: `/api/health`,
`/api/auth/session`, `/api/auth/setup`, `/api/auth/login`, `/api/providers`.

**Pagination** — cursor-based: responses carry `nextCursor` (opaque string or null)
and `total`. Default limit 40, max 100.

**Time** — all timestamps ISO-8601 UTC strings; durations are integer milliseconds;
byte counts are integers.

## 2. Route inventory

### System and auth

| Method | Path | Purpose | Notable contract |
| --- | --- | --- | --- |
| GET | `/api/health` | liveness + component detail | public; returns `checks.database/ffmpeg/queue` |
| GET | `/api/system/capabilities` | version, FFmpeg encoders, presets, limits | public-ish (auth not required by the plugin list, used by landing) |
| POST | `/api/system/diagnostics` | self-test (DB write, FFmpeg, storage) | audited |
| GET | `/api/system/realtime-subscribers` | SSE subscriber count | observability |
| GET | `/api/auth/session` | session + workspace + capabilities | `needsSetup` drives routing |
| POST | `/api/auth/setup` | first-run owner creation | 201; 409 if an owner exists |
| POST | `/api/auth/login` | password login | rate limited; failures audited |
| POST | `/api/auth/logout` | revoke session | |
| POST | `/api/auth/password` | change password | requires current password, revokes other sessions |

### Assets

| Method | Path | Purpose | Notable contract |
| --- | --- | --- | --- |
| GET | `/api/assets` | list/filter/sort/paginate | `AssetQuerySchema` (limit 1–100, sort enum) |
| GET | `/api/assets/:id` | detail | includes `derivedCount`, streams, quality facts |
| PATCH | `/api/assets/:id` | rename, tags, collections | `UpdateAssetSchema`; bumps `version` |
| DELETE | `/api/assets/:id` | soft delete + file removal | returns reclaimed bytes |
| POST | `/api/assets/:id/reprobe` | enqueue probe | 202 `{ jobId }` |
| POST | `/api/assets/:id/transform` | enqueue transform | 202 `{ jobId }`; `TransformRequestSchema` |
| GET | `/api/assets/:id/derivatives` | lineage | `{ items: AssetDetail[] }` |
| GET | `/api/assets/:id/stream` | range streaming | 206 + `Content-Range`/`ETag`; 416 beyond end |
| GET | `/api/assets/:id/thumbnail` | poster JPEG | private cache, 404 if absent |
| GET | `/api/assets/:id/waveform` | peaks | `{ peaks: number[], durationMs, sampleRate }`, ≤ 1200 peaks |

### Acquisition and export

| Method | Path | Purpose | Notable contract |
| --- | --- | --- | --- |
| POST | `/api/acquisition/upload` | multipart import | audio/video/image MIME only (415 otherwise); 201 new / 200 duplicate |
| POST | `/api/acquisition/url` | URL ingest | validates scheme, credentials, host, resolved IP range, provider policy; 202 `UrlIngestReceipt`; 403/409 on refusal |
| POST | `/api/exports` | build ZIP bundle | 202 `{ jobId }`; body `{ assetIds: string[] }` |
| GET | `/api/exports/:jobId/download` | stream the bundle | `application/zip`, `Content-Disposition: attachment` |

### Jobs, workflows, collections, tags

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/jobs` | list, filter by status/kind, paginate |
| GET | `/api/jobs/:id` | detail incl. events |
| POST | `/api/jobs/:id/cancel` | request cancellation (queued or running) |
| GET | `/api/events` | SSE stream: `heartbeat`, `job.updated`, `job.event` |
| GET/POST | `/api/workflows` | list / create (`1–12` steps, typed) |
| DELETE | `/api/workflows/:id` | delete definition |
| POST | `/api/workflows/:id/run` | 202 `{ runId, jobId }`; asset must be `ready` |
| GET | `/api/workflows/:id/runs` | run history |
| GET | `/api/workflow-runs/:runId` | run + per-step results |
| GET/POST | `/api/collections` | list / create |
| DELETE | `/api/collections/:id` | delete |
| POST | `/api/collections/:id/assets` | add assets (`{ assetIds }` → `{ added }`) |
| GET | `/api/tags` | tags with counts |

### Providers, observatory, settings

| Method | Path | Purpose | Notable contract |
| --- | --- | --- | --- |
| GET | `/api/providers` | catalogue + connection state | public; includes `ingestion: direct-media | link-only` |
| POST | `/api/providers/:id/connect` | begin connection | 409 `provider_not_configured` naming the required env vars |
| DELETE | `/api/providers/:id/connection` | remove stored connection | |
| GET | `/api/observatory/summary` | queue, latency, storage, runtime, assets | one call powers the observatory |
| GET | `/api/observatory/audit` | audit ledger | paginated, newest first |
| GET | `/api/settings` | workspace + user + counts | |
| PATCH | `/api/settings/workspace` | rename workspace | |
| GET | `/api/settings/export-metadata` | JSON metadata export | server-only; no UI |
| POST | `/api/settings/purge` | delete all assets | requires explicit confirmation body; returns removed count |

## 3. Contract rules

1. **Every handler parses input with a schema.** Unknown fields are ignored rather
   than echoed; unknown enum values are 400s.
2. **Status codes are meaningful**: 200 for reads and idempotent repeats, 201 for
   creation, 202 for "work queued", 204/`{ok:true}` for deletes, 4xx for client
   faults, 5xx only for genuine server faults.
3. **Long operations always return a job.** No route blocks on FFmpeg; probe,
   transform, export and workflow all enqueue and return 202.
4. **Errors never leak internals.** Provider/HTTP error text is summarised; stack
   traces stay in logs, correlated by `requestId`.
5. **Streaming is range-aware.** `/stream` honours `Range`, returns `Accept-Ranges`,
   a strong `ETag` derived from the file's mtime+size, and 416 with
   `Content-Range: bytes */<size>` when unsatisfiable.

## 4. Examples

```http
POST /api/assets/9f0c.../transform
cookie: sonicwire_session=…
x-sonicwire-csrf: …
content-type: application/json

{ "presetId": "audio.mp3.192", "trim": { "startMs": 0, "endMs": 2000 }, "titleSuffix": "mp3" }
→ 202 { "jobId": "bb299aea-…" }
```

```http
GET /api/assets/9f0c.../stream
Range: bytes=0-1023
→ 206
   Accept-Ranges: bytes
   Content-Range: bytes 0-1023/699016
   Content-Length: 1024
   ETag: "739b320034c28db0-699016"
```

```http
POST /api/acquisition/url { "url": "http://[::ffff:127.0.0.1]/a.mp3" }
→ 403 { "error": { "code": "forbidden",
       "message": "That host resolves to a private or reserved address, which SonicWire refuses to contact" } }
```
