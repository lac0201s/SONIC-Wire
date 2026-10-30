import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import type { AssetKind, TransformRequest } from '@sonicwire/contracts';
import type { Config } from '../../config.js';
import { execute, newId, nowIso, type Database } from '../../db/index.js';
import { AppError, notFound } from '../../http/errors.js';
import { logger } from '../../logger.js';
import { realtimeBus } from '../events/bus.js';
import {
  createAsset,
  getAssetRow,
  replaceStreams,
  updateAssetRow,
} from '../library/repository.js';
import { sha256File, type Storage } from '../storage/storage.js';
import { generateThumbnail, generateWaveform } from './artifacts.js';
import { ffmpeg, toolchain } from './ffmpeg.js';
import { presetById } from './presets.js';
import { probeFile } from './probe.js';
import { ZipWriter } from './zip.js';

export interface PipelineDeps {
  db: Database;
  storage: Storage;
  config: Config;
}

export interface PipelineContext {
  workspaceId: string;
  signal?: AbortSignal;
  progress?: (value: number, message?: string) => void;
  log?: (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => void;
}

/**
 * Probes an asset, persists structured metadata, and generates the derived
 * artifacts (thumbnail, waveform). This is the single place where an asset
 * transitions from `probing` to `ready` or `error`.
 */
export async function probeAsset(
  deps: PipelineDeps,
  assetId: string,
  ctx: PipelineContext,
): Promise<{ status: 'ready' | 'error'; warnings: string[] }> {
  const row = getAssetRow(deps.db, ctx.workspaceId, assetId);
  if (!row) throw notFound('Asset not found');
  if (!(await deps.storage.exists(row.storage_path))) {
    updateAssetRow(deps.db, assetId, ctx.workspaceId, {
      status: 'missing',
      error_message: 'The stored file is no longer present on disk',
    });
    realtimeBus.publish({ type: 'asset.updated', assetId, status: 'missing' });
    throw notFound('Asset file is missing from storage');
  }

  updateAssetRow(deps.db, assetId, ctx.workspaceId, { status: 'probing', error_message: null });
  realtimeBus.publish({ type: 'asset.updated', assetId, status: 'probing' });
  ctx.progress?.(0.05, 'Reading container and stream metadata');

  try {
    const probe = await probeFile(row.storage_path, ctx.signal);
    ctx.progress?.(0.55, 'Metadata parsed');

    const thumbnailPath = deps.storage.thumbnailPath(ctx.workspaceId, assetId);
    const waveformPath = deps.storage.waveformPath(ctx.workspaceId, assetId);
    const hasAudio = probe.streams.some((stream) => stream.type === 'audio');

    let thumbnail = false;
    if (probe.kind !== 'unknown') {
      thumbnail = await generateThumbnail(
        row.storage_path,
        thumbnailPath,
        {
          durationMs: probe.durationMs,
          kind: probe.kind,
          hasCoverArt: probe.summary.hasCoverArt,
        },
        ctx.signal,
      );
      ctx.progress?.(0.7, thumbnail ? 'Thumbnail rendered' : 'No visual frame available');
    }

    let waveform = false;
    if (hasAudio) {
      const result = await generateWaveform(
        row.storage_path,
        waveformPath,
        probe.durationMs ?? 0,
        ctx.signal,
      );
      waveform = Boolean(result);
      ctx.progress?.(0.92, waveform ? 'Waveform peaks computed' : 'Waveform unavailable');
    }

    updateAssetRow(deps.db, assetId, ctx.workspaceId, {
      kind: probe.kind,
      status: 'ready',
      mime_type: probe.mimeType,
      duration_ms: probe.durationMs,
      width: probe.width,
      height: probe.height,
      video_codec: probe.videoCodec,
      audio_codec: probe.audioCodec,
      container: probe.container,
      bit_rate: probe.bitRate,
      probe_json: JSON.stringify(probe.summary),
      quality_json: JSON.stringify(probe.quality),
      thumbnail_path: thumbnail ? thumbnailPath : null,
      waveform_path: waveform ? waveformPath : null,
      error_message: null,
    });
    execute(
      deps.db,
      'UPDATE assets SET metadata_json = ? WHERE id = ?',
      JSON.stringify(probe.metadata),
      assetId,
    );
    replaceStreams(deps.db, assetId, probe.streams);
    realtimeBus.publish({ type: 'asset.updated', assetId, status: 'ready' });
    ctx.progress?.(1, 'Asset ready');
    return { status: 'ready', warnings: probe.summary.warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateAssetRow(deps.db, assetId, ctx.workspaceId, {
      status: 'error',
      error_message: message.slice(0, 500),
    });
    realtimeBus.publish({ type: 'asset.updated', assetId, status: 'error' });
    throw error;
  }
}

async function assertEncodersAvailable(required: string[]): Promise<void> {
  if (required.length === 0) return;
  const status = await toolchain();
  const missing = required.filter((encoder) => !status.encoders.includes(encoder));
  if (missing.length > 0) {
    throw new AppError(
      'provider_unavailable',
      `This deployment's FFmpeg build cannot encode: ${missing.join(', ')}. Install a build with those encoders or choose another preset.`,
    );
  }
}

/**
 * Runs a transform preset against an asset and registers the output as a
 * derivative asset. The source file is never modified.
 */
export async function transformAsset(
  deps: PipelineDeps,
  assetId: string,
  request: TransformRequest,
  ctx: PipelineContext,
): Promise<{ assetId: string }> {
  const row = getAssetRow(deps.db, ctx.workspaceId, assetId);
  if (!row) throw notFound('Asset not found');
  if (row.status !== 'ready') {
    throw new AppError('conflict', 'The asset must finish probing before it can be transformed');
  }
  if (!(await deps.storage.exists(row.storage_path))) {
    throw notFound('Source file is missing from storage');
  }

  const preset = presetById(request.presetId);
  if (!preset.accepts.includes(row.kind as AssetKind)) {
    throw new AppError(
      'bad_request',
      `${preset.label} does not accept ${row.kind} sources`,
    );
  }
  if (request.trim && row.duration_ms && request.trim.endMs > row.duration_ms + 500) {
    throw new AppError('bad_request', 'The trim range extends past the end of the source');
  }
  await assertEncodersAvailable(preset.requiredEncoders);

  const built = preset.build({
    durationMs: row.duration_ms,
    videoCodec: row.video_codec,
    audioCodec: row.audio_codec,
    trim: request.trim,
  });

  const derivativeId = newId();
  const outputPath = deps.storage.derivedPath(ctx.workspaceId, derivativeId, built.outputExtension);
  await deps.storage.ensureDirFor(outputPath);

  const durationMs = request.trim
    ? Math.max(1, request.trim.endMs - request.trim.startMs)
    : (row.duration_ms ?? 0);
  let lastReported = -1;

  ctx.progress?.(0.02, `Starting ${preset.label}`);
  const result = await ffmpeg(
    [
      '-hide_banner',
      '-v',
      'error',
      '-y',
      '-i',
      row.storage_path,
      ...built.args,
      '-progress',
      'pipe:1',
      '-nostats',
      outputPath,
    ],
    {
      signal: ctx.signal,
      timeoutMs: Math.max(120_000, Math.min(4 * 60 * 60 * 1000, durationMs * 20)),
      maxStdoutBytes: 2 * 1024 * 1024,
      onStdout: (chunk) => {
        const text = chunk.toString('utf8');
        for (const line of text.split('\n')) {
          if (!line.startsWith('out_time_us=')) continue;
          const microseconds = Number(line.slice('out_time_us='.length));
          if (!Number.isFinite(microseconds) || durationMs <= 0) continue;
          const ratio = Math.min(0.97, Math.max(0.02, microseconds / (durationMs * 1000)));
          if (ratio - lastReported < 0.02) continue;
          lastReported = ratio;
          ctx.progress?.(ratio, undefined);
        }
      },
    },
  );

  if (result.code !== 0) {
    await deps.storage.removeIfExists(outputPath);
    const detail = result.stderr.trim().split('\n').slice(-2).join(' ').slice(0, 400);
    throw new AppError('unsupported_media', `FFmpeg could not complete this transform: ${detail || 'unknown error'}`);
  }

  const stat = await fsp.stat(outputPath).catch(() => null);
  if (!stat || stat.size === 0) {
    await deps.storage.removeIfExists(outputPath);
    throw new AppError('internal', 'The transform produced an empty file');
  }

  ctx.progress?.(0.98, 'Validating output');
  const probe = await probeFile(outputPath, ctx.signal);
  const sha = await sha256File(outputPath);
  const suffix = request.titleSuffix ? ` — ${request.titleSuffix}` : ` — ${preset.label}`;
  const newAssetId = createAsset(deps.db, {
    workspaceId: ctx.workspaceId,
    title: `${row.title}${suffix}`.slice(0, 200),
    kind: built.outputKind,
    status: 'ready',
    mimeType: probe.mimeType,
    sizeBytes: stat.size,
    sha256: sha,
    storagePath: outputPath,
    sourceKind: 'derived',
    sourceUrl: null,
    parentAssetId: row.id,
    createdBy: null,
    acquiredAt: nowIso(),
  });
  updateAssetRow(deps.db, newAssetId, ctx.workspaceId, {
    duration_ms: probe.durationMs,
    width: probe.width,
    height: probe.height,
    video_codec: probe.videoCodec,
    audio_codec: probe.audioCodec,
    container: probe.container,
    bit_rate: probe.bitRate,
    probe_json: JSON.stringify(probe.summary),
    quality_json: JSON.stringify(probe.quality),
  });
  replaceStreams(deps.db, newAssetId, probe.streams);

  // Small derivatives still deserve a thumbnail + waveform for the library grid.
  const thumb = deps.storage.thumbnailPath(ctx.workspaceId, newAssetId);
  const thumbOk = await generateThumbnail(outputPath, thumb, {
    durationMs: probe.durationMs,
    kind: probe.kind,
    hasCoverArt: probe.summary.hasCoverArt,
  });
  if (thumbOk) {
    updateAssetRow(deps.db, newAssetId, ctx.workspaceId, { thumbnail_path: thumb });
  }
  if (probe.streams.some((stream) => stream.type === 'audio')) {
    const wavePath = deps.storage.waveformPath(ctx.workspaceId, newAssetId);
    const wave = await generateWaveform(outputPath, wavePath, probe.durationMs ?? 0);
    if (wave) {
      updateAssetRow(deps.db, newAssetId, ctx.workspaceId, { waveform_path: wavePath });
    }
  }

  realtimeBus.publish({ type: 'asset.updated', assetId: newAssetId, status: 'ready' });
  ctx.progress?.(1, 'Derivative created');
  ctx.log?.('info', 'Transform completed', { derivativeId: newAssetId, preset: preset.id });
  return { assetId: newAssetId };
}

export interface ExportBundleResult {
  filePath: string;
  fileName: string;
  bytes: number;
  entryCount: number;
}

const MAX_BUNDLE_BYTES = 4 * 1024 * 1024 * 1024;

/**
 * Packages assets into a ZIP bundle plus a manifest. Media entries are stored
 * (not deflated) because already-compressed media gains nothing from DEFLATE
 * and streaming stored entries keeps memory flat. The bundle is bounded and
 * honours cancellation.
 */
export async function buildExportBundle(
  deps: PipelineDeps,
  assetIds: string[],
  ctx: PipelineContext,
): Promise<ExportBundleResult> {
  if (assetIds.length === 0) throw new AppError('bad_request', 'Select at least one asset to export');
  if (assetIds.length > 200) throw new AppError('bad_request', 'A bundle can contain at most 200 assets');

  const rows = assetIds.map((id) => {
    const row = getAssetRow(deps.db, ctx.workspaceId, id);
    if (!row) throw notFound(`Asset ${id} not found`);
    return row;
  });

  const totalBytes = rows.reduce((sum, row) => sum + row.size_bytes, 0);
  if (totalBytes > MAX_BUNDLE_BYTES) {
    throw new AppError('payload_too_large', 'The selected assets exceed the 4 GB bundle limit');
  }

  const exportId = newId();
  const exportDir = path.join(deps.storage.dataDir, 'exports');
  await fsp.mkdir(exportDir, { recursive: true });
  const fileName = `sonicwire-${exportId.slice(0, 8)}.zip`;
  const finalPath = path.join(exportDir, fileName);
  const tmpPath = `${finalPath}.part`;

  const manifest = {
    format: 'sonicwire.bundle/1',
    generatedAt: nowIso(),
    assetCount: rows.length,
    assets: rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      sha256: row.sha256,
      sizeBytes: row.size_bytes,
      durationMs: row.duration_ms,
      container: row.container,
      videoCodec: row.video_codec,
      audioCodec: row.audio_codec,
      sourceKind: row.source_kind,
      sourceUrl: row.source_url,
    })),
  };

  const writer = await ZipWriter.create(tmpPath);
  try {
    await writer.addBuffer('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

    const usedNames = new Set<string>(['manifest.json']);
    for (const [index, row] of rows.entries()) {
      if (ctx.signal?.aborted) throw new Error('cancelled');
      const extension = path.extname(row.storage_path) || '.bin';
      let name = `${sanitizeName(row.title)}${extension}`;
      let counter = 2;
      while (usedNames.has(name.toLowerCase())) {
        name = `${sanitizeName(row.title)}-${counter}${extension}`;
        counter += 1;
      }
      usedNames.add(name.toLowerCase());

      await writer.addFile(name, row.storage_path, {
        signal: ctx.signal,
        maxBytes: MAX_BUNDLE_BYTES,
        onBytes: (bytes) => {
          const ratio = Math.min(0.98, (bytes / Math.max(1, totalBytes)) * 0.98);
          ctx.progress?.(ratio + index / rows.length * 0.02);
        },
      });
      ctx.progress?.(((index + 1) / rows.length) * 0.99, `Packaged ${index + 1} of ${rows.length}`);
    }

    const summary = await writer.close();
    await fsp.rename(tmpPath, finalPath);
    ctx.progress?.(1, 'Bundle ready');
    logger.info({ exportId, files: rows.length, bytes: summary.bytes }, 'export bundle built');
    return { filePath: finalPath, fileName, bytes: summary.bytes, entryCount: rows.length };
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

function sanitizeName(value: string): string {
  const cleaned = value
    .normalize('NFKD')
    .replace(/[^\w\-. ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || 'asset';
}
