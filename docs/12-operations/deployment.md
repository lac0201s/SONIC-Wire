# Deployment

## Two shapes

**One process (recommended).** Build once, serve everything from the API:

```bash
npm ci
npm run build                       # contracts → server → web
WEB_DIST_DIR=apps/web/dist COOKIE_SECURE=false npm start
```

`npm start` (`scripts/start.mjs`) starts the API, which serves the built SPA from
`WEB_DIST_DIR` and answers `/api/*` itself. One port, no proxy.

**Two processes (development).**

```bash
npm run dev        # API :8787 + Vite :5173 proxying /api
npm run dev:core   # optional analysis service :8791
```

`SONICWIRE_API_URL` changes the Vite proxy target.

## The analysis service

Optional. Without it the console states that measurements are unavailable; nothing
breaks and nothing is faked.

```bash
MEDIA_ROOT=$PWD/apps/server/var/media npm run dev:core
MEDIA_CORE_URL=http://127.0.0.1:8791 npm run dev:server
```

`run.sh` creates `services/media-core/.venv`, installs `requirements.txt` on first run,
and serves uvicorn on `MEDIA_CORE_PORT` (default 8791). For tests install
`requirements-dev.txt` as well.

Never publish port 8791: the service has no authentication and accepts absolute paths
(guarded only by `MEDIA_ROOT`).

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | 8787 | API port |
| `DATA_DIR` | `./var` | SQLite database, media, tmp, exports |
| `WEB_DIST_DIR` | unset | Set to serve the built SPA from the API |
| `MEDIA_CORE_URL` | unset | Enables deep analysis |
| `MEDIA_CORE_TIMEOUT_MS` | 120000 | Per-analysis timeout |
| `FFMPEG_PATH`, `FFPROBE_PATH` | bundled | Overrides binary discovery |
| `JOB_WORKERS` | 2 | Concurrent job workers |
| `MAX_UPLOAD_BYTES` | 2 GiB | Streaming cap |
| `MAX_DOWNLOAD_SECONDS` | 900 | URL ingestion time cap |
| `RATE_LIMIT_MAX` | 600 / min | Per client |
| `COOKIE_SECURE` | on in production | Off only for a throwaway HTTP instance |
| `ALLOW_PRIVATE_NETWORK` | false | Must stay false outside development |

## Backup and restore

Everything that matters lives in `DATA_DIR`:

```bash
tar czf sonicwire-backup-$(date +%F).tgz -C /path/to var
```

Restore by stopping the API, replacing `DATA_DIR`, and starting again — migrations are
append-only and applied at boot. Media files and the database must be restored together
or rows will point at missing files.

## Upgrading

1. Stop the API.
2. Back up `DATA_DIR`.
3. `git pull && npm ci && npm run build`.
4. Start. Pending migrations run in a transaction at boot; a failed migration leaves the
   schema untouched.

Python dependencies are pinned by range; `run.sh` reuses an existing venv. To refresh,
delete `services/media-core/.venv` and start again.

## What this deployment does not include

No container image, no systemd unit, no reverse-proxy config. The application is a
Node process plus an optional Python process; packaging decisions belong to the host.
