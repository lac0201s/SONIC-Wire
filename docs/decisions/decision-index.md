# Decision index

Every architectural decision that a later reader could reasonably want to reverse,
with the authority that settled it. Format: one row per ADR, newest first.

| ADR | Decision | Status | Supersedes | Verified in code |
| --- | --- | --- | --- | --- |
| [ADR-0007](../04-architecture/adr/ADR-0007-design-house-rules-enforced-in-ci.md) | The design house rules are enforced by `scripts/check-ui-rules.mjs`, not by prose; offending primitives were deleted | accepted | — | `npm run lint:ui` |
| [ADR-0006](../04-architecture/adr/ADR-0006-polyglot-analysis-service.md) | Deep measurements run in a Python FastAPI service behind HTTP; Go was attempted and is unreachable in this sandbox | accepted | — | `services/media-core`, `POST /api/assets/:id/analyze` |
| [ADR-0005](../04-architecture/adr/ADR-0005-zip-writer.md) | Hand-rolled streaming ZIP writer over `fflate` export flow | accepted | — | `apps/server/src/modules/media/zip.ts` |
| [ADR-0004](../04-architecture/adr/ADR-0004-ffmpeg-child-processes.md) | FFmpeg/FFprobe as child processes with argument allowlists, own process group, SIGKILL on timeout | accepted | — | `media/process.ts`, `media/ffmpeg.ts`, `media_core/ffmpeg.py` |
| [ADR-0003](../04-architecture/adr/ADR-0003-durable-job-queue.md) | Durable job queue in SQLite with leases, heartbeats and bounded retries | accepted | — | `modules/jobs/queue.ts` |
| [ADR-0002](../04-architecture/adr/ADR-0002-sqlite-and-no-orm.md) | `node:sqlite` with hand-written SQL and append-only migrations; no ORM | accepted | — | `db/schema.ts`, `db/index.ts` |
| [ADR-0001](../04-architecture/adr/ADR-0001-runtime-and-framework.md) | Node 22 + TypeScript + Fastify for the API; Go recorded as unavailable with evidence | accepted | — | `apps/server/src/http/app.ts` |

## Decisions taken without an ADR, and why

| Decision | Reason it did not need an ADR |
| --- | --- |
| React 19 + Vite for the web app | Reversible in a day; no data-format consequence |
| TanStack Query for server state | One hook layer in `lib/queries.ts`; swappable |
| Zod as the single contract source | It is the contract; changing it is changing every endpoint |
| React Bits components vendored as JSX | Two files, documented in `vendor/react-bits/ATTRIBUTION.md` |
| `readPipedLines` for FFmpeg progress | A parsing detail, covered by tests |

## How to add a decision

Write the ADR first, implement second, and add the row here in the same commit. If a
decision cannot state its consequences in one paragraph, it is not yet a decision.
