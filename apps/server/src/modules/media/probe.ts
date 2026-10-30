import { z } from 'zod';
import type {
  AssetKind,
  ProbeSummary,
  QualityFacts,
  StreamInfo,
} from '@sonicwire/contracts';
import { AppError } from '../../http/errors.js';
import { ffprobe, toolchain } from './ffmpeg.js';

const RationalSchema = z.string().optional().nullable();

const FfprobeStreamSchema = z
  .object({
    index: z.number(),
    codec_name: z.string().optional().nullable(),
    codec_type: z.string().optional().nullable(),
    profile: z.string().optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    pix_fmt: z.string().optional().nullable(),
    color_space: z.string().optional().nullable(),
    color_transfer: z.string().optional().nullable(),
    color_primaries: z.string().optional().nullable(),
    r_frame_rate: RationalSchema,
    avg_frame_rate: RationalSchema,
    bit_rate: z.string().optional().nullable(),
    sample_rate: z.string().optional().nullable(),
    channels: z.number().optional().nullable(),
    channel_layout: z.string().optional().nullable(),
    bits_per_raw_sample: z.string().optional().nullable(),
    bits_per_sample: z.number().optional().nullable(),
    duration: z.string().optional().nullable(),
    disposition: z.record(z.string(), z.number()).optional(),
    tags: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const FfprobeFormatSchema = z
  .object({
    format_name: z.string().optional().nullable(),
    format_long_name: z.string().optional().nullable(),
    duration: z.string().optional().nullable(),
    size: z.string().optional().nullable(),
    bit_rate: z.string().optional().nullable(),
    tags: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

const FfprobeOutputSchema = z.object({
  streams: z.array(FfprobeStreamSchema).default([]),
  format: FfprobeFormatSchema.default({}),
});

export interface ProbeResult {
  summary: ProbeSummary;
  streams: StreamInfo[];
  quality: QualityFacts;
  kind: AssetKind;
  mimeType: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  bitRate: number | null;
  metadata: Record<string, string>;
  titleHint: string | null;
}

const LOSSLESS_AUDIO = new Set(['flac', 'alac', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'wavpack', 'ape']);
const HDR_TRANSFERS = new Set(['smpte2084', 'arib-std-b67']);

function parseRational(value: string | null | undefined): number | null {
  if (!value) return null;
  const [numRaw, denRaw] = value.split('/');
  const num = Number(numRaw);
  const den = Number(denRaw ?? '1');
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  const result = num / den;
  return Number.isFinite(result) && result > 0 ? Number(result.toFixed(3)) : null;
}

const toInt = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const CONTAINER_BY_EXTENSION: Record<string, string> = {
  '.mp4': 'MP4',
  '.m4v': 'MP4',
  '.mov': 'MOV',
  '.m4a': 'M4A',
  '.mkv': 'MATROSKA',
  '.webm': 'WEBM',
  '.avi': 'AVI',
  '.ts': 'MPEGTS',
  '.mp3': 'MP3',
  '.wav': 'WAV',
  '.flac': 'FLAC',
  '.ogg': 'OGG',
  '.oga': 'OGG',
  '.opus': 'OPUS',
  '.aac': 'AAC',
  '.jpg': 'MJPEG',
  '.jpeg': 'MJPEG',
  '.png': 'PNG',
  '.webp': 'WEBP',
  '.avif': 'AVIF',
};

/**
 * FFprobe reports container families ("mov,mp4,m4a,3gp,3g2,mj2"), so the file
 * extension is used to pick the concrete container when the family matches.
 */
const containerLabel = (formatName: string | null | undefined, filePath: string): string | null => {
  if (!formatName) return null;
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  const fromExtension = CONTAINER_BY_EXTENSION[extension];
  if (fromExtension) return fromExtension;
  if (formatName.includes('image2')) return 'IMAGE2';
  const primary = formatName.split(',')[0];
  return primary ? primary.toUpperCase() : null;
};

const MIME_BY_CONTAINER: Record<string, string> = {
  MOV: 'video/quicktime',
  MP4: 'video/mp4',
  M4A: 'audio/mp4',
  MJPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  AVIF: 'image/avif',
  OPUS: 'audio/opus',
  AAC: 'audio/aac',
  MATROSKA: 'video/x-matroska',
  WEBM: 'video/webm',
  AVI: 'video/x-msvideo',
  MPEGTS: 'video/mp2t',
  MP3: 'audio/mpeg',
  FLAC: 'audio/flac',
  OGG: 'audio/ogg',
  WAV: 'audio/wav',
  IMAGE2: 'image/jpeg',
  PNG_PIPE: 'image/png',
};

export async function probeFile(filePath: string, signal?: AbortSignal): Promise<ProbeResult> {
  const result = await ffprobe(
    [
      '-hide_banner',
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      '-show_error',
      filePath,
    ],
    { timeoutMs: 120_000, signal, maxStdoutBytes: 8 * 1024 * 1024 },
  );

  if (result.code !== 0) {
    const detail = result.stderr.trim().split('\n').slice(-3).join(' ').slice(0, 300);
    throw new AppError(
      'unsupported_media',
      'The file could not be read as media. It may be corrupt, truncated, or an unsupported format.',
      { detail: detail || null },
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(result.stdout);
  } catch {
    throw new AppError('unsupported_media', 'Media probe returned an unreadable payload');
  }
  const parsed = FfprobeOutputSchema.parse(raw);
  const status = await toolchain();

  const hasAttachedArt = parsed.streams.some((s) => (s.disposition?.attached_pic ?? 0) === 1);
  const realVideo = parsed.streams.filter(
    (s) => s.codec_type === 'video' && (s.disposition?.attached_pic ?? 0) !== 1,
  );
  const audioStreams = parsed.streams.filter((s) => s.codec_type === 'audio');
  const formatName = parsed.format.format_name ?? null;

  const kind: AssetKind = realVideo.length > 0
    ? 'video'
    : audioStreams.length > 0
      ? 'audio'
      : formatName?.includes('image')
        ? 'image'
        : 'unknown';

  const streams: StreamInfo[] = parsed.streams.map((stream) => {
    const type = (stream.codec_type ?? 'data') as StreamInfo['type'];
    const frameRate = parseRational(stream.avg_frame_rate) ?? parseRational(stream.r_frame_rate);
    const nominalRate = parseRational(stream.r_frame_rate);
    const frameRateMode: StreamInfo['frameRateMode'] =
      type !== 'video'
        ? 'unknown'
        : nominalRate && frameRate && Math.abs(nominalRate - frameRate) / nominalRate > 0.02
          ? 'variable'
          : frameRate
            ? 'constant'
            : 'unknown';
    const hdr = HDR_TRANSFERS.has((stream.color_transfer ?? '').toLowerCase());
    const tags = Object.fromEntries(
      Object.entries(stream.tags ?? {}).map(([key, value]) => [key.toLowerCase(), value]),
    );
    return {
      index: stream.index,
      type,
      codec: stream.codec_name ?? null,
      profile: stream.profile ?? null,
      width: stream.width ?? null,
      height: stream.height ?? null,
      frameRate,
      frameRateMode,
      bitRate: toInt(stream.bit_rate),
      sampleRate: toInt(stream.sample_rate),
      channels: stream.channels ?? null,
      channelLayout: stream.channel_layout ?? null,
      bitDepth: toInt(stream.bits_per_raw_sample) ?? stream.bits_per_sample ?? null,
      pixelFormat: stream.pix_fmt ?? null,
      colorSpace: stream.color_space ?? null,
      colorTransfer: stream.color_transfer ?? null,
      hdr,
      language: tags['language'] ?? null,
      title: tags['title'] ?? null,
    };
  });

  const primaryVideo = streams.find((s) => s.type === 'video' && s.width && s.height) ?? null;
  const primaryAudio = streams.find((s) => s.type === 'audio') ?? null;
  const durationMs = parsed.format.duration
    ? Math.round(Number(parsed.format.duration) * 1000)
    : (() => {
        const streamDuration = parsed.streams
          .map((s) => Number(s.duration))
          .filter((value) => Number.isFinite(value));
        return streamDuration.length > 0 ? Math.round(Math.max(...streamDuration) * 1000) : null;
      })();
  const bitRate = toInt(parsed.format.bit_rate) ?? primaryVideo?.bitRate ?? null;
  const container = containerLabel(formatName, filePath);
  const mimeType = container ? (MIME_BY_CONTAINER[container] ?? null) : null;

  const warnings: string[] = [];
  if (kind === 'audio' && hasAttachedArt) warnings.push('Contains embedded cover artwork');
  const variableFrameRate = streams.some((s) => s.frameRateMode === 'variable');
  if (variableFrameRate) warnings.push('Variable frame rate detected — frame counts will not map 1:1 to time');
  if (kind === 'video' && !primaryAudio) warnings.push('No audio stream present');
  if (durationMs === null) warnings.push('Duration is unknown; seek and trim may be approximate');
  if (streams.some((s) => s.hdr)) warnings.push('HDR transfer function present; SDR outputs will be tone-mapped by the player');
  if (streams.some((s) => s.type === 'subtitle')) warnings.push('Subtitle tracks present');

  const metadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed.format.tags ?? {})) {
    if (value && value.length < 500) metadata[key.toLowerCase()] = value;
  }

  const titleHint =
    metadata['title'] ?? metadata['artist'] ?? null;

  const quality: QualityFacts = {
    videoResolution: primaryVideo ? `${primaryVideo.width}×${primaryVideo.height}` : null,
    videoBitrate: primaryVideo?.bitRate ?? null,
    audioBitrate: primaryAudio?.bitRate ?? null,
    sampleRate: primaryAudio?.sampleRate ?? null,
    channels: primaryAudio?.channels ?? null,
    hdr: streams.some((s) => s.hdr),
    variableFrameRate,
    lossyAudio: primaryAudio ? !LOSSLESS_AUDIO.has(primaryAudio.codec ?? '') : false,
    notes: [],
  };
  if (quality.lossyAudio) {
    quality.notes.push('Source audio is lossy — a lossless container does not restore lost detail.');
  }
  if (kind === 'video' && primaryVideo && (primaryVideo.width ?? 0) < 1280) {
    quality.notes.push('Source resolution is below 720p; upscaling cannot add real detail.');
  }

  const summary: ProbeSummary = {
    formatName,
    formatLongName: parsed.format.format_long_name ?? null,
    container,
    durationMs,
    sizeBytes: toInt(parsed.format.size),
    bitRate,
    streamCount: streams.length,
    probeScore: null,
    colorPrimaries: parsed.streams.find((s) => s.color_primaries)?.color_primaries ?? null,
    hasCoverArt: hasAttachedArt,
    warnings,
    probedAt: new Date().toISOString(),
    toolVersion: status.ffprobeVersion,
  };

  return {
    summary,
    streams,
    quality,
    kind,
    mimeType,
    durationMs,
    width: primaryVideo?.width ?? null,
    height: primaryVideo?.height ?? null,
    videoCodec: primaryVideo?.codec ?? null,
    audioCodec: primaryAudio?.codec ?? null,
    container,
    bitRate,
    metadata,
    titleHint,
  };
}
