# Reconnaissance report

Date: 2026-10-30 · Branch: `arena/caf4f551-sonic-wire` · Base commit: `c203542` ("Initial commit")

## 1. What existed before this build

The checkout contained a single commit with one file:

| Path | State |
| --- | --- |
| `README.md` | Two lines: `# SONIC-Wire` and nothing else. |
| Everything under `apps/`, `packages/`, `docs/` | Absent. |

`git status` reported every artefact created during this session as untracked, so
there was no prior work to preserve, refactor or overwrite. The mandate to inspect
before building was satisfied trivially: the repository was empty of product code.

## 2. Host toolchain (measured, not assumed)

| Fact | Evidence |
| --- | --- |
| Node.js `v22.22.3` | `node -v` |
| `node:sqlite` available, flagged experimental | `new DatabaseSync(file)` works; prints `ExperimentalWarning` |
| npm workspaces usable | root `package.json` declares `workspaces: ["packages/*", "apps/*"]`, `npm install` links them |
| FFmpeg present via `@ffmpeg-installer` | `N-47683-g0e8eb07980-static`; `-encoders` shows `libx264`, `aac`, `libmp3lame`, `libopus`, `flac`, `libvpx-vp9`, `mjpeg`, `pcm_s16le` |
| FFprobe present via `@ffprobe-installer` | `N-66595-gc2b38619c0-static` |
| No Go toolchain required | The PRD listed Go as a candidate only; the measured host already had a first-class FFmpeg + Node story, so Go was rejected (see ADR-0001). |
| Outbound network: only `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org` | npm installs succeed; arbitrary provider APIs and most documentation sites are unreachable from the shell. `fetch_page`/`web_search` were used for research instead. |
| Image generation unavailable | The image tool returned HTTP 403 for every request. Recorded rather than worked around with fake "generated" assets — all artwork is procedural (see asset plan). |
| No browser automation available | Playwright/CLI browsers are not installed and cannot be installed from the allowed hosts. UI verification therefore uses jsdom + Testing Library, plus HTTP-level checks against the live dev server. |

## 3. Constraints derived from recon

1. **SQLite, not Postgres.** The runtime ships `node:sqlite`; adding a database
   server would have made the "runs on one machine" promise false. Leases, WAL mode
   and a single-writer queue keep concurrency honest (ADR-0002).
2. **FFmpeg is the only media engine.** Everything the product claims about media
   is a fact FFprobe reported or an artefact FFmpeg produced. No synthetic metadata.
3. **One process must be able to serve everything.** `scripts/start.mjs` plus the
   API's `WEB_DIST_DIR` support satisfy that without a reverse proxy.
4. **Provider work is policy work.** With no reachable provider APIs and no
   credentials, the honest deliverable is a researched capability matrix plus a
   hard refusal path — implemented in `providers/registry.ts` and enforced at ingest.
5. **Research without primary sources must be labelled.** Provider policy claims
   carry a confidence level in the matrix; where public sources disagreed (X API
   pricing) the disagreement is recorded instead of resolved by invention.

## 4. Existing conventions adopted

Since there were no conventions, these were chosen and are applied everywhere:

- TypeScript strict everywhere, ESM only, `.js` extensions in relative imports.
- Runtime validation at the HTTP boundary with zod schemas from `packages/contracts`;
  the same schemas type the client, so a contract change breaks the build on both sides.
- Errors are `{ error: { code, message, details?, requestId } }` with a closed code set.
- Every mutating route requires a session **and** a matching CSRF header.
- Tests colocated with the module they cover, plus one HTTP-level suite that drives
  the real Fastify instance through `app.inject`.

## 5. Artefacts produced by this session

Measured at the end of the build: 18 SQLite tables, 45 `/api` routes, 112 tests
(12 contracts · 83 server · 17 web), ~16.8k lines of TypeScript across the three
workspaces, and a web bundle of 27 code-split chunks (largest 256.8 kB / 80.5 kB gzip).
