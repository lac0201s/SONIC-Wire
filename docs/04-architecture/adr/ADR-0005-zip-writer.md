# ADR-0005 — Hand-rolled streaming ZIP writer

**Status:** accepted · 2026-10-30

## Context

Bundle export must stream large media files into a ZIP without buffering them in
memory and without a hang. The first implementation used a compression library and
**hung forever at export time** — the job never succeeded, no error was thrown, and
the promise simply never settled (reproduced with a standalone script). Debugging a
third-party streaming path to find an unsettled promise inside an opaque writer was
slower than owning the format.

## Decision

Write `modules/media/zip.ts`: a minimal store-method (no compression) ZIP writer with
correct local file headers, central directory, EOCD, CRC-32 from `node:zlib`,
UTF-8 filename flag, awaited writes for backpressure, byte-cap enforcement, abort
support, and a manifest entry. Media is already compressed, so `store` costs almost
nothing in size and removes an entire class of inflate bugs.

## Alternatives

| Alternative | Why rejected |
| --- | --- |
| `archiver` | The class of dependency that produced the hang; also streams through a proxy object that makes cancellation unclear. |
| `yazl` | Solid, but same streaming-ownership problem, and it would still need our manifest and byte-cap logic. |
| `fflate` | Excellent, but its streaming API was the failing path; also pulls a compression engine we do not need for `store`. |
| Shell out to `zip` | External binary dependency, no cancellation story, platform-dependent. |

## Consequences

- ~200 lines of format code to maintain, verified against Python's `zipfile` (`-t`
  and `-l` both pass) and by hash-comparing every extracted entry to the manifest.
- No compression: a 1.05 MB bundle of a 699 kB MP4 and a 353 kB WAV measured 1.05 MB.
- `maxBytes` and `signal` are first-class, so a runaway export cannot fill the disk or
  ignore cancellation.
