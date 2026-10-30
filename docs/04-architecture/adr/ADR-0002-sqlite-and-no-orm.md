# ADR-0002 — SQLite via `node:sqlite`, no ORM

**Status:** accepted · 2026-10-30

## Context

The product is a local-first, single-owner media tool. It must run on one machine
with no services to install, survive process restarts with in-flight jobs, and keep
an audit ledger. Expected write volume is low (tens of writes per minute at peak);
read volume is moderate (library browsing, observatory polling every 2 s).

## Decision

Use SQLite through the runtime's built-in `node:sqlite` (`DatabaseSync`), WAL mode,
foreign keys on, forward-only migrations, and hand-written SQL in a repository layer.
No ORM, no query builder.

## Alternatives

| Alternative | Why rejected |
| --- | --- |
| Postgres | A service to install, secure and back up — directly contradicts "local-first, one machine". |
| `better-sqlite3` | Native addon; would add a compile step and prebuild dependency. `node:sqlite` is faster to deploy and sufficient. |
| Prisma / Drizzle | Mapping layers between the product and the facts stored would obscure exactly the invariants this product sells (hashes, lease state, stream facts). Migration tooling is unnecessary for one schema file. |
| JSON files on disk | Loses transactions, indexes, and the lease recovery primitive the queue depends on. |

## Consequences

- Writes are serialised by SQLite; the queue uses short transactions and never holds
  one across an FFmpeg run.
- `DatabaseSync` is synchronous, which is acceptable because every query is indexed
  and returns small rows; the 2 s observatory poll measured sub-millisecond query time.
- Backups are a file copy plus a checkpoint — documented in `docs/12-operations/deployment.md`.
- The experimental status of `node:sqlite` is a known risk (R-01) with a one-module
  escape hatch.
