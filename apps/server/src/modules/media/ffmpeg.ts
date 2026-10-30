import { createRequire } from 'node:module';
import { config } from '../../config.js';
import { AppError } from '../../http/errors.js';
import { logger } from '../../logger.js';
import { runProcess } from './process.js';

const require = createRequire(import.meta.url);

function resolveBinary(envPath: string | undefined, packageName: string): { path: string | null; source: 'environment' | 'bundled' } {
  if (envPath) return { path: envPath, source: 'environment' };
  try {
    const installer = require(packageName) as { path: string };
    return { path: installer.path, source: 'bundled' };
  } catch {
    return { path: null, source: 'bundled' };
  }
}

const ffmpegBinary = resolveBinary(config.FFMPEG_PATH, '@ffmpeg-installer/ffmpeg');
const ffprobeBinary = resolveBinary(config.FFPROBE_PATH, '@ffprobe-installer/ffprobe');

export interface ToolchainStatus {
  available: boolean;
  version: string | null;
  ffprobeVersion: string | null;
  path: string | null;
  ffprobePath: string | null;
  source: 'bundled' | 'environment';
  encoders: string[];
  decoders: string[];
  muxers: string[];
  error: string | null;
}

let cachedStatus: Promise<ToolchainStatus> | null = null;

async function detect(): Promise<ToolchainStatus> {
  const base: ToolchainStatus = {
    available: false,
    version: null,
    ffprobeVersion: null,
    path: ffmpegBinary.path,
    ffprobePath: ffprobeBinary.path,
    source: ffmpegBinary.source,
    encoders: [],
    decoders: [],
    muxers: [],
    error: null,
  };
  if (!ffmpegBinary.path || !ffprobeBinary.path) {
    return { ...base, error: 'FFmpeg or FFprobe binary could not be located' };
  }
  try {
    const [versionResult, probeResult] = await Promise.all([
      runProcess(ffmpegBinary.path, ['-hide_banner', '-version'], { timeoutMs: 10_000 }),
      runProcess(ffprobeBinary.path, ['-hide_banner', '-version'], { timeoutMs: 10_000 }),
    ]);
    const version = firstMatch(versionResult.stdout, /ffmpeg version (\S+)/);
    const ffprobeVersion = firstMatch(probeResult.stdout, /ffprobe version (\S+)/);
    const [encodersOut, decodersOut, muxersOut] = await Promise.all([
      runProcess(ffmpegBinary.path, ['-hide_banner', '-encoders'], { timeoutMs: 15_000 }),
      runProcess(ffmpegBinary.path, ['-hide_banner', '-decoders'], { timeoutMs: 15_000 }),
      runProcess(ffmpegBinary.path, ['-hide_banner', '-muxers'], { timeoutMs: 15_000 }),
    ]);
    return {
      ...base,
      available: true,
      version,
      ffprobeVersion,
      encoders: parseTable(encodersOut.stdout),
      decoders: parseTable(decodersOut.stdout),
      muxers: parseTable(muxersOut.stdout),
    };
  } catch (error) {
    logger.error({ err: error }, 'ffmpeg detection failed');
    return { ...base, error: (error as Error).message };
  }
}

function firstMatch(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  return match?.[1] ?? null;
}

/** Parses `ffmpeg -encoders` style listings into a set of capability names. */
function parseTable(output: string): string[] {
  const names: string[] = [];
  for (const line of output.split('\n')) {
    const match = /^\s*[A-Z.]{6}\s+(\S+)/.exec(line);
    if (match && match[1] && !match[1].startsWith('=')) names.push(match[1]);
  }
  return [...new Set(names)].sort();
}

export function toolchain(): Promise<ToolchainStatus> {
  cachedStatus ??= detect();
  return cachedStatus;
}

export function resetToolchainCache(): void {
  cachedStatus = null;
}

export async function ffmpeg(args: string[], options: Parameters<typeof runProcess>[2] = {}) {
  const status = await toolchain();
  if (!status.available || !ffmpegBinary.path) {
    throw new AppError('provider_unavailable', 'FFmpeg is not available on this deployment');
  }
  return runProcess(ffmpegBinary.path, args, options);
}

export async function ffprobe(args: string[], options: Parameters<typeof runProcess>[2] = {}) {
  const status = await toolchain();
  if (!status.available || !ffprobeBinary.path) {
    throw new AppError('provider_unavailable', 'FFprobe is not available on this deployment');
  }
  return runProcess(ffprobeBinary.path, args, options);
}
