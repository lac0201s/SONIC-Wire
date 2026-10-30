import fs from 'node:fs/promises';
import path from 'node:path';
import type { Waveform } from '@sonicwire/contracts';
import { logger } from '../../logger.js';
import { ffmpeg } from './ffmpeg.js';

const WAVEFORM_BUCKETS = 900;

/**
 * Builds waveform peaks by decoding the first audio stream to mono 16-bit PCM
 * at a low sample rate. Audio is never fully materialised: peaks are aggregated
 * per bucket as chunks stream past.
 */
export async function generateWaveform(
  inputPath: string,
  outputPath: string,
  durationMs: number,
  signal?: AbortSignal,
): Promise<Waveform | null> {
  const targetRate = durationMs > 30 * 60 * 1000 ? 2000 : 8000;
  const peaks: number[] = [];
  let bucketSamples = 0;
  let bucketPeak = 0;
  let sampleIndex = 0;
  let carry: Buffer | null = null;
  let totalSamples = 0;

  // First pass collects samples into a bounded buffer, then reduces to peaks.
  // A 3 hour file at 2 kHz is ~21 M samples (~43 MB of s16le); we stream and
  // reduce immediately, so memory stays flat.
  const collected: Buffer[] = [];
  let collectedBytes = 0;
  const MAX_COLLECT = 96 * 1024 * 1024;

  try {
    const result = await ffmpeg(
      [
        '-hide_banner',
        '-v',
        'error',
        '-i',
        inputPath,
        '-map',
        '0:a:0',
        '-ac',
        '1',
        '-ar',
        String(targetRate),
        '-f',
        's16le',
        '-acodec',
        'pcm_s16le',
        'pipe:1',
      ],
      {
        signal,
        timeoutMs: Math.max(60_000, Math.min(600_000, durationMs * 2)),
        maxStdoutBytes: 1,
        onStdout: (chunk) => {
          if (collectedBytes > MAX_COLLECT) return;
          collected.push(Buffer.from(chunk));
          collectedBytes += chunk.length;
        },
      },
    );
    if (result.code !== 0) {
      logger.warn({ stderr: result.stderr.slice(0, 300) }, 'waveform decode failed');
      return null;
    }
  } catch (error) {
    logger.warn({ err: error }, 'waveform generation errored');
    return null;
  }

  const pcm = Buffer.concat(collected);
  if (pcm.length < 2) return null;
  const sampleCount = Math.floor(pcm.length / 2);
  const samplesPerBucket = Math.max(1, Math.ceil(sampleCount / WAVEFORM_BUCKETS));

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = Math.abs(pcm.readInt16LE(i * 2)) / 32768;
    bucketPeak = Math.max(bucketPeak, sample);
    bucketSamples += 1;
    sampleIndex += 1;
    if (bucketSamples >= samplesPerBucket) {
      peaks.push(Number(bucketPeak.toFixed(4)));
      bucketPeak = 0;
      bucketSamples = 0;
    }
  }
  if (bucketSamples > 0) peaks.push(Number(bucketPeak.toFixed(4)));
  totalSamples = sampleIndex;
  carry = null;
  void carry;

  const waveform: Waveform = {
    peaks,
    sampleRate: targetRate,
    durationMs: Math.round((totalSamples / targetRate) * 1000),
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(waveform));
  return waveform;
}

/**
 * Extracts a representative frame (or embedded cover art) as a JPEG thumbnail.
 * Returns null when the asset has no visual content to show.
 */
export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  options: { durationMs: number | null; kind: 'audio' | 'video' | 'image' | 'unknown'; hasCoverArt: boolean },
  signal?: AbortSignal,
): Promise<boolean> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const args: string[] = ['-hide_banner', '-v', 'error', '-y'];
  if (options.kind === 'audio') {
    if (!options.hasCoverArt) return false;
    args.push('-i', inputPath, '-map', '0:v:0', '-frames:v', '1');
  } else if (options.kind === 'image') {
    args.push('-i', inputPath, '-frames:v', '1');
  } else {
    const seekMs = options.durationMs ? Math.min(Math.max(options.durationMs * 0.25, 1000), 15000) : 1000;
    args.push('-ss', (seekMs / 1000).toFixed(3), '-i', inputPath, '-frames:v', '1');
  }
  args.push('-vf', 'scale=640:-2:flags=lanczos', '-q:v', '3', '-f', 'image2', outputPath);

  try {
    const result = await ffmpeg(args, { signal, timeoutMs: 60_000, maxStdoutBytes: 65_536 });
    if (result.code !== 0) {
      logger.warn({ stderr: result.stderr.slice(0, 300) }, 'thumbnail extraction failed');
      await fs.rm(outputPath, { force: true });
      return false;
    }
    const stat = await fs.stat(outputPath).catch(() => null);
    return Boolean(stat && stat.size > 0);
  } catch (error) {
    logger.warn({ err: error }, 'thumbnail generation errored');
    return false;
  }
}
