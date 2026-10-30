import fsp from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AnalyzeAssetSchema,
  AssetQuerySchema,
  CreateCollectionSchema,
  TransformRequestSchema,
  UpdateAssetSchema,
} from '@sonicwire/contracts';
import { z } from 'zod';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { badRequest, notFound } from '../../http/errors.js';
import { queryAll } from '../../db/index.js';
import { recordAudit } from '../audit/service.js';
import { mediaCoreState } from '../media/analysis-client.js';
import { getAnalysis } from '../media/analysis-repository.js';
import {
  addAssetToCollection,
  createCollection,
  deleteCollection,
  getAssetDetail,
  getAssetRow,
  listAssets,
  listCollections,
  listTags,
  setAssetCollections,
  setAssetTags,
  softDeleteAsset,
  updateAssetRow,
} from './repository.js';

export async function registerLibraryRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/assets', async (request) => {
    const auth = requireAuth(request);
    const query = AssetQuerySchema.parse(request.query);
    return listAssets(deps.db, { workspaceId: auth.workspace.id, ...query });
  });

  app.get('/api/assets/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const detail = getAssetDetail(deps.db, auth.workspace.id, id);
    if (!detail) throw notFound('Asset not found');
    detail.metadata = queryAll<{ metadata_json: string | null }>(
      deps.db,
      'SELECT metadata_json FROM assets WHERE id = ?',
      id,
    ).reduce<Record<string, string>>((acc, row) => {
      if (!row.metadata_json) return acc;
      try {
        return { ...acc, ...(JSON.parse(row.metadata_json) as Record<string, string>) };
      } catch {
        return acc;
      }
    }, {});
    return detail;
  });

  app.patch('/api/assets/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = UpdateAssetSchema.parse(request.body);
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');

    if (body.title !== undefined) {
      updateAssetRow(deps.db, id, auth.workspace.id, { title: body.title });
    }
    if (body.tags !== undefined) {
      setAssetTags(deps.db, auth.workspace.id, id, body.tags);
    }
    if (body.collectionIds !== undefined) {
      setAssetCollections(deps.db, auth.workspace.id, id, body.collectionIds);
    }
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'asset.updated',
      targetType: 'asset',
      targetId: id,
      metadata: { fields: Object.keys(body) },
    });
    const detail = getAssetDetail(deps.db, auth.workspace.id, id);
    if (!detail) throw notFound('Asset not found');
    return detail;
  });

  app.delete('/api/assets/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    softDeleteAsset(deps.db, auth.workspace.id, id);
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'asset.deleted',
      targetType: 'asset',
      targetId: id,
      metadata: { title: asset.title },
    });
    return { ok: true, id };
  });

  app.post('/api/assets/:id/reprobe', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'media.probe',
      payload: { assetId: id },
      createdBy: auth.user.id,
    });
    return reply.code(202).send({ jobId });
  });

  /**
   * Deep measurements run out of process in the Python media-core service. The
   * route only queues the work; the queue reports the service's own refusal if
   * it is unreachable, so the client never sees fabricated values.
   */
  app.post('/api/assets/:id/analyze', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = AnalyzeAssetSchema.parse(request.body ?? {});
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    const core = await mediaCoreState();
    if (!core.configured || ('reachable' in core && !core.reachable)) {
      return reply.code(503).send({
        error: { code: 'provider_unavailable', message: core.detail },
        core,
      });
    }
    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'media.analyze',
      payload: { assetId: id, includePeaks: body.includePeaks },
      createdBy: auth.user.id,
      priority: 70,
    });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'asset.analyze_requested',
      targetType: 'asset',
      targetId: id,
      metadata: { jobId, includePeaks: body.includePeaks },
    });
    return reply.code(202).send({ jobId });
  });

  app.get('/api/assets/:id/analysis', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    const [analysis, core] = await Promise.all([getAnalysis(deps.db, auth.workspace.id, id), mediaCoreState()]);
    return { analysis, core };
  });

  app.post('/api/assets/:id/transform', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = TransformRequestSchema.parse(request.body ?? {});
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    const jobId = deps.queue.enqueue({
      workspaceId: auth.workspace.id,
      kind: 'media.transform',
      payload: { assetId: id, request: body },
      createdBy: auth.user.id,
      priority: 90,
    });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'asset.transform_requested',
      targetType: 'asset',
      targetId: id,
      metadata: { presetId: body.presetId, jobId },
    });
    return reply.code(202).send({ jobId });
  });

  app.get('/api/assets/:id/derivatives', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const rows = queryAll<{ id: string }>(
      deps.db,
      'SELECT id FROM assets WHERE parent_asset_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      id,
    );
    return {
      items: rows
        .map((row) => getAssetDetail(deps.db, auth.workspace.id, row.id))
        .filter((item): item is NonNullable<typeof item> => item !== null),
    };
  });

  app.get('/api/assets/:id/stream', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset) throw notFound('Asset not found');
    const stat = await fsp.stat(asset.storage_path).catch(() => null);
    if (!stat) throw notFound('Asset file is missing from storage');
    const etag = `"${asset.sha256.slice(0, 16)}-${stat.size}"`;
    if (request.headers['if-none-match'] === etag) {
      return reply.code(304).send();
    }
    return sendFile(
      request,
      reply,
      asset.storage_path,
      asset.mime_type ?? 'application/octet-stream',
      stat.size,
      etag,
      stat.mtime.toUTCString(),
    );
  });

  app.get('/api/assets/:id/thumbnail', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset?.thumbnail_path) throw notFound('No thumbnail for this asset');
    const stat = await fsp.stat(asset.thumbnail_path).catch(() => null);
    if (!stat) throw notFound('No thumbnail for this asset');
    reply.header('Content-Type', 'image/jpeg');
    reply.header('Content-Length', String(stat.size));
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.send(createReadStream(asset.thumbnail_path));
  });

  app.get('/api/assets/:id/waveform', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const asset = getAssetRow(deps.db, auth.workspace.id, id);
    if (!asset?.waveform_path) throw notFound('No waveform for this asset');
    const raw = await fsp.readFile(asset.waveform_path, 'utf8').catch(() => null);
    if (!raw) throw notFound('No waveform for this asset');
    reply.header('Cache-Control', 'private, max-age=3600');
    return reply.type('application/json').send(raw);
  });

  /* ----------------------------------------------------------- collections */

  app.get('/api/collections', async (request) => {
    const auth = requireAuth(request);
    return { items: listCollections(deps.db, auth.workspace.id) };
  });

  app.post('/api/collections', async (request, reply) => {
    const auth = requireAuth(request);
    const body = CreateCollectionSchema.parse(request.body);
    const collection = createCollection(
      deps.db,
      auth.workspace.id,
      body.name,
      body.description ?? null,
    );
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'collection.created',
      targetType: 'collection',
      targetId: collection.id,
      metadata: { name: collection.name },
    });
    return reply.code(201).send(collection);
  });

  app.delete('/api/collections/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    if (!deleteCollection(deps.db, auth.workspace.id, id)) throw notFound('Collection not found');
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'collection.deleted',
      targetType: 'collection',
      targetId: id,
    });
    return { ok: true };
  });

  app.post('/api/collections/:id/assets', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const body = z.object({ assetIds: z.array(z.string()).min(1).max(200) }).parse(request.body);
    let added = 0;
    for (const assetId of body.assetIds) {
      if (!getAssetRow(deps.db, auth.workspace.id, assetId)) continue;
      if (addAssetToCollection(deps.db, auth.workspace.id, assetId, id)) added += 1;
    }
    if (added === 0) throw badRequest('Nothing was added; check the collection and asset ids');
    return { added };
  });

  app.get('/api/tags', async (request) => {
    const auth = requireAuth(request);
    return { items: listTags(deps.db, auth.workspace.id) };
  });
}

/**
 * Range-aware static file delivery. Supports single ranges (including
 * open-ended and suffix ranges), conditional ETag requests and client aborts.
 */
export async function sendFile(
  request: FastifyRequest,
  reply: FastifyReply,
  filePath: string,
  contentType: string,
  size: number,
  etag: string,
  lastModified?: string,
): Promise<FastifyReply> {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    ETag: etag,
    'Cache-Control': 'private, max-age=0, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  };
  if (lastModified) headers['Last-Modified'] = lastModified;

  const range = request.headers.range;
  if (!range) {
    headers['Content-Length'] = String(size);
    reply.raw.writeHead(200, headers);
    const stream = createReadStream(filePath);
    stream.pipe(reply.raw);
    stream.on('error', () => reply.raw.destroy());
    reply.raw.on('close', () => stream.destroy());
    return reply;
  }

  const parsed = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!parsed) {
    reply.code(416).header('Content-Range', `bytes */${size}`).send();
    return reply;
  }
  const startRaw = parsed[1];
  const endRaw = parsed[2];
  let start: number;
  let end: number;
  if (startRaw === '' && endRaw !== '') {
    const suffix = Number(endRaw);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startRaw ?? 0);
    end = endRaw ? Number(endRaw) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    reply.code(416).header('Content-Range', `bytes */${size}`).send();
    return reply;
  }
  end = Math.min(end, size - 1);
  const chunkSize = end - start + 1;
  reply.raw.writeHead(206, {
    ...headers,
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(chunkSize),
  });
  const stream = createReadStream(filePath, { start, end });
  stream.pipe(reply.raw);
  stream.on('error', () => reply.raw.destroy());
  reply.raw.on('close', () => stream.destroy());
  return reply;
}
