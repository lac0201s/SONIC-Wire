"""Media Core: deep analysis for SonicWire assets.

The service owns one job: given a path to a media file, measure what can be
measured with FFmpeg and numpy, and return plain JSON. It never mutates the file,
never writes to the media store, and refuses paths outside `MEDIA_ROOT`.
"""

__version__ = "0.1.0"
