# Implementation status

Last verified: **2026-10-30**, on this machine, with the commands quoted. Anything not
listed as verified is not claimed.

## Green

| Check | Command | Result |
| --- | --- | --- |
| Contracts | `npx vitest run --root packages/contracts` | 12 passed |
| API | `npx vitest run --root apps/server` | 90 passed, 8 files |
| Web | `npx vitest run --root apps/web` | 18 passed, 3 files |
| Media Core | `services/media-core/.venv/bin/python -m pytest tests -q` | 10 passed |
| UI rules | `npm run lint:ui` | 35 files, 0 violations |
| TypeScript | `npx tsc -b apps/web/tsconfig.json`, `npx tsc -p apps/server/tsconfig.json --noEmit` | no output |
| Web build | `npm run build --workspace @sonicwire/web` | built in ~4.1 s |
| End-to-end analysis | live API on :8787 + media-core on :8791 | job succeeded; −21.8 LUFS, 1 s black, 2 scene cuts, clean decode, 400 peaks |

## Changed in this pass

1. **The design was rebuilt against the installed house rules.** Gradients, glows,
   shadows, glass, grain, hairline rules, mono micro-labels, uppercase tracking and
   eyebrow labels were removed from every surface. `SectionHeading.label`,
   `AuthLayout.eyebrow`, `Mark.glow` and `Panel.ticks` no longer exist, so they cannot
   come back quietly. See `docs/02-design/design-overhaul.md`.
2. **A second runtime.** `services/media-core` (Python 3.11, FastAPI) measures loudness,
   silence, black frames, scene cuts, decode health and a peak envelope. The API queues
   the work, validates the report against the shared schema, stores it in
   `asset_analysis`, and exposes it at `GET /api/assets/:id/analysis`. With the service
   absent the API answers `503` with a reason; the UI says analysis is not part of this
   deployment. Nothing is estimated.
3. **The console shows the measurements.** The inspector gained a Measurements panel
   with units, thresholds, method lines and honest "not measured" states, plus the peak
   envelope drawn from the file.
4. **The rules are executable.** `scripts/check-ui-rules.mjs` fails the build on banned
   utilities; `npm run check` runs typecheck → rules → tests.
5. **Owner recovery is a real tool.** `scripts/reset-owner.mjs` resets the password,
   revokes every session and writes an audit event. Exercised against a live database.
6. **Documentation filled in.** Decision index, ADR-0006/0007, threat model, privacy
   model, test strategy, verification matrix, performance methodology, roadmap,
   traceability matrix, risk register, deployment, troubleshooting.

## Not done, with the reason

| Item | Status | Reason |
| --- | --- | --- |
| Go service (PRD §5.3 preference) | **not installed** | Every Go distribution channel is outside allowed egress; release assets redirect to a blocked host. Evidence in ADR-0006. `go version` prints nothing here. |
| Browser-based visual verification | **not run** | No Chrome/Chromium/Edge and no root to install one. The skill's `inspect.mjs` gate, three-width screenshots and in-browser contrast measurement are unverified. |
| Provider OAuth connectors | **not implemented** | Would require operator credentials and a policy decision; the catalogue deliberately stops at researched, cited policy. |
| Image/video generation assets | **blocked** | The image generator returned 403 ("account flagged") on every attempt this session; no generated imagery is claimed or used. |
| Multi-user roles, retention policies, cloud rendering | **out of scope** | See `docs/07-delivery/roadmap.md` §Later. |

## Numbers

- 18,626 lines of TypeScript across `apps/` and `packages/` (excluding generated output).
- 50 API routes, 19 SQLite tables (18 + `asset_analysis`), 9 transform presets,
  12 providers in the policy catalogue.
- 130 automated tests, 0 skipped.
