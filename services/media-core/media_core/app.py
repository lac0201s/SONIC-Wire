"""HTTP surface of Media Core.

Boundary contract with the Node API:
  GET  /health   → {"status": "ok", "engine": "ffmpeg …", "mediaRoot": "…"}
  POST /analyze  → {"path": "<absolute path inside MEDIA_ROOT>", "includePeaks": bool}
                   → the analysis payload (see analysis.Report)

The service refuses any path outside MEDIA_ROOT and any non-media extension, so a
compromised caller cannot read arbitrary files. It never writes to disk.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import __version__
from .analysis import analyze
from .ffmpeg import FFmpegUnavailable, engine

MEDIA_EXTENSIONS = {
    ".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi",
    ".mp3", ".wav", ".flac", ".opus", ".ogg", ".m4a", ".aac",
    ".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff",
}

# Defaults to the Node server's media directory so a single-machine install needs
# no configuration; MEDIA_ROOT overrides it.
DEFAULT_ROOT = Path(__file__).resolve().parents[3] / "apps" / "server" / "var" / "media"


def media_root() -> Path:
    return Path(os.environ.get("MEDIA_ROOT", str(DEFAULT_ROOT))).resolve()


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str = Field(min_length=1, max_length=4096)
    include_peaks: bool = False


class AnalyzeResponse(BaseModel):
    durationMs: int | None
    hasVideo: bool
    hasAudio: bool
    loudness: dict | None = None
    silence: dict | None = None
    blackFrames: dict | None = None
    sceneCuts: dict | None = None
    decode: dict | None = None
    signal: dict | None = None
    peaks: list[float]
    peakCount: int
    notes: list[str]
    measuredAt: str
    engine: str


app = FastAPI(title="SonicWire Media Core", version=__version__)


@app.get("/health")
def health() -> dict:
    try:
        eng = engine()
        return {
            "status": "ok",
            "version": __version__,
            "engine": f"ffmpeg {eng.version}",
            "mediaRoot": str(media_root()),
        }
    except FFmpegUnavailable as exc:
        return {"status": "degraded", "version": __version__, "error": str(exc)}


@app.post("/analyze", response_model=AnalyzeResponse)
def post_analyze(request: AnalyzeRequest) -> dict:
    root = media_root()
    candidate = Path(request.path).resolve()
    if root not in candidate.parents and candidate != root:
        raise HTTPException(status_code=403, detail="Path is outside the media root")
    if candidate.suffix.lower() not in MEDIA_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Not a media file")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        return analyze(str(candidate), include_peaks=request.include_peaks)
    except FFmpegUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
