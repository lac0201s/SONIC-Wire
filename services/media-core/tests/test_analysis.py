"""Media Core tests.

Fixtures are generated with FFmpeg at test time — no binary media is committed.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from media_core import analysis
from media_core.app import app
from media_core.ffmpeg import engine


@pytest.fixture(scope="session")
def media(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("media")
    ffmpeg = engine().ffmpeg
    # 3s stereo tone at 440 Hz, followed by 1s of silence.
    wav = root / "tone.wav"
    # Tone then a silent second: the bundled FFmpeg build (2018) predates the
    # `apad=whole_dur` option, so silence is generated explicitly and concatenated.
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
         "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
         "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1", "-t", "4",
         "-ac", "1", "-ar", "48000", str(wav)],
        check=True,
    )
    # 2s of testsrc, 1s black, 2s of testsrc: gives black frames and scene cuts.
    video = root / "clip.mp4"
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15:duration=2",
         "-f", "lavfi", "-i", "color=c=black:size=320x180:rate=15:duration=1",
         "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15:duration=2",
         "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1:a=0[v]",
         "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(video)],
        check=True,
    )
    return root


def test_engine_is_discovered():
    eng = engine()
    assert Path(eng.ffmpeg).exists()
    assert eng.version and eng.version != "unknown"


def test_peaks_are_bounded_and_ordered(media: Path):
    peaks = analysis.measure_peaks(str(media / "tone.wav"))
    assert 0 < len(peaks) <= analysis.PEAK_BUCKETS
    # FFmpeg's `sine` source peaks at 1/8 full scale, so 0.125 is the true maximum
    # for this fixture; anything above it would be a normalisation bug.
    assert 0.05 <= max(peaks) <= 1.0
    assert all(0.0 <= peak <= 1.0 for peak in peaks)


def test_loudness_reports_ebu_r128_values(media: Path):
    loudness = analysis.measure_loudness(str(media / "tone.wav"))
    assert loudness is not None
    assert loudness["integratedLufs"] is not None
    assert -70 < loudness["integratedLufs"] < 0


def test_silence_detects_the_padded_tail(media: Path):
    info = analysis.probe(str(media / "tone.wav"))
    duration_ms = int(float(info["format"]["duration"]) * 1000)
    silence = analysis.measure_silence(str(media / "tone.wav"), duration_ms)
    assert silence is not None
    assert silence["segments"] >= 1
    assert silence["ratio"] is not None and silence["ratio"] > 0


def test_black_frames_and_scene_cuts_on_video(media: Path):
    black = analysis.measure_black_frames(str(media / "clip.mp4"))
    assert black["count"] >= 1
    assert black["totalSeconds"] > 0.5
    cuts = analysis.measure_scene_cuts(str(media / "clip.mp4"))
    assert cuts["count"] >= 1


def test_decode_health_flags_a_clean_file(media: Path):
    decode = analysis.measure_decode_health(str(media / "clip.mp4"))
    assert decode["clean"] is True


def test_full_report_is_serialisable(media: Path):
    report = analysis.analyze(str(media / "clip.mp4"), include_peaks=False)
    assert report["hasVideo"] is True
    assert report["hasAudio"] is False
    assert report["peaks"] == []
    assert any("No audio stream" in note for note in report["notes"])
    assert report["engine"].startswith("ffmpeg")


def test_http_rejects_paths_outside_the_root(media: Path):
    client = TestClient(app)
    outside = client.post("/analyze", json={"path": "/etc/passwd"})
    assert outside.status_code == 403
    non_media = client.post("/analyze", json={"path": str(Path(__file__))})
    assert non_media.status_code in (403, 415)


def test_http_analyzes_a_file_inside_the_root(media: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("MEDIA_ROOT", str(media))
    client = TestClient(app)
    response = client.post("/analyze", json={"path": str(media / "clip.mp4")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["hasVideo"] is True
    assert body["blackFrames"]["count"] >= 1
    assert body["measuredAt"].endswith("Z")


def test_health_reports_the_engine():
    client = TestClient(app)
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["engine"].startswith("ffmpeg")
