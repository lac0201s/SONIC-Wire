#!/usr/bin/env bash
# Starts the analysis service. Idempotent: creates the venv and installs deps
# the first time, then runs uvicorn on MEDIA_CORE_PORT (default 8791).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${MEDIA_CORE_PORT:-8791}"
PYTHON="${PYTHON:-python3}"
VENV=".venv"

if [ ! -x "$VENV/bin/python" ]; then
  echo "media-core: creating virtualenv with $PYTHON"
  "$PYTHON" -m venv "$VENV"
fi

if ! "$VENV/bin/python" -c 'import fastapi, uvicorn, numpy' >/dev/null 2>&1; then
  echo "media-core: installing requirements"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet -r requirements.txt
fi

# Shared default: the Node server's media directory, so one install needs no config.
export MEDIA_ROOT="${MEDIA_ROOT:-$(cd ../.. && pwd)/apps/server/var/media}"
echo "media-core: serving on :$PORT, MEDIA_ROOT=$MEDIA_ROOT"
exec "$VENV/bin/python" -m uvicorn media_core.app:app --host 0.0.0.0 --port "$PORT" "$@"
