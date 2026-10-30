# ADR-0001 — Node.js + TypeScript + Fastify, not Go

**Status:** accepted · 2026-10-30

## Context

The PRD listed Go as a *candidate* for the backend and required that the choice be
verified against the toolchain that actually exists. Recon found: Node 22.22.3 with
`node:sqlite`, no Go toolchain installed, FFmpeg reachable as static binaries, and an
npm registry that resolves normally. The product needs one media engine, one
database, HTTP streaming, and a shared type surface with a React client.

## Decision

Build the API in TypeScript on Node 22 with Fastify 5, ESM only, strict mode.

## Alternatives

| Alternative | Why rejected |
| --- | --- |
| Go (net/http or Chi) | Excellent for this workload, but: no Go toolchain present, FFmpeg integration would be a second language boundary, and the contract types would need codegen (protobuf/OpenAPI) to stay shared with the React client. Choosing Go would have honoured the PRD's example, not its requirement. |
| Node + Express | Express 4's middleware model and typings lag behind Fastify; Fastify's schema-aware routing, injection-based testing and Pino logging cover three needs in one dependency. |
| Node + Hono | Attractive, but the multipart, cookie, rate-limit and SSE middleware ecosystem is thinner, and `app.inject` equivalents would be hand-rolled. |
| Bun / Deno | `node:sqlite` and `@ffmpeg-installer` compatibility is not guaranteed in this sandbox; an unverified runtime would violate the "verify available tooling" mandate. |

## Consequences

- One language across contracts, server and web; a schema change breaks all three.
- `node:sqlite` is experimental: the API prints an `ExperimentalWarning` at boot. This
  is accepted and documented; the data layer is isolated in `db/index.ts` so a swap to
  `better-sqlite3` or Postgres is a single-module change.
- CPU-bound work must not run on the event loop; every heavy operation is a child
  process (FFmpeg) or a bounded queue job (ADR-0003).
