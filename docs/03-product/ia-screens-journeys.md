# Information architecture, screen inventory and user journeys

## 1. Two surfaces, one design system

```
/                      marketing site (public, no session)
/login  /setup         auth surfaces (public until an owner exists)
/app                   console (session required)
  /app                 Command       overview: health, activity, quick actions
  /app/library         Universe      browse, filter, select
  /app/assets/:id      Inspector     inspect, play, transform, tag, export
  /app/acquire         Acquire       import, URL ingest, provider matrix
  /app/studio          Studio        working set / selection-driven transformations
  /app/workflows       Workflows     definitions, runs, step results
  /app/observatory     Observatory   queue, latency, storage, audit, live stream
  /app/settings        Settings      workspace, diagnostics, danger zone
*                      404           explicit dead-end with two exits
```

Screens are lazy-loaded per route; the shell (nav, palette, toasts) is shared.
**Screen inventory: 11 routes**, all implemented.

## 2. Route → data dependencies

| Route | Primary queries | Mutations available |
| --- | --- | --- |
| `/` | `session`, `health`, `providers` | — |
| `/login` `/setup` | `session` | login, setup |
| `/app` | `health`, `assets?limit=6`, `jobs?limit=5`, `observatory` | — |
| `/app/library` | `assets` (query-driven), `tags`, `collections` | export selection, create collection |
| `/app/assets/:id` | `asset`, `waveform`, `derivatives`, `jobs` | transform, reprobe, patch, delete, cancel job |
| `/app/acquire` | `providers`, `jobs`, `collections` | upload, ingest URL, connect provider |
| `/app/studio` | `asset`, `derivatives` | transform |
| `/app/workflows` | `workflows`, `runs` | create, run, delete |
| `/app/observatory` | `summary` (2 s poll), `audit`, SSE | — |
| `/app/settings` | `settings`, `capabilities` | rename, diagnostics, purge |

## 3. Navigation model

- **Desktop**: fixed 232 px rail, mono micro-labels, active item marked with an ember
  bar and a lighter surface. Primary action ("Import") pinned at the bottom.
- **Mobile**: bottom bar with four destinations (Command, Library, Acquire, Observe);
  the rest reachable from the Command screen and the palette.
- **Global**: `⌘K`/`Ctrl+K` palette with fuzzy route search plus the five most recent
  assets; `g`-prefixed shortcuts jump to a route when not typing.
- **Breadcrumbs**: console header shows the section label and the active asset title
  in the inspector, so a deep link is never ambiguous.

## 4. Journeys

### J1 — First run (cold start)

1. Operator visits `/`. Session query returns `needsSetup: true`.
2. Primary CTA becomes **Set up this instance** → `/setup`.
3. Owner enters email, display name, password (≥ 12 chars). Server creates user,
   workspace, membership, seeds workflow templates, audits `workspace.created`,
   sets an httpOnly session cookie and returns a CSRF token.
4. Redirect to `/app`. Command screen shows green health checks and an explicit
   "no media yet" state with a link to Acquire.

Failure paths: weak password → inline validation; second setup attempt → 409 with
"an owner already exists".

### J2 — Import a file

1. `/app/acquire` → **Import** tab. Choose a file (or drop it).
2. XHR uploads with progress; a cancel button aborts the request and the server
   discards the partial file.
3. Server streams to quarantine while hashing, dedupes by SHA-256, writes the asset
   row, enqueues `media.probe`, returns `assetId` + `jobId`.
4. The job list shows probe → thumbnail → waveform. On success the row turns `ready`
   and the inspector link becomes active.

### J3 — Inspect and transform

1. Library row → inspector. Left column: player (range streaming), waveform seek.
   Right column: container/codec/dimension/bit-rate facts with tabular numerals.
2. Choose a preset in the transform panel. Only presets that accept the asset's kind
   are listed, and the panel states the count it hid and why ("the rest change the
   media kind and would not accept video").
3. Optionally set a trim window. Submit → 202 with a job id.
4. Progress comes from FFmpeg's own output, surfaced through SSE, so the bar moves
   only when the encoder reports progress.
5. On completion the derivative appears under "Derived" with a lineage link; the
   parent's `derivedCount` increments.

### J4 — Ingest an authorised URL

1. Acquire → **From URL**. Paste an `https://` media URL.
2. Client-side scheme check, then server-side: protocol allowlist, credential
   refusal, hostname blocklist, DNS resolution, private-range refusal (v4, v6,
   mapped, NAT64, 6to4), redirect re-validation, DNS pinning.
3. If the host belongs to a `link-only` provider → 409 with the provider's own
   policy sentence; the URL is stored nowhere.
4. Otherwise a job downloads with byte/time caps, verifies the hash, then behaves
   like J2.

### J5 — Build and run a workflow

1. `/app/workflows` → **New workflow**. Pick steps (probe, thumbnail, waveform,
   transform, tag, collect, export), name it.
2. **Run** → pick a ready asset. The run is queued as `workflow.run` with the run id
   patched into the job payload.
3. Each step's result (status, message, duration) is written to
   `workflow_runs.step_results`; the run panel renders them as they land.
4. A failing step stops the run; the failing step is named with the error message.

### J6 — Operate the queue

1. `/app/observatory`: queue depth and 24 h outcomes at the top, then latency, storage
   and runtime facts, then the audit table.
2. Any queued/running job can be cancelled from its list row; the cancel sets
   `cancel_requested` and aborts the in-flight handler.
3. If a worker dies, the lease expiry requeues the job exactly once and records a
   `worker_lost` outcome after the attempt budget is exhausted.

### J7 — Recover a lost owner password

1. Sign-in screen states plainly that recovery needs filesystem access.
2. Operator stops the API, runs `npm run owner:reset --workspace @sonicwire/server`,
   types the new password twice (hidden input, piped stdin supported for scripted
   recovery).
3. Hash is rotated, all sessions deleted, `auth.owner_password_reset` audited.
4. Start the API and sign in.

## 5. Empty, error and permission states

| Condition | Behaviour |
| --- | --- |
| No owner | `/app/*` redirects to `/setup`; marketing CTA says "set up" |
| No session | `/app/*` redirects to `/login`, preserving the intended path |
| Session expired mid-action | API returns 401; the client clears caches and routes to `/login` with a toast |
| FFmpeg missing | Health check reports `ffmpeg.ok: false`; the landing page and Settings show it; transforms fail with an explicit message, never silently |
| Provider not configured | 409 with the required env var names, surfaced verbatim in a toast |
| Non-media upload | 415 with the received MIME type |
| Asset file missing on disk | Probe marks the asset `missing`, inspector shows an error panel with a reprobe action |
| Queue saturated | Jobs stay `queued`; the observatory shows depth; the UI never fakes progress |
