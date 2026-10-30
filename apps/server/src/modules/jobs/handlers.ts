import { TransformRequestSchema, type TransformRequest } from '@sonicwire/contracts';
import type { Config } from '../../config.js';
import type { Database } from '../../db/index.js';
import { badRequest, notFound } from '../../http/errors.js';
import { logger } from '../../logger.js';
import { downloadToStorage } from '../acquisition/download.js';
import { ingestLocalFile } from '../acquisition/ingest.js';
import { getAssetRow, updateAssetRow } from '../library/repository.js';
import { generateThumbnail, generateWaveform } from '../media/artifacts.js';
import { analyzeWithCore, MediaCoreError } from '../media/analysis-client.js';
import { saveAnalysis } from '../media/analysis-repository.js';
import { buildExportBundle, probeAsset, transformAsset } from '../media/pipeline.js';
import type { Storage } from '../storage/storage.js';
import { executeWorkflow } from '../workflows/engine.js';
import type { JobQueue } from './queue.js';

export interface HandlerDeps {
  db: Database;
  storage: Storage;
  config: Config;
}

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw badRequest(`Job payload is missing "${field}"`);
  }
  return value;
};

export function registerJobHandlers(queue: JobQueue, deps: HandlerDeps): void {
  const pipelineDeps = { db: deps.db, storage: deps.storage, config: deps.config };

  queue.register('media.probe', async (ctx) => {
    const assetId = asString(ctx.payload.assetId, 'assetId');
    ctx.log('info', 'Probing asset', { assetId });
    const result = await probeAsset(pipelineDeps, assetId, {
      workspaceId: ctx.workspaceId,
      signal: ctx.signal,
      progress: ctx.progress,
      log: ctx.log,
    });
    return { assetId, status: result.status, warnings: result.warnings };
  });

  queue.register('media.analyze', async (ctx) => {
    const assetId = asString(ctx.payload.assetId, 'assetId');
    const includePeaks = ctx.payload.includePeaks === true;
    const asset = getAssetRow(deps.db, ctx.workspaceId, assetId);
    if (!asset) throw notFound('Asset not found');
    ctx.log('info', 'Measuring asset with media-core', { assetId, includePeaks });
    ctx.progress(0.1, 'Sending file to media-core');
    try {
      const report = await analyzeWithCore(asset.storage_path, { includePeaks, signal: ctx.signal });
      saveAnalysis(deps.db, ctx.workspaceId, assetId, report);
      ctx.progress(1, 'Measurements stored');
      return {
        assetId,
        engine: report.engine,
        measuredAt: report.measuredAt,
        loudness: report.loudness?.integratedLufs ?? null,
        peakCount: report.peakCount,
      };
    } catch (error) {
      if (error instanceof MediaCoreError) {
        // Reported as a failed job with the service's own reason: a missing
        // measurement is never rounded into a zero.
        ctx.log('error', 'media-core could not measure this asset', {
          assetId,
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  });

  queue.register('media.thumbnail', async (ctx) => {
    const assetId = asString(ctx.payload.assetId, 'assetId');
    const asset = getAssetRow(deps.db, ctx.workspaceId, assetId);
    if (!asset) throw notFound('Asset not found');
    const output = deps.storage.thumbnailPath(ctx.workspaceId, assetId);
    const ok = await generateThumbnail(
      asset.storage_path,
      output,
      { durationMs: asset.duration_ms, kind: asset.kind, hasCoverArt: false },
      ctx.signal,
    );
    if (!ok) {
      updateAssetRow(deps.db, assetId, ctx.workspaceId, { thumbnail_path: null });
      return { assetId, thumbnail: false };
    }
    updateAssetRow(deps.db, assetId, ctx.workspaceId, { thumbnail_path: output });
    ctx.progress(1, 'Thumbnail regenerated');
    return { assetId, thumbnail: true };
  });

  queue.register('media.waveform', async (ctx) => {
    const assetId = asString(ctx.payload.assetId, 'assetId');
    const asset = getAssetRow(deps.db, ctx.workspaceId, assetId);
    if (!asset) throw notFound('Asset not found');
    const output = deps.storage.waveformPath(ctx.workspaceId, assetId);
    const wave = await generateWaveform(asset.storage_path, output, asset.duration_ms ?? 0, ctx.signal);
    updateAssetRow(deps.db, assetId, ctx.workspaceId, {
      waveform_path: wave ? output : null,
    });
    ctx.progress(1, wave ? 'Waveform regenerated' : 'No audio stream');
    return { assetId, waveform: Boolean(wave) };
  });

  queue.register('media.transform', async (ctx) => {
    const assetId = asString(ctx.payload.assetId, 'assetId');
    const request = TransformRequestSchema.parse(ctx.payload.request ?? {}) as TransformRequest;
    ctx.log('info', `Starting transform ${request.presetId}`);
    const result = await transformAsset(pipelineDeps, assetId, request, {
      workspaceId: ctx.workspaceId,
      signal: ctx.signal,
      progress: ctx.progress,
      log: ctx.log,
    });
    return { assetId: result.assetId, sourceAssetId: assetId, presetId: request.presetId };
  });

  queue.register('media.export', async (ctx) => {
    const assetIds = ctx.payload.assetIds;
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      throw badRequest('Select at least one asset to export');
    }
    const ids = assetIds.filter((value): value is string => typeof value === 'string');
    const bundle = await buildExportBundle(pipelineDeps, ids, {
      workspaceId: ctx.workspaceId,
      signal: ctx.signal,
      progress: ctx.progress,
      log: ctx.log,
    });
    return {
      filePath: bundle.filePath,
      fileName: bundle.fileName,
      bytes: bundle.bytes,
      entryCount: bundle.entryCount,
    };
  });

  queue.register('acquisition.download', async (ctx) => {
    const url = asString(ctx.payload.url, 'url');
    const title = typeof ctx.payload.title === 'string' ? ctx.payload.title : null;
    ctx.log('info', 'Acquiring remote media', { url });
    const startedAt = Date.now();
    let lastLogged = 0;

    const download = await downloadToStorage({
      url,
      storage: deps.storage,
      maxBytes: deps.config.MAX_DOWNLOAD_BYTES,
      maxSeconds: deps.config.MAX_DOWNLOAD_SECONDS,
      signal: ctx.signal,
      onProgress: (bytes, total) => {
        if (total) {
          ctx.progress(Math.min(0.55, (bytes / total) * 0.55));
        } else if (Date.now() - lastLogged > 2000) {
          lastLogged = Date.now();
          ctx.log('info', `Received ${(bytes / 1024 / 1024).toFixed(1)} MB`);
        }
      },
    });
    ctx.log('info', 'Transfer complete', { bytes: download.bytes, contentType: download.contentType });
    ctx.progress(0.6, 'Registering asset');

    const derivedTitle = decodeURIComponent(
      download.finalUrl.split('/').pop()?.split('?')[0] ?? '',
    )
      .replace(/\.[A-Za-z0-9]{1,8}$/, '')
      .slice(0, 120);
    const fallbackTitle = title ?? (derivedTitle || 'Acquired media');

    const ingested = await ingestLocalFile(
      { db: deps.db, storage: deps.storage },
      {
        workspaceId: ctx.workspaceId,
        tmpPath: download.filePath,
        title: fallbackTitle,
        mimeType: download.contentType,
        sourceKind: 'url',
        sourceUrl: download.finalUrl,
        extension: download.extension,
        createdBy: null,
        knownSha256: download.sha256,
        collectionId: typeof ctx.payload.collectionId === 'string' ? ctx.payload.collectionId : null,
        tags: Array.isArray(ctx.payload.tags)
          ? ctx.payload.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
      },
    );

    if (ingested.duplicate) {
      ctx.log('warn', 'Identical content already exists; reusing the existing asset');
      return { assetId: ingested.assetId, duplicate: true, durationMs: Date.now() - startedAt };
    }

    ctx.progress(0.65, 'Analyzing media');
    const probe = await probeAsset(pipelineDeps, ingested.assetId, {
      workspaceId: ctx.workspaceId,
      signal: ctx.signal,
      progress: (value, message) => ctx.progress(0.65 + value * 0.35, message),
      log: ctx.log,
    });
    return {
      assetId: ingested.assetId,
      duplicate: false,
      status: probe.status,
      bytes: download.bytes,
      finalUrl: download.finalUrl,
    };
  });

  queue.register('workflow.run', async (ctx) => {
    const runId = asString(ctx.payload.runId, 'runId');
    const result = await executeWorkflow(
      { ...pipelineDeps, storage: deps.storage },
      runId,
      {
        workspaceId: ctx.workspaceId,
        signal: ctx.signal,
        progress: ctx.progress,
        log: ctx.log,
        failFast: ctx.failFast,
      },
    );
    logger.info({ runId, ...result }, 'workflow run completed');
    return result as unknown as Record<string, unknown>;
  });
}
