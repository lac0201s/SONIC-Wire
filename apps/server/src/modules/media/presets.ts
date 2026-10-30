import type { AssetKind, PresetDescriptor, TransformPresetId } from '@sonicwire/contracts';
import { AppError } from '../../http/errors.js';

export interface PresetBuildInput {
  durationMs: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  trim?: { startMs: number; endMs: number } | undefined;
}

export interface PresetBuildResult {
  args: string[];
  outputExtension: string;
  outputKind: AssetKind;
}

export interface PresetDefinition extends PresetDescriptor {
  requiredEncoders: string[];
  build: (input: PresetBuildInput) => PresetBuildResult;
}

const VIDEO_COPY_COMPATIBLE = new Set(['h264', 'hevc']);

function trimArgs(input: PresetBuildInput): string[] {
  if (!input.trim) return [];
  const start = Math.max(0, input.trim.startMs);
  const end = Math.max(start + 50, input.trim.endMs);
  const duration = (end - start) / 1000;
  return ['-ss', (start / 1000).toFixed(3), '-t', duration.toFixed(3)];
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'audio.mp3.192',
    label: 'MP3 · 192 kbps',
    description: 'Widely compatible lossy audio for phones, cars and web players.',
    outputExtension: '.mp3',
    outputKind: 'audio',
    accepts: ['audio', 'video'],
    approx: '≈1.4 MB / minute',
    requiredEncoders: ['libmp3lame'],
    build: (input) => ({
      args: [...trimArgs(input), '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '48000'],
      outputExtension: '.mp3',
      outputKind: 'audio',
    }),
  },
  {
    id: 'audio.wav.16',
    label: 'WAV · 16-bit PCM',
    description: 'Uncompressed 48 kHz PCM for editing and DAW import.',
    outputExtension: '.wav',
    outputKind: 'audio',
    accepts: ['audio', 'video'],
    approx: '≈5.5 MB / minute',
    requiredEncoders: ['pcm_s16le'],
    build: (input) => ({
      args: [...trimArgs(input), '-vn', '-c:a', 'pcm_s16le', '-ar', '48000'],
      outputExtension: '.wav',
      outputKind: 'audio',
    }),
  },
  {
    id: 'audio.flac',
    label: 'FLAC · lossless',
    description: 'Lossless archiving. Cannot restore detail that a lossy source already lost.',
    outputExtension: '.flac',
    outputKind: 'audio',
    accepts: ['audio', 'video'],
    approx: '≈60% of source audio size',
    requiredEncoders: ['flac'],
    build: (input) => ({
      args: [...trimArgs(input), '-vn', '-c:a', 'flac', '-compression_level', '5'],
      outputExtension: '.flac',
      outputKind: 'audio',
    }),
  },
  {
    id: 'audio.opus.128',
    label: 'Opus · 128 kbps',
    description: 'Efficient speech and music audio for modern browsers and streams.',
    outputExtension: '.opus',
    outputKind: 'audio',
    accepts: ['audio', 'video'],
    approx: '≈0.9 MB / minute',
    requiredEncoders: ['libopus'],
    build: (input) => ({
      args: [...trimArgs(input), '-vn', '-c:a', 'libopus', '-b:a', '128k', '-ar', '48000'],
      outputExtension: '.opus',
      outputKind: 'audio',
    }),
  },
  {
    id: 'video.mp4.1080p',
    label: 'MP4 · H.264 1080p',
    description: 'H.264 + AAC at CRF 21, faststart enabled for progressive web playback.',
    outputExtension: '.mp4',
    outputKind: 'video',
    accepts: ['video'],
    approx: '≈12–25 MB / minute',
    requiredEncoders: ['libx264', 'aac'],
    build: (input) => ({
      args: [
        ...trimArgs(input),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-vf',
        "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:flags=lanczos",
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '21',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-movflags',
        '+faststart',
      ],
      outputExtension: '.mp4',
      outputKind: 'video',
    }),
  },
  {
    id: 'video.mp4.720p',
    label: 'MP4 · H.264 720p',
    description: 'Lighter H.264 rendition for review links and mobile playback.',
    outputExtension: '.mp4',
    outputKind: 'video',
    accepts: ['video'],
    approx: '≈6–12 MB / minute',
    requiredEncoders: ['libx264', 'aac'],
    build: (input) => ({
      args: [
        ...trimArgs(input),
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-vf',
        "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:flags=lanczos",
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
      ],
      outputExtension: '.mp4',
      outputKind: 'video',
    }),
  },
  {
    id: 'video.remux.mp4',
    label: 'Remux · MP4 copy',
    description: 'Repackages streams without re-encoding. Only valid for H.264/HEVC + AAC/MP3 sources.',
    outputExtension: '.mp4',
    outputKind: 'video',
    accepts: ['video'],
    approx: '≈ source size',
    requiredEncoders: [],
    build: (input) => {
      if (!VIDEO_COPY_COMPATIBLE.has(input.videoCodec ?? '')) {
        throw new AppError(
          'unsupported_media',
          `Remux to MP4 is not valid for ${input.videoCodec ?? 'this'} video. Use an H.264 transcode instead.`,
        );
      }
      return {
        args: [...trimArgs(input), '-map', '0', '-c', 'copy', '-movflags', '+faststart'],
        outputExtension: '.mp4',
        outputKind: 'video',
      };
    },
  },
  {
    id: 'video.audio-strip',
    label: 'Strip audio track',
    description: 'Keeps the video stream untouched and removes audio entirely.',
    outputExtension: '.mp4',
    outputKind: 'video',
    accepts: ['video'],
    approx: '≈ video stream size',
    requiredEncoders: [],
    build: (input) => ({
      args: [...trimArgs(input), '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart'],
      outputExtension: '.mp4',
      outputKind: 'video',
    }),
  },
  {
    id: 'image.jpeg.2048',
    label: 'JPEG · 2048 px',
    description: 'Downscaled still image for previews and social covers.',
    outputExtension: '.jpg',
    outputKind: 'image',
    accepts: ['image'],
    approx: '≈0.3–1 MB',
    requiredEncoders: ['mjpeg'],
    build: (input) => ({
      args: [
        '-frames:v',
        '1',
        '-vf',
        "scale='min(2048,iw)':-2:flags=lanczos",
        '-q:v',
        '3',
      ],
      outputExtension: '.jpg',
      outputKind: 'image',
    }),
  },
];

export function presetById(id: TransformPresetId): PresetDefinition {
  const preset = PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new AppError('bad_request', `Unknown transform preset: ${id}`);
  return preset;
}

export function presetDescriptors(): PresetDescriptor[] {
  return PRESETS.map(({ requiredEncoders: _required, build: _build, ...descriptor }) => descriptor);
}
