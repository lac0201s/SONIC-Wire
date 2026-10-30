# Roadmap

Short, dated, and honest about what is missing. "Now" means implemented and tested in
this repository; "next" means designed but not built; "later" means out of scope for
this build with a reason.

## Now — shipped and verified

| Capability | Evidence |
| --- | --- |
| Local library: upload, dedupe by SHA-256, probe, thumbnail, waveform, tags, collections, derivatives | 90 server tests, live smoke |
| Authorised URL ingestion with SSRF guard and byte/time caps | 24 guard tests, downloader tests |
| Nine FFmpeg transform presets with progress and cancellation | pipeline tests |
| Durable job queue: leases, retries, timeouts, `waiting_approval`, SSE stream | queue tests |
| Workflows: probe → thumbnail → waveform → transform → export with run history | server tests |
| Observable console: queue, latency, storage, runtime, audit | route tests, live API |
| Deep measurements in a second process (Python): loudness, silence, black frames, scene cuts, decode health, peak envelope | 10 pytest + 7 API tests + live end-to-end |
| Public site with live product fragment and honest provider policy table | web tests, build |
| Design house rules enforced by a static gate | `npm run lint:ui` |

## Next — designed, not built

| Item | Why it is next rather than done |
| --- | --- |
| Provider connectors (OAuth + API reads) | Requires operator credentials and a network policy; catalogue intentionally stops at researched policy |
| Real-browser design verification | No browser in this sandbox; the rules are enforced statically today |
| Go rewrite of a compute-heavy service | Go cannot be installed here (see ADR-0006); the HTTP boundary is ready for it |
| Multi-user roles and permissions | Schema has `role`; the product is single-owner by mandate |
| Retention and purge policies for jobs and audit | Needs an operator decision on retention, not a default |

## Later — deliberately out of scope

| Item | Reason |
| --- | --- |
| Scraping providers that forbid download | The PRD's honesty constraint forbids it; ToS text is cited in the provider catalogue |
| Cloud rendering / remote transcode farms | Contradicts local-first; no vendor contract was claimed or invented |
| AI transcription and semantic search | Would require a model dependency the PRD does not pin; stubbed features are worse than absent ones |
| Social publishing | No platform API in scope permits unattended publishing with the credentials this build has |

## Sequencing rule

Anything that touches the database or the wire contract lands with its migration, its
schema and its tests in one commit. Anything that changes the visual language lands with
the rule gate updated, not after it.
