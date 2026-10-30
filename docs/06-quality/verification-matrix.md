# Verification matrix

Functional area → the evidence that it works. "Command" is what a reader can run; the
result column is what it produced on 2026-10-30 in this sandbox.

| Area | Claim | Command / artefact | Result |
| --- | --- | --- | --- |
| Contracts | Schemas match the wire format | `npx vitest run --root packages/contracts` | 12 passed |
| Auth | Setup, login, session, CSRF, password change | `npx vitest run --root apps/server` (`auth/service.test.ts`, route tests) | passed |
| Acquisition (upload) | Streaming upload with hash verification and dedupe | server suite; live smoke upload of a 921 KB MP4 | asset created, `duplicate:false` |
| Acquisition (URL) | SSRF guard rejects private/loopback/metadata hosts and re-validates redirects | `url-guard.test.ts` (24 cases) | passed |
| Probe | Container/codec/stream facts | pipeline suite with generated fixtures | passed |
| Transform | Nine presets produce playable derivatives | pipeline suite; preset list in `/api/system/capabilities` | passed |
| Export | Streaming ZIP bundle with per-entry accounting | pipeline suite | passed |
| Workflows | Multi-step run with per-step results | server suite | passed |
| Queue | Leases, heartbeat recovery, retries, cancellation | `queue.test.ts` | passed |
| Measurements | EBU R128, silence, black frames, scene cuts, decode health, peaks | `pytest` in `services/media-core` | 10 passed |
| Measurements (HTTP) | Refuses to fabricate; 503 when service is absent | `apps/server/src/modules/media/analysis.test.ts` | 7 passed |
| End-to-end analysis | Real file → real numbers through both processes | live: `POST /api/assets/:id/analyze` then `GET …/analysis` | job succeeded; −21.8 LUFS, 1 black frame, 2 cuts, decode clean, 400 peaks |
| Observatory | Queue depth, latency, storage, audit | route tests + live `/api/observatory` | responded 200 |
| Design system | `Metric`, `StatusBadge`, `Waveform`, `AssetCard` semantics | `npx vitest run --root apps/web` | 18 passed |
| Design rules | Banned ornaments absent | `npm run lint:ui` | 35 files, 0 violations |
| Production build | Web bundle builds | `npm run build --workspace @sonicwire/web` | built in ~4 s |
| Single-process mode | API serves built SPA | `npm start` smoke (earlier session) | served |
| Visual review in a browser | Layout at 360/768/1440, headline line counts, contrast in situ | — | **not verified: no browser in this sandbox** |
| Go toolchain | `go version` | — | **not installed: no reachable distribution channel** |
| Provider connectors | OAuth/API integration | — | **not implemented by design; catalogue is policy text** |

## How to re-run everything

```bash
npm run check                      # typecheck → ui rules → vitest (all workspaces)
npm run build                      # contracts → server → web
cd services/media-core && .venv/bin/python -m pytest tests -q
```

For the media suites, point `FFMPEG_PATH` / `FFPROBE_PATH` at the bundled binaries if
your PATH has none:

```bash
FFMPEG_PATH=$PWD/node_modules/@ffmpeg-installer/linux-x64/ffmpeg \
FFPROBE_PATH=$PWD/node_modules/@ffprobe-installer/linux-x64/ffprobe \
  npx vitest run --root apps/server
```
