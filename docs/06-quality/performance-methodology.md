# Performance methodology

The observatory shows p50/p95 latency; this page says where those numbers come from and
what they do not mean.

## Measurement, not benchmark

- Each job writes `started_at` and `finished_at` in SQLite. The observatory computes
  p50/p95 over the last 500 finished probe and transform jobs in this workspace.
- Runtime figures (`rssBytes`, `heapUsedBytes`, `uptimeSeconds`) are read from
  `process.memoryUsage()` and `process.uptime()` at request time.
- Storage figures (`mediaBytes`, `derivedBytes`, `cacheBytes`, `diskFreeBytes`) are
  computed by walking the storage directories and calling `statfs` on the data volume.
- Queue depth and failure counts are SQL counts, not estimates.

## What the numbers describe

This machine, single process, two workers, the bundled FFmpeg build. A p95 probe of a
2 s clip says nothing about a 4-hour master, and nothing about a different host. There
is no load generator and no comparative benchmark in this repository, and none is
claimed.

## Known cost centres

| Cost | Reason | Mitigation |
| --- | --- | --- |
| Full decode in analysis | measured loudness and decode health require reading every sample | bounded frame scans (600 s) for video-only scans; explicit note when truncated |
| Thumbnail generation | seeks and decodes one frame | cached per asset; only regenerated on request |
| Waveform | decodes the audio track at 8 kHz mono | bounded to 400 buckets, cached as JSON |
| Export bundling | reads and compresses every selected file | streamed, never buffered wholesale |
| SQLite writes | single file, WAL mode | short transactions, prepared statements, indexes on hot queries |

## Verified figures

Only one: the end-to-end analysis of a 5 s, 640×360 fixture (2 s testsrc, 1 s black,
2 s testsrc, AAC audio) completed as a single job in under 6 seconds wall clock on this
sandbox, including service round-trip and database write. That is a smoke observation,
not a benchmark.

## Unverified

- Memory ceilings under large uploads (2 GB cap is enforced by streaming, not tested at
  the cap).
- Concurrent job throughput above two workers.
- Browser-side performance (no browser available).
