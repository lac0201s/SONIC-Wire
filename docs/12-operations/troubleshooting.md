# Troubleshooting

Every entry states the symptom, the check, and the fix. If none of them apply, the
diagnostics export (`Observatory → Diagnostics`) contains versions, limits and runtime
facts with no secrets.

## "Analysis is not available in this deployment"

The API is running without `MEDIA_CORE_URL`.

```bash
curl -s localhost:8787/api/health | python3 -m json.tool   # look at checks.mediaCore
npm run dev:core                                           # start :8791
MEDIA_CORE_URL=http://127.0.0.1:8791 npm run dev:server    # restart the API with it
```

If the service is up but the API says unreachable, check the port and that both halves
see the same filesystem: `media-core` refuses paths outside `MEDIA_ROOT`, which defaults
to `apps/server/var/media`. When the API uses a different `DATA_DIR`, pass
`MEDIA_ROOT` to the service (or `MEDIA_ROOT=<data dir>` in its environment).

## "media-core rejected the file (403)"

The file is outside `MEDIA_ROOT`. Confirm both processes agree on the storage root:

```bash
curl -s localhost:8791/health   # mediaRoot field
```

## Lost the owner password

There is no remote reset. With filesystem access:

```bash
# stop the API first
DATA_DIR=/path/to/var node scripts/reset-owner.mjs --email owner@example.com
```

The script prints the new temporary password once. Sign in and change it immediately;
the reset is recorded in the audit log.

## Uploads over the limit are rejected

`MAX_UPLOAD_BYTES` (default 2 GiB) is enforced while streaming. The error is
`payload_too_large` with the limit in the message. Raise it in the environment, not in
code.

## A job is stuck in `running`

Workers hold a lease (`JOB_LEASE_SECONDS`, default 120) and send heartbeats. If the
process died, the lease expires and the job is retried up to `JOB_MAX_ATTEMPTS`. To
release immediately, restart the API; the queue re-scans on boot.

## A transform is refused before it starts

The preset's encoder is missing from the FFmpeg build (the bundled build is from 2018).
`/api/system/capabilities` lists encoders that were actually detected. Use another
preset or point `FFMPEG_PATH` at a newer binary.

## FFmpeg not found

The API discovers FFmpeg in this order: `FFMPEG_PATH`, `PATH`, the bundled npm
installers. Check with:

```bash
curl -s localhost:8787/api/health   # checks.ffmpeg.detail
```

On a host without the bundled installer, install FFmpeg or set both `FFMPEG_PATH` and
`FFPROBE_PATH`.

## Cookies are not set in production

Production marks cookies `Secure`. Without TLS in front, the browser drops them. Either
terminate TLS (correct) or set `COOKIE_SECURE=false` for a test instance only.

## "Reconnecting" in the console header

The SSE stream at `/api/events` failed. Reverse proxies must not buffer
`text/event-stream`; the Vite dev proxy already disables buffering. Job data still
loads by polling on refresh, and the header states the stream is reconnecting rather
than pretending it is live.

## Tests fail on media fixtures

Fixtures are generated with the bundled FFmpeg, which predates some filter options.
Run the media suites with the bundled binaries explicitly:

```bash
FFMPEG_PATH=$PWD/node_modules/@ffmpeg-installer/linux-x64/ffmpeg \
FFPROBE_PATH=$PWD/node_modules/@ffprobe-installer/linux-x64/ffprobe \
  npx vitest run --root apps/server
```
