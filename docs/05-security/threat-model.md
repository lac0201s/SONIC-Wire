# Threat model

Scope: a single-owner, local-first installation. The threat model is about the machine
it runs on and the network it is exposed to, not about multi-tenant isolation.

## Assets

1. Media files and their derivatives (the user's reason for installing this).
2. The SQLite database: assets, tags, collections, jobs, audit log, settings.
3. Credentials: the owner password hash, session tokens, provider tokens (encrypted
   with a workspace cipher when present).
4. The host: FFmpeg is a native binary processing untrusted bytes.

## Trust boundaries

```
browser ──HTTPS/HTTP──▶ Fastify API ──▶ SQLite (local file)
                              │
                              ├──▶ storage (local dirs)
                              ├──▶ FFmpeg/FFprobe child processes (untrusted input)
                              └──▶ media-core (HTTP, internal only)
```

`media-core` has no authentication of its own. It must be bound to loopback or a
private network; it is never a public endpoint. It accepts absolute paths, which is why
`MEDIA_ROOT` is enforced by `Path.resolve()` before any file is opened.

## Threats and mitigations

| Threat | Mitigation | Where |
| --- | --- | --- |
| SSRF through URL ingestion (metadata endpoints, localhost, private ranges) | Scheme allowlist, DNS resolution before connect, private/link-local/loopback rejection, redirect re-validation per hop, byte and time caps | `acquisition/url-guard.ts`, `acquisition/download.ts` |
| Stored XSS through filenames, tags or metadata | React escapes by default; no `dangerouslySetInnerHTML` anywhere; JSON metadata rendered as text | `apps/web/src` |
| CSRF | Session cookie is `SameSite=Lax`, state-changing requests require the `x-sonicwire-csrf` header matching the session token | `http/auth-plugin.ts` |
| Session theft | scrypt password hashing with per-user salt, server-side session rows with TTL, `HttpOnly` cookie, `Secure` when `COOKIE_SECURE` is on | `modules/auth/service.ts` |
| Brute force | Rate limiting per IP and per route class; failed logins audited | `http/app.ts`, `modules/audit` |
| Path traversal | Uploads land under generated IDs; downloads resolved through the storage layer; `media-core` refuses anything outside `MEDIA_ROOT` | `modules/storage/storage.ts`, `media_core/app.py` |
| Command injection | FFmpeg is invoked with an argument array and an allowlist of presets; no shell, no string interpolation | `media/process.ts`, `media/presets.ts` |
| Zip bomb / huge export | Streaming ZIP writer with per-file size accounting and entry caps | `media/zip.ts` |
| Resource exhaustion | Upload/download byte caps, `MAX_DOWNLOAD_SECONDS`, job timeouts, worker count, per-job process groups killed with SIGKILL | `env.ts`, `media/process.ts` |
| Malicious media exploiting FFmpeg | Bundled FFmpeg build, no network features used, timeouts, no shell; residual risk accepted (see risk register R-04) | `media/ffmpeg.ts` |
| Token leakage in logs | Logs record ids and counts, never tokens or file contents; provider tokens encrypted at rest | `logger.ts`, `providers/registry.ts` |

## Explicit non-goals

- Multi-user isolation. There is one owner and one workspace; roles exist in the schema
  for the future, not for a current boundary.
- Protection against a hostile local user with filesystem access. Such a user can read
  the database and the media directly; the app does not claim otherwise.

## Verification

Security-relevant tests that actually run: URL guard (24 cases), auth service,
CSRF rejection on state-changing routes, storage path handling (6 cases), analysis path
guard (403/415). What is **not** verified: a penetration test, dependency CVE scanning
(no network access to advisory databases), and TLS termination (out of process).
