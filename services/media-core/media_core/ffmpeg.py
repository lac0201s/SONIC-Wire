"""FFmpeg discovery and bounded execution.

Every subprocess is run with a timeout and its own process group so a cancelled
request kills the whole tree, mirroring the Node side's behaviour.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
from dataclasses import dataclass
from functools import lru_cache


class FFmpegUnavailable(RuntimeError):
    """Raised when no usable FFmpeg/FFprobe binary can be found."""


@dataclass(frozen=True)
class Engine:
    ffmpeg: str
    ffprobe: str
    version: str


def _candidate(name: str, env_var: str) -> str | None:
    explicit = os.environ.get(env_var)
    if explicit and os.path.isfile(explicit):
        return explicit
    on_path = shutil.which(name)
    if on_path:
        return on_path
    # Fall back to the binaries the Node workspace already installed, so a single
    # `npm install` provisions both runtimes identically.
    here = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    vendor = os.path.join(here, "node_modules", "@ffmpeg-installer", "linux-x64", name)
    return vendor if os.path.isfile(vendor) else None


@lru_cache(maxsize=1)
def engine() -> Engine:
    ffmpeg = _candidate("ffmpeg", "FFMPEG_PATH")
    ffprobe = _candidate("ffprobe", "FFPROBE_PATH")
    if not ffmpeg or not ffprobe:
        raise FFmpegUnavailable("FFmpeg/FFprobe not found; set FFMPEG_PATH and FFPROBE_PATH")
    try:
        out = subprocess.run(
            [ffmpeg, "-version"],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        ).stdout
    except (OSError, subprocess.SubprocessError) as exc:  # pragma: no cover - host dependent
        raise FFmpegUnavailable(str(exc)) from exc
    match = re.search(r"ffmpeg version (\S+)", out)
    return Engine(ffmpeg=ffmpeg, ffprobe=ffprobe, version=match.group(1) if match else "unknown")


@dataclass
class Run:
    stdout: bytes
    stderr: str
    returncode: int

    @property
    def log(self) -> str:
        return self.stderr


def run(args: list[str], *, timeout: float = 120.0, capture_stdout: bool = False) -> Run:
    """Run a command in its own process group with a hard timeout."""
    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE if capture_stdout else subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:  # pragma: no cover - race on exit
            pass
        proc.communicate()
        raise TimeoutError(f"command exceeded {timeout:.0f}s")
    return Run(stdout=stdout or b"", stderr=(stderr or b"").decode("utf-8", "replace"), returncode=proc.returncode)


def probe(path: str) -> dict:
    eng = engine()
    result = run(
        [eng.ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
        timeout=30,
        capture_stdout=True,
    )
    if result.returncode != 0 and not result.stdout:
        raise RuntimeError(result.log.strip() or "ffprobe failed")
    try:
        return json.loads(result.stdout or b"{}")
    except json.JSONDecodeError as exc:  # pragma: no cover - corrupt output
        raise RuntimeError("ffprobe returned malformed JSON") from exc
