# Privacy model

## What leaves the machine

Nothing, by default. There is no telemetry, no analytics, no crash reporting, no remote
font or script origin, and no update check.

Two actions can create outbound traffic, and both are operator-initiated:

1. **URL ingestion** — the operator pastes a URL; the server fetches exactly that
   resource (plus redirects it re-validates). The request necessarily tells that host
   the machine's IP address. Nothing else is sent.
2. **Provider catalogue reads** — the catalogue is static, researched text. It makes no
   network calls. Connecting a provider is not implemented; if it were, it would be an
   explicit OAuth flow initiated by the operator.

## What is stored

| Data | Where | Retention |
| --- | --- | --- |
| Media files, derivatives, thumbnails, waveforms | `DATA_DIR/media/<workspace>/<asset>/` | until deleted by the owner |
| Library metadata, tags, collections | SQLite | until deleted |
| Probe facts and measurements | SQLite (`assets`, `asset_analysis`) | replaced on re-run; deleted with the asset |
| Job history and events | SQLite | last N per query; no automatic purge (documented, not hidden) |
| Audit ledger | SQLite | append-only |

Deleting an asset is a soft delete of the database row plus removal of its files; the
audit entry that records the deletion remains, by design.

## What is never collected

- No account identity beyond the email the owner types.
- No IP addresses in the audit log (the rate limiter keeps counters in memory).
- No media content in logs. Log lines carry asset ids, job ids, durations and error
  messages from FFmpeg.
- No cookies beyond the session cookie; no third-party cookies; no fingerprinting.

## Provider policy

The provider catalogue states, per service, what its official API permits and what it
does not. Where a service forbids downloading (YouTube ToS §III.E.1 / §III.I.14,
TikTok's Display API, Twitch's VOD terms), SonicWire classifies the provider as
*reference only* and refuses the download rather than scraping. That refusal is visible
in the UI and in `/api/providers`, with the provider's own restriction text.

## Operator responsibilities

- Bind the API to a network you trust; it has one owner account, not a user directory.
- Keep `media-core` off the public internet (no auth of its own).
- Back up `DATA_DIR` if the library matters; the database and media live there.
- Set `COOKIE_SECURE=true` behind TLS (it defaults on in production builds).
