# The analysis service (media-core)

SonicWire's measurements are produced by a second process written in Python. This
page records the boundary, the reasons, the contract and the failure behaviour.

## Why a second process, in a second language

The PRD (§5.3, §5.2) asks for a deliberately polyglot core with explicit boundaries
rather than one language doing everything. Two engineering reasons point the same way:

1. **The work is numeric.** EBU R128 integrated loudness, true-peak, loudness range,
   silence spans, black-frame spans and peak envelopes are sample-level computations.
   FFmpeg produces the numbers inside its filters; collapsing 8 kHz PCM into 400
   buckets is numpy's job, not JavaScript's.
2. **Isolation.** A wedged FFmpeg decode, a pathological file or a filter crash must
   not take the API down. A separate process can be killed, restarted and scaled
   independently, and the API keeps serving the library while it is gone.

The API remains the only thing the browser talks to. `media-core` is an internal
service with no authentication of its own; it must not be exposed publicly (it accepts
absolute paths, guarded by `MEDIA_ROOT`).

## Contract

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/health` | — | `{status, version, engine, mediaRoot}` |
| `POST` | `/analyze` | `{path, include_peaks}` | `MediaAnalysisSchema` (see `packages/contracts`) |

The Node side (`apps/server/src/modules/media/analysis-client.ts`) validates every
response against the shared Zod schema before storing it. A payload that does not
match is rejected rather than trusted.

## What is measured, and by what

| Field | Method | Location in `media_core/analysis.py` |
| --- | --- | --- |
| `loudness.integratedLufs`, `truePeakDb`, `rangeLu`, `thresholdLufs` | `loudnorm=…:print_format=json` | `measure_loudness` |
| `silence.segments`, `silenceSeconds`, `ratio` | `silencedetect=n=-50dB:d=0.5` | `measure_silence` |
| `blackFrames.count`, `totalSeconds`, `longestSeconds` | `blackdetect=d=0.1:pix_th=0.10` | `measure_black_frames` |
| `sceneCuts.count` | `select='gt(scene,0.3)',metadata=print` | `measure_scene_cuts` |
| `decode.errors`, `decode.clean` | full decode pass at `-v error` | `measure_decode_health` |
| `signal.meanLuma`, `meanSaturation` | `signalstats`, first 30 s | `measure_signal` |
| `peaks[]` | 8 kHz mono PCM → numpy max per bucket, 400 buckets | `measure_peaks` |

Frame scans are bounded at 600 s. When a file is longer, the payload carries a note
that says so; the number is never silently presented as whole-file.

## Failure behaviour

This is the part that matters for honesty:

- `MEDIA_CORE_URL` unset → `GET /api/assets/:id/analysis` returns
  `{analysis: null, core: {configured: false, detail: …}}`; `POST …/analyze` returns
  `503 provider_unavailable` with the reason. Nothing is queued, nothing is faked.
- Service unreachable → same shape with `reachable: false`; previously stored
  measurements stay visible.
- Service rejects a file (`403` outside root, `404` missing, `415` not media) → the job
  fails with `media-core rejected the file (…)` and that text is what the operator sees.
- Timeout → `504`, job fails; the process group is killed with `SIGKILL`.
- A report with no audio stream has `loudness/silence/peaks` null and a note; a report
  with no video has `blackFrames/sceneCuts/signal` null and a note. Null means "not
  applicable or not measured", never zero.

## Storage

`asset_analysis` (migration `0002_asset_analysis`): one row per asset, keyed by
`asset_id`, holding `report_json`, `engine`, `measured_at`. Re-running replaces the
row; the history of when measurements were requested lives in the audit log and job
events.

## Running it

```bash
npm run dev:core                                   # creates the venv, installs deps, serves :8791
MEDIA_CORE_URL=http://127.0.0.1:8791 npm run dev:server
```

`MEDIA_ROOT` defaults to `apps/server/var/media`, matching the Node storage layout, so
a single-machine install needs no configuration beyond the URL.

## Verified behaviour

- `services/media-core`: **10 pytest tests pass** (loudness, silence, black frames,
  scene cuts, decode health, peaks, full report serialisation, path guard, HTTP 200
  path, health).
- API: **7 tests** cover the unconfigured client, the 503 refusal, the analysis
  envelope, capabilities and health.
- End-to-end on a 5 s fixture (2 s testsrc, 1 s black, 2 s testsrc, tone + silence):
  job succeeded, `integratedLufs -21.8`, `truePeakDb -17.85`, `blackFrames.count 1 /
  totalSeconds 1`, `sceneCuts.count 2`, `decode.clean true`, `peakCount 400`.
