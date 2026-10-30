# ADR-0006 — A Python service for measurements, behind an HTTP boundary

Status: **accepted and implemented**
Date: 2026-10-30
Related: ADR-0001 (runtime), ADR-0004 (FFmpeg child processes)

## Context

The master PRD (§5.3) asks for a deliberately polyglot core: the system should use
the right runtime per job, with an explicit boundary, rather than one language doing
everything. It also asks for measurements the first build did not attempt: EBU R128
integrated loudness, true peak, loudness range, silence spans, black-frame spans,
scene-cut density, decode health, and a peak envelope.

Two forces push the same way:

1. **Numeric work.** These are sample-level computations over decoded PCM and frame
   statistics. `numpy` expresses the peak envelope in four lines that are awkward and
   slow in JavaScript.
2. **Blast radius.** A pathological file can wedge a decode for minutes. Running that
   inside the API process means the API stops answering.

## Decision

Measurements run in `services/media-core`, a Python 3.11 + FastAPI process:

- `POST /analyze` takes an absolute path inside `MEDIA_ROOT` and returns a typed report.
- `GET /health` reports the FFmpeg engine it found.
- FFmpeg does the decoding, exactly as in the Node pipeline (`FFMPEG_PATH` honoured).
- The Node API validates every response against `MediaAnalysisSchema` before storing it
  in `asset_analysis` and exposing it through `GET /api/assets/:id/analysis`.
- The service is **optional**. Without `MEDIA_CORE_URL` the API answers
  `503 provider_unavailable` with the reason and the UI states that analysis is not
  part of this deployment. It never substitutes zeros.

## Why not Go (the PRD's preferred backend language)

Go was the PRD's first choice for the backend (§5.3) and it was investigated first.
It could not be installed in this environment, and the reason is recorded factually:

| Attempt | Result |
| --- | --- |
| `apt-get install golang` | denied — no root |
| `https://go.dev/dl/…tar.gz` | connection refused (HTTP 000); host outside allowed egress |
| `npm i go-bin` (downloads from go.dev / storage.googleapis.com) | TLS handshake refused |
| GitHub release asset from `actions/go-versions` | the asset URL redirects to `release-assets.githubusercontent.com`, which is also blocked |

The allowed egress is `github.com`, `codeload.github.com`, `api.github.com`,
`registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`. No Go distribution channel
is reachable. `go version` prints nothing here, so no Go claim is made anywhere in this
repository.

Python is reachable through PyPI and is a genuinely good fit for the numeric half, so
the polyglot requirement is met with a real second service rather than a stub. If Go
is later available, this ADR's boundary is language-agnostic: the contract is HTTP +
the shared Zod schema, and the implementation can be replaced without touching the API
or the UI.

## Consequences

- One more process to run: `npm run dev:core` creates the venv, installs dependencies
  and serves `:8791`.
- Two runtimes in the repo (Node 22, Python 3.11) and two dependency systems.
- The path guard (`MEDIA_ROOT`) is the security-critical part: the service must never
  be exposed to a network it does not trust.
- Tests: 10 pytest cases for the service; 7 API cases for the refusal, envelope,
  capabilities and health surfaces.
