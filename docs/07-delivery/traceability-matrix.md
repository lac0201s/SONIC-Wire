# Traceability matrix

PRD requirement → where it is implemented → where it is proven. Anchors refer to
`docs/reference/SonicWire_Autonomous_Agent_Master_PRD.md`.

| PRD anchor | Requirement | Implementation | Proof |
| --- | --- | --- | --- |
| §3.1 domain discovery | Research the media-domain landscape before building | `docs/01-research/competitor-research.md`, `provider-capability-matrix.md` | documents + sources |
| §3.4 interaction quality | Every interaction must be honest about capability | 503 refusals, provider policy text, `Metric` honesty lines | `analysis.test.ts`, route tests |
| §4.1 mandatory design research | Research the design language before the UI | `docs/01-research/taste-skill-analysis.md`, `docs/02-design/*` | installed skill + records |
| §4.2 per-component record | Record each adopted component's origin and changes | `apps/web/src/vendor/react-bits/ATTRIBUTION.md` | file |
| §5.1 verify versions, do not blindly pin | Verify tool versions in this environment | `docs/00-recon/recon-report.md`, ADR-0001, ADR-0006 | version output quoted |
| §5.2 frontend candidate stack | Choose and justify the frontend stack | ADR-0001, `docs/02-design/design-tokens.md` | build output |
| §5.3 polyglot backend, Go preferred | Use more than one runtime; Go where possible | ADR-0006: Python service; Go blocked with evidence | `services/media-core`, ADR table |
| §6 media pipeline | Probe, transform, measure, export | `apps/server/src/modules/media/*`, `services/media-core` | 130 tests |
| §7 jobs and durability | Durable queue with recovery | ADR-0003, `modules/jobs/queue.ts` | queue tests |
| §8 observability | Queue, latency, storage, audit visible | `modules/observatory/routes.ts`, `Observatory.tsx` | route tests, live API |
| §9 security and privacy | SSRF guard, CSRF, scrypt, no telemetry | `docs/05-security/*` | security tests |
| §10 documentation | Honest, current documents | `docs/**`, `docs/implementation-status.md` | line counts, commands quoted |
| §11 verification | Test, build, visual check | `docs/06-quality/*` | 130 tests; visual check blocked and stated |
