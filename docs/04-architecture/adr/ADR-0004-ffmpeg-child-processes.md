# ADR-0004 — FFmpeg as child processes with argument allowlists

**Status:** accepted · 2026-10-30

## Context

Every media fact and artefact in the product comes from FFmpeg/FFprobe. The
transformation surface must be expressive enough to be useful but must never let a
request shape an arbitrary command line.

## Decision

Spawn the bundled static binaries with `child_process.spawn`, argument arrays only
(never a shell), and a **closed preset table**: each preset maps to a fixed argument
list plus an optional, schema-validated trim window. Outputs are re-probed before an
asset row is marked `ready`. FFprobe JSON is parsed through a typed normaliser; the
raw document is stored for audit.

## Alternatives

| Alternative | Why rejected |
| --- | --- |
| `fluent-ffmpeg` | Convenience wrapper that hides the exact argv being run — the opposite of what a security review needs. |
| `ffmpeg.wasm` | 25–30 MB payload, no hardware acceleration, and a slower path for every operation. |
| Remotion / browser encoders | Different product (programmatic video), not a media engine. |
| Letting users pass raw FFmpeg arguments | Remote code execution by design. The preset table is also a **documented capability list** shown in the UI. |

## Consequences

- Users cannot express arbitrary encodes; the roadmap adds presets, not free-form argv.
- Cancellation works because we hold the child process handle and kill its group.
- Progress is parsed from `-progress pipe:1` output, so the UI advances only when the
  encoder does.
- A missing FFmpeg binary degrades loudly: health reports `ffmpeg.ok=false`, transforms
  fail with an explicit message, and the landing page says so.
