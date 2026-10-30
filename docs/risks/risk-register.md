# Risk register

Scored 1–5 for likelihood and impact; exposure = L × I. Reviewed whenever an ADR lands.

| ID | Risk | L | I | Exposure | Mitigation in this build | Residual |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Provider policy changes, making the catalogue text wrong | 4 | 2 | 8 | Text is quoted with the source and dated; the UI shows it as policy, not as a live integration | Stale text until reviewed |
| R-02 | Users expect provider downloads the build refuses | 3 | 4 | 12 | Refusal is explicit in the UI and in `/api/providers`, with the provider's own words | Reputational only |
| R-03 | Bundled FFmpeg (2018 build) lacks newer filters/encoders | 4 | 3 | 12 | Capability probe at boot; presets whose encoder is missing are refused before queueing; tests avoid unavailable options | Some modern codecs unsupported |
| R-04 | Malicious media exploits FFmpeg at the codec level | 2 | 5 | 10 | Child process, timeouts, process-group SIGKILL, no network features, no shell; a crash fails one job | Accepted, documented |
| R-05 | No browser-based visual verification | 5 | 3 | 15 | Static rule gate + jsdom tests + manual source review | Layout defects could ship unseen |
| R-06 | Go unavailable, so the PRD's preferred backend language is unused | 5 | 2 | 10 | Python service satisfies the polyglot requirement; boundary is language-agnostic | Deviation on record |
| R-07 | `media-core` exposed beyond loopback by an operator | 2 | 4 | 8 | No auth inside it by design; documented as internal-only; `MEDIA_ROOT` limits filesystem reach | Operator error |
| R-08 | SQLite single-writer contention under parallel jobs | 3 | 3 | 9 | WAL mode, short transactions, two workers by default | Throughput ceiling |
| R-09 | Job history grows without bound | 4 | 2 | 8 | Visible in the observatory; no automatic purge (documented) | Disk growth |
| R-10 | Design rules regress after refactor | 2 | 2 | 4 | `npm run lint:ui` fails the build | Human-judgement rules still unenforced |

## Escalation

A risk with exposure ≥ 12 and no mitigation requires a written decision before
implementation continues. R-02 and R-03 are in that band with mitigations in place;
R-05 is in that band and unresolved, which is why every claim about visual quality in
this repository is qualified.
