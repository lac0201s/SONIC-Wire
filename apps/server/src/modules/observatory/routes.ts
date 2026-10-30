import type { FastifyInstance } from 'fastify';
import type { ObservatorySummary } from '@sonicwire/contracts';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { queryAll, queryOne } from '../../db/index.js';
import { listAudit } from '../audit/service.js';
import { jobMetrics } from '../jobs/repository.js';
import { toolchain } from '../media/ffmpeg.js';
import { config } from '../../config.js';

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[index] as number);
}

let storageCache: { at: number; bytes: number; cacheBytes: number } | null = null;

export async function registerObservatoryRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/observatory/summary', async (request) => {
    const auth = requireAuth(request);
    const workspaceId = auth.workspace.id;

    const metrics = jobMetrics(deps.db, workspaceId);
    const probeDurations = metrics.durations
      .filter((entry) => entry.kind === 'media.probe')
      .map((entry) => new Date(entry.finishedAt).getTime() - new Date(entry.startedAt).getTime());
    const transformDurations = metrics.durations
      .filter((entry) => entry.kind === 'media.transform' || entry.kind === 'workflow.run')
      .map((entry) => new Date(entry.finishedAt).getTime() - new Date(entry.startedAt).getTime());

    const byKindRows = queryAll<{ kind: string; n: number }>(
      deps.db,
      'SELECT kind, COUNT(*) AS n FROM assets WHERE workspace_id = ? AND deleted_at IS NULL GROUP BY kind',
      workspaceId,
    );
    const byStatusRows = queryAll<{ status: string; n: number }>(
      deps.db,
      'SELECT status, COUNT(*) AS n FROM assets WHERE workspace_id = ? AND deleted_at IS NULL GROUP BY status',
      workspaceId,
    );
    const storageRow = queryOne<{ bytes: number; n: number; derived: number }>(
      deps.db,
      `SELECT COALESCE(SUM(size_bytes), 0) AS bytes, COUNT(*) AS n,
              COALESCE(SUM(CASE WHEN source_kind = 'derived' THEN size_bytes ELSE 0 END), 0) AS derived
         FROM assets WHERE workspace_id = ? AND deleted_at IS NULL`,
      workspaceId,
    );

    const now = Date.now();
    if (!storageCache || now - storageCache.at > 30_000) {
      const cacheBytes = await deps.storage.directoryBytes(deps.storage.tmpRoot);
      storageCache = { at: now, bytes: cacheBytes, cacheBytes };
    }

    const failures = queryAll<{
      id: string;
      title: string;
      error_message: string | null;
      updated_at: string;
    }>(
      deps.db,
      `SELECT id, title, error_message, updated_at FROM assets
        WHERE workspace_id = ? AND deleted_at IS NULL AND status = 'error'
        ORDER BY updated_at DESC LIMIT 8`,
      workspaceId,
    );

    const tools = await toolchain();
    const memory = process.memoryUsage();

    const summary: ObservatorySummary = {
      queue: metrics.queue,
      latency: {
        probeP50Ms: percentile(probeDurations, 50),
        probeP95Ms: percentile(probeDurations, 95),
        transformP50Ms: percentile(transformDurations, 50),
        transformP95Ms: percentile(transformDurations, 95),
      },
      storage: {
        mediaBytes: storageRow?.bytes ?? 0,
        assetCount: storageRow?.n ?? 0,
        derivedBytes: storageRow?.derived ?? 0,
        cacheBytes: storageCache?.cacheBytes ?? 0,
        diskFreeBytes: await deps.storage.diskFreeBytes(),
      },
      runtime: {
        uptimeSeconds: Math.round(process.uptime()),
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        nodeVersion: process.version,
        workers: config.JOB_WORKERS,
        ffmpeg: {
          available: tools.available,
          version: tools.version,
          ffprobeVersion: tools.ffprobeVersion,
          path: tools.path,
          source: tools.source,
        },
      },
      assets: {
        byKind: Object.fromEntries(byKindRows.map((row) => [row.kind, row.n])),
        byStatus: Object.fromEntries(byStatusRows.map((row) => [row.status, row.n])),
        failures: failures.map((row) => ({
          assetId: row.id,
          title: row.title,
          message: row.error_message ?? 'Unknown error',
          at: row.updated_at,
        })),
      },
    };
    return summary;
  });

  app.get('/api/observatory/audit', async (request) => {
    const auth = requireAuth(request);
    return { items: listAudit(deps.db, auth.workspace.id, 60) };
  });
}
