"""The measurements Media Core performs.

Each function returns numbers derived from FFmpeg output plus the parsing notes
that justify them. Nothing here is estimated or sampled silently: where a scan is
bounded (e.g. the first N seconds), the bound is returned in the payload so the
interface can state it.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np

from .ffmpeg import engine, probe, run

FRAME_SCAN_LIMIT_SECONDS = 600
PEAK_BUCKETS = 400
PEAK_SAMPLE_RATE = 8000

_BLACK_RE = re.compile(r"black_start:([0-9.]+)\s+black_end:([0-9.]+)")
_SILENCE_START_RE = re.compile(r"silence_start:\s*(-?[0-9.]+)")
_SILENCE_END_RE = re.compile(r"silence_end:\s*([0-9.]+)")
_SCENE_RE = re.compile(r"pts_time:([0-9.]+)")
_LOUDNORM_RE = re.compile(r"\{[^{}]*\"input_i\"[^{}]*\}", re.S)


@dataclass
class Report:
    duration_ms: int | None = None
    has_video: bool = False
    has_audio: bool = False
    loudness: dict | None = None
    silence: dict | None = None
    black_frames: dict | None = None
    scene_cuts: dict | None = None
    decode: dict | None = None
    signal: dict | None = None
    peaks: list[float] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "durationMs": self.duration_ms,
            "hasVideo": self.has_video,
            "hasAudio": self.has_audio,
            "loudness": self.loudness,
            "silence": self.silence,
            "blackFrames": self.black_frames,
            "sceneCuts": self.scene_cuts,
            "decode": self.decode,
            "signal": self.signal,
            "peaks": self.peaks,
            "peakCount": len(self.peaks),
            "notes": self.notes,
            "measuredAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "engine": f"ffmpeg {engine().version}",
        }


def _float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def measure_loudness(path: str) -> dict | None:
    """EBU R128 integrated loudness, true peak and loudness range."""
    eng = engine()
    result = run(
        [
            eng.ffmpeg,
            "-nostats",
            "-hide_banner",
            "-i",
            path,
            "-map",
            "0:a:0",
            "-af",
            "loudnorm=I=-16:TP=-1.5:print_format=json",
            "-f",
            "null",
            "-",
        ],
        timeout=180,
    )
    match = _LOUDNORM_RE.search(result.log)
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:  # pragma: no cover - ffmpeg format change
        return None
    return {
        "integratedLufs": _float(payload.get("input_i")),
        "truePeakDb": _float(payload.get("input_tp")),
        "rangeLu": _float(payload.get("input_lra")),
        "thresholdLufs": _float(payload.get("input_thresh")),
    }


def measure_silence(path: str, duration_ms: int | None) -> dict | None:
    eng = engine()
    result = run(
        [eng.ffmpeg, "-nostats", "-hide_banner", "-i", path, "-map", "0:a:0",
         "-af", "silencedetect=n=-50dB:d=0.5", "-f", "null", "-"],
        timeout=180,
    )
    starts = [float(value) for value in _SILENCE_START_RE.findall(result.log)]
    ends = [float(value) for value in _SILENCE_END_RE.findall(result.log)]
    if not starts and not ends and "silencedetect" not in result.log:
        return None
    total = 0.0
    for index, start in enumerate(starts):
        end = ends[index] if index < len(ends) else (duration_ms or 0) / 1000
        total += max(0.0, end - start)
    duration_s = (duration_ms or 0) / 1000
    return {
        "segments": len(starts),
        "silenceSeconds": round(total, 3),
        "ratio": round(total / duration_s, 4) if duration_s > 0 else None,
        "thresholdDb": -50,
        "minSeconds": 0.5,
    }


def measure_black_frames(path: str) -> dict:
    eng = engine()
    result = run(
        [eng.ffmpeg, "-nostats", "-hide_banner", "-t", str(FRAME_SCAN_LIMIT_SECONDS), "-i", path,
         "-an", "-vf", "blackdetect=d=0.1:pix_th=0.10", "-f", "null", "-"],
        timeout=240,
    )
    spans = _BLACK_RE.findall(result.log)
    total = sum(max(0.0, float(end) - float(start)) for start, end in spans)
    return {
        "count": len(spans),
        "totalSeconds": round(total, 3),
        "longestSeconds": round(max((float(e) - float(s) for s, e in spans), default=0.0), 3),
        "scannedSeconds": FRAME_SCAN_LIMIT_SECONDS,
    }


def measure_scene_cuts(path: str) -> dict:
    eng = engine()
    result = run(
        [eng.ffmpeg, "-nostats", "-hide_banner", "-t", str(FRAME_SCAN_LIMIT_SECONDS), "-i", path,
         "-an", "-vf", "select='gt(scene,0.3)',metadata=print", "-f", "null", "-"],
        timeout=240,
    )
    times = [float(value) for value in _SCENE_RE.findall(result.log)]
    return {
        "count": len(times),
        "threshold": 0.3,
        "scannedSeconds": FRAME_SCAN_LIMIT_SECONDS,
    }


def measure_decode_health(path: str) -> dict:
    """Decode the whole file and count the errors FFmpeg reports."""
    eng = engine()
    result = run([eng.ffmpeg, "-nostats", "-hide_banner", "-v", "error", "-i", path, "-f", "null", "-"], timeout=600)
    lines = [line for line in result.log.splitlines() if line.strip()]
    return {
        "errors": len(lines),
        "returncode": result.returncode,
        "clean": len(lines) == 0 and result.returncode == 0,
        "firstError": lines[0][:200] if lines else None,
    }


def measure_signal(path: str) -> dict | None:
    """Mean luma and saturation over the scanned window (video only)."""
    eng = engine()
    result = run(
        [eng.ffmpeg, "-nostats", "-hide_banner", "-t", "30", "-i", path, "-an",
         "-vf", "signalstats,metadata=print", "-f", "null", "-"],
        timeout=120,
    )
    y_values = [float(v) for v in re.findall(r"lavfi\.signalstats\.YAVG=([0-9.]+)", result.log)]
    sat_values = [float(v) for v in re.findall(r"lavfi\.signalstats\.SATAVG=([0-9.]+)", result.log)]
    if not y_values:
        return None
    return {
        "meanLuma": round(sum(y_values) / len(y_values), 2),
        "meanSaturation": round(sum(sat_values) / len(sat_values), 2) if sat_values else None,
        "sampledFrames": len(y_values),
    }


def measure_peaks(path: str) -> list[float]:
    """Bucketed absolute peaks, computed with numpy from raw PCM."""
    eng = engine()
    result = run(
        [eng.ffmpeg, "-nostats", "-hide_banner", "-v", "error", "-i", path, "-map", "0:a:0",
         "-ac", "1", "-ar", str(PEAK_SAMPLE_RATE), "-f", "s16le", "-"],
        timeout=300,
        capture_stdout=True,
    )
    if not result.stdout:
        return []
    samples = np.frombuffer(result.stdout, dtype="<i2").astype(np.float32) / 32768.0
    if samples.size == 0:
        return []
    samples = np.abs(samples)
    bucket_count = min(PEAK_BUCKETS, samples.size)
    edges = np.linspace(0, samples.size, bucket_count + 1).astype(int)
    peaks = [float(samples[start:end].max()) if end > start else 0.0 for start, end in zip(edges[:-1], edges[1:])]
    return [round(min(1.0, peak), 4) for peak in peaks]


def analyze(path: str, *, include_peaks: bool = False) -> dict:
    info = probe(path)
    streams = info.get("streams", [])
    has_video = any(stream.get("codec_type") == "video" for stream in streams)
    has_audio = any(stream.get("codec_type") == "audio" for stream in streams)
    duration_raw = info.get("format", {}).get("duration")
    duration_ms = int(float(duration_raw) * 1000) if duration_raw not in (None, "N/A") else None

    report = Report(duration_ms=duration_ms, has_video=has_video, has_audio=has_audio)
    report.decode = measure_decode_health(path)
    if has_audio:
        report.loudness = measure_loudness(path)
        report.silence = measure_silence(path, duration_ms)
        if include_peaks:
            report.peaks = measure_peaks(path)
    else:
        report.notes.append("No audio stream: loudness, silence and peaks were not measured.")
    if has_video:
        report.black_frames = measure_black_frames(path)
        report.scene_cuts = measure_scene_cuts(path)
        report.signal = measure_signal(path)
    else:
        report.notes.append("No video stream: black-frame, scene-cut and signal scans were skipped.")
    if duration_ms and duration_ms > FRAME_SCAN_LIMIT_SECONDS * 1000:
        report.notes.append(
            f"Frame scans covered the first {FRAME_SCAN_LIMIT_SECONDS}s of a {duration_ms // 1000}s file."
        )
    return report.as_dict()
