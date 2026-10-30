import fsp from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { IngestUrlSchema } from '@sonicwire/contracts';
import { z } from 'zod';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { badRequest, notFound, providerNotConfigured, unsupportedMedia } from '../../http/errors.js';
import { config } from '../../config.js';
import { recordAudit } from '../audit/service.js';
import { findProviderForUrl } from '../providers/registry.js';
import { ingestLocalFile } from './ingest.js';
import { normalizeExtension, writeStreamWithLimits } from '../storage/storage.js';
import { resolveSafeUrl } from './url-guard.js';
import { getJobRow } from '../jobs/repository.js';

const ALLOWED_UPLOAD_PREFIXES = ['video/', 'audio/', 'image/'];

export async function registerAcquisitionRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.post('/api/acquisition/upload', async (request, reply) => {
    const auth = requireAuth(request);
    const part = await request.file();
    if (!part) throw badRequest('Attach a media file to import');

    const mime = part.mimetype?.toLowerCase() ?? null;
    if (!mime || !ALLOWED_UPLOAD_PREFIXES.some((prefix) => mime.startsWith(prefix))) {
      // Drain the stream so the connection can close cleanly.
      part.file.resume();
      throw unsupportedMedia(
        `Only audio, video and image uploads are accepted (received ${mime ?? 'unknown type'})`,
      );
    }

    const fields = part.fields as Record<string, { value?: unknown } | undefined>;
    const fieldValue = (name: string): string | null => {
      const value = fields?.[name]?.value;
      return typeof value === 'string' && value.length > 0 ? value : null;
    };

    const extension = normalizeExtension(path.extname(part.filename ?? ''));
    const tmpPath = deps.storage.tmpPath(extension);
    let written;
    try {
      written = await writeStreamWithLimits(part.file, tmpPath, {
        maxBytes: config.MAX_UPLOAD_BYTES,
      });
    } catch (error) {
      await deps.storage.removeIfExists(tmpPath);
      throw error;
    }

    const fallbackTitle = (part.filename ?? 'Imported media').replace(/\.[A-Za-z0-9]{1,8}$/, '');
    const ingested = await ingestLocalFile(
      { db: deps.db, storage: deps.storage },
      {
        workspaceId: auth.workspace.id,
        tmpPath,
        title: fieldValue('title') ?? fallbackTitle,
        mimeType: mime,
        sourceKind: 'upload',
        sourceUrl: null,
        extension,
        createdBy: auth.user.id,
        knownSha256: written.sha256,
        collectionId: fieldValue('collectionId'),
        tags: fieldValue('tags')
          ? fieldValue('tags')!
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
      },
    );

    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: ingested.duplicate ? 'asset.deduplicated' : 'asset.imported',
      targetType: 'asset',
      targetId: ingested.assetId,
      metadata: { bytes: written.bytes, fileName: part.filename, mimeType: mime },
    });

    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'media.probe',
      payload: { assetId: ingested.assetId },
      createdBy: auth.user.id,
      priority: 70,
    });

    return reply.code(ingested.duplicate ? 200 : 201).send({
      assetId: ingested.assetId,
      duplicate: ingested.duplicate,
      jobId,
      bytes: written.bytes,
    });
  });

  app.post('/api/acquisition/url', async (request, reply) => {
    const auth = requireAuth(request);
    const body = IngestUrlSchema.parse(request.body);
    const provider = findProviderForUrl(body.url);
    if (provider && provider.ingestion === 'link-only') {
      throw providerNotConfigured(
        `${provider.name} does not offer a public download API, and SonicWire does not scrape provider pages. Store it as a reference link to your authorized export instead.`,
      );
    }

    // Reject unsafe destinations before a job exists; the downloader repeats
    // this validation per redirect hop to close DNS-rebinding windows.
    await resolveSafeUrl(body.url);

    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'acquisition.download',
      payload: {
        url: body.url,
        title: body.title ?? null,
        collectionId: body.collectionId ?? null,
        tags: body.tags ?? [],
      },
      createdBy: auth.user.id,
      priority: 60,
    });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'acquisition.queued',
      targetType: 'url',
      targetId: body.url.slice(0, 300),
      metadata: { jobId, providerId: provider?.id ?? null },
    });
    return reply.code(202).send({
      jobId,
      acceptedUrl: body.url,
      providerId: provider?.id ?? null,
      note: provider
        ? `${provider.name} URLs are fetched only when they point directly at media you are authorized to retrieve.`
        : null,
    });
  });

  app.post('/api/exports', async (request, reply) => {
    const auth = requireAuth(request);
    const body = z
      .object({ assetIds: z.array(z.string()).min(1).max(200) })
      .parse(request.body);
    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'media.export',
      payload: { assetIds: body.assetIds },
      createdBy: auth.user.id,
      priority: 120,
    });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'export.requested',
      targetType: 'bundle',
      targetId: jobId,
      metadata: { assets: body.assetIds.length },
    });
    return reply.code(202).send({ jobId });
  });

  app.get('/api/exports/:jobId/download', async (request, reply) => {
    const auth = requireAuth(request);
    const { jobId } = request.params as { jobId: string };
    const job = getJobRow(deps.db, auth.workspace.id, jobId);
    if (!job || job.kind !== 'media.export') throw notFound('Export not found');
    if (job.status !== 'succeeded' || !job.result) {
      throw badRequest('That export has not finished successfully');
    }
    const result = JSON.parse(job.result) as { filePath?: string; fileName?: string };
    if (!result.filePath) throw notFound('Export artifact is missing');
    const exportsRoot = path.join(deps.storage.dataDir, 'exports');
    const resolved = path.resolve(result.filePath);
    if (!resolved.startsWith(path.resolve(exportsRoot))) {
      throw badRequest('Refusing to serve an artifact outside the export directory');
    }
    const stat = await fsp.stat(resolved).catch(() => null);
    if (!stat) throw notFound('Export artifact is missing from disk');
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${result.fileName ?? 'sonicwire-export.zip'}"`);
    reply.header('Content-Length', String(stat.size));
    return reply.send(createReadStream(resolved));
  });
}
