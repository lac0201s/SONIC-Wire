import fsp from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { badRequest, forbidden } from '../../http/errors.js';
import { execute, queryAll, queryOne } from '../../db/index.js';
import { recordAudit } from '../audit/service.js';
import { config } from '../../config.js';

export async function registerSettingsRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/settings', async (request) => {
    const auth = requireAuth(request);
    const counts = queryOne<{ assets: number; jobs: number; collections: number }>(
      deps.db,
      `SELECT
        (SELECT COUNT(*) FROM assets WHERE workspace_id = ? AND deleted_at IS NULL) AS assets,
        (SELECT COUNT(*) FROM jobs WHERE workspace_id = ?) AS jobs,
        (SELECT COUNT(*) FROM collections WHERE workspace_id = ?) AS collections`,
      auth.workspace.id,
      auth.workspace.id,
      auth.workspace.id,
    );
    return {
      workspace: auth.workspace,
      user: auth.user,
      counts,
      storage: {
        dataDir: deps.storage.dataDir,
        mediaRoot: deps.storage.mediaRoot,
        diskFreeBytes: await deps.storage.diskFreeBytes(),
      },
      limits: {
        maxUploadBytes: config.MAX_UPLOAD_BYTES,
        maxDownloadBytes: config.MAX_DOWNLOAD_BYTES,
        jobWorkers: config.JOB_WORKERS,
        sessionTtlHours: config.SESSION_TTL_HOURS,
      },
      privacy: {
        localFirst: true,
        telemetry: 'none',
        outboundRequests: 'Only URLs you explicitly submit are contacted.',
      },
    };
  });

  app.patch('/api/settings/workspace', async (request) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') throw forbidden('Only the workspace owner can rename the workspace');
    const body = z.object({ name: z.string().trim().min(1).max(60) }).parse(request.body);
    execute(deps.db, 'UPDATE workspaces SET name = ? WHERE id = ?', body.name, auth.workspace.id);
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'workspace.renamed',
      targetType: 'workspace',
      targetId: auth.workspace.id,
      metadata: { name: body.name },
    });
    return { ok: true, name: body.name };
  });

  /** Full metadata export (no media bytes) as a portable JSON document. */
  app.get('/api/settings/export-metadata', async (request, reply) => {
    const auth = requireAuth(request);
    const assets = queryAll<Record<string, unknown>>(
      deps.db,
      `SELECT id, title, kind, status, mime_type, size_bytes, sha256, duration_ms, width, height,
              video_codec, audio_codec, container, bit_rate, source_kind, source_url,
              parent_asset_id, created_at, acquired_at, probe_json, quality_json
         FROM assets WHERE workspace_id = ? AND deleted_at IS NULL`,
      auth.workspace.id,
    );
    const collections = queryAll<Record<string, unknown>>(
      deps.db,
      'SELECT id, name, description, created_at, updated_at FROM collections WHERE workspace_id = ?',
      auth.workspace.id,
    );
    const items = queryAll<Record<string, unknown>>(
      deps.db,
      `SELECT ci.collection_id, ci.asset_id FROM collection_items ci
         JOIN collections c ON c.id = ci.collection_id WHERE c.workspace_id = ?`,
      auth.workspace.id,
    );
    const tags = queryAll<Record<string, unknown>>(
      deps.db,
      `SELECT t.id, t.name, at.asset_id FROM tags t
         LEFT JOIN asset_tags at ON at.tag_id = t.id WHERE t.workspace_id = ?`,
      auth.workspace.id,
    );
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'data.exported',
      targetType: 'workspace',
      targetId: auth.workspace.id,
    });
    reply.header('Content-Type', 'application/json');
    reply.header(
      'Content-Disposition',
      `attachment; filename="sonicwire-library-${auth.workspace.id.slice(0, 8)}.json"`,
    );
    return {
      format: 'sonicwire.library/1',
      exportedAt: new Date().toISOString(),
      workspace: auth.workspace,
      assets,
      collections,
      collectionItems: items,
      tags,
    };
  });

  /**
   * Irreversible workspace content deletion. Requires typing the workspace name
   * so it cannot be triggered by a stray click, and is limited to the owner.
   */
  app.post('/api/settings/purge', async (request, reply) => {
    const auth = requireAuth(request);
    if (auth.role !== 'owner') throw forbidden('Only the owner may purge workspace content');
    const body = z.object({ confirmName: z.string().min(1).max(80) }).parse(request.body);
    if (body.confirmName !== auth.workspace.name) {
      throw badRequest('Type the workspace name exactly to confirm deletion');
    }
    const assets = queryAll<{ id: string }>(
      deps.db,
      'SELECT id FROM assets WHERE workspace_id = ?',
      auth.workspace.id,
    );
    execute(deps.db, 'DELETE FROM jobs WHERE workspace_id = ?', auth.workspace.id);
    execute(deps.db, 'DELETE FROM collections WHERE workspace_id = ?', auth.workspace.id);
    execute(deps.db, 'DELETE FROM tags WHERE workspace_id = ?', auth.workspace.id);
    execute(deps.db, 'DELETE FROM assets WHERE workspace_id = ?', auth.workspace.id);
    execute(deps.db, 'DELETE FROM workflows WHERE workspace_id = ?', auth.workspace.id);
    await fsp.rm(path.join(deps.storage.mediaRoot, auth.workspace.id), { recursive: true, force: true });
    await fsp.mkdir(path.join(deps.storage.mediaRoot, auth.workspace.id), { recursive: true });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'workspace.content_purged',
      targetType: 'workspace',
      targetId: auth.workspace.id,
      metadata: { assets: assets.length },
    });
    return reply.send({ ok: true, removedAssets: assets.length });
  });
}
