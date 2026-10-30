import type { FastifyInstance } from 'fastify';
import { API_VERSION } from '@sonicwire/contracts';
import { z } from 'zod';
import type { AppDeps } from '../../http/app.js';
import { config } from '../../config.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { countUsers } from '../auth/service.js';
import { mediaCoreState } from '../media/analysis-client.js';
import { presetDescriptors } from '../media/presets.js';
import { toolchain } from '../media/ffmpeg.js';
import { realtimeBus } from '../events/bus.js';

export const APP_VERSION = '0.1.0';

export async function registerSystemRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/health', async () => {
    const tools = await toolchain();
    const core = await mediaCoreState();
    const dbOk = (() => {
      try {
        deps.db.prepare('SELECT 1').get();
        return true;
      } catch {
        return false;
      }
    })();
    return {
      status: dbOk && tools.available ? 'ok' : 'degraded',
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database: { ok: dbOk, detail: dbOk ? 'SQLite responding' : 'SQLite query failed' },
        ffmpeg: {
          ok: tools.available,
          detail: tools.available
            ? `${tools.version ?? 'unknown'} (${tools.source})`
            : (tools.error ?? 'FFmpeg unavailable; probing and transforms are disabled'),
        },
        queue: {
          ok: true,
          detail: `${deps.queue.activeCount} active of ${config.JOB_WORKERS} workers`,
        },
        mediaCore: {
          ok: core.configured && 'reachable' in core && core.reachable,
          detail: core.detail,
        },
      },
    };
  });

  /** Capability surface so the UI never has to guess what this build supports. */
  app.get('/api/system/capabilities', async (request) => {
    requireAuth(request);
    const tools = await toolchain();
    const core = await mediaCoreState();
    return {
      apiVersion: API_VERSION,
      appVersion: APP_VERSION,
      environment: config.NODE_ENV,
      initialized: countUsers(deps.db) > 0,
      ffmpeg: {
        available: tools.available,
        version: tools.version,
        ffprobeVersion: tools.ffprobeVersion,
        source: tools.source,
        encoders: tools.encoders.filter((encoder) =>
          ['libx264', 'libmp3lame', 'aac', 'libopus', 'flac', 'pcm_s16le', 'mjpeg', 'libvpx-vp9'].includes(encoder),
        ),
        error: tools.error,
      },
      limits: {
        maxUploadBytes: config.MAX_UPLOAD_BYTES,
        maxDownloadBytes: config.MAX_DOWNLOAD_BYTES,
        maxDownloadSeconds: config.MAX_DOWNLOAD_SECONDS,
        jobWorkers: config.JOB_WORKERS,
        jobTimeoutSeconds: config.JOB_TIMEOUT_SECONDS,
        sessionTtlHours: config.SESSION_TTL_HOURS,
      },
      transforms: presetDescriptors(),
      analysis: {
        // Optional service: false is a supported deployment, not an error.
        available: core.configured,
        detail: core.detail,
      },
      realtimeSubscribers: realtimeBus.subscriberCount,
      privateNetworkAllowed: config.ALLOW_PRIVATE_NETWORK,
    };
  });

  app.post('/api/system/diagnostics', async (request) => {
    const auth = requireAuth(request);
    const tools = await toolchain();
    // Diagnostics deliberately omit secrets, tokens and user content.
    return {
      generatedAt: new Date().toISOString(),
      workspaceId: auth.workspace.id,
      node: process.version,
      platform: `${process.platform}/${process.arch}`,
      uptimeSeconds: Math.round(process.uptime()),
      memory: process.memoryUsage(),
      ffmpeg: { available: tools.available, version: tools.version, source: tools.source },
      config: {
        environment: config.NODE_ENV,
        workers: config.JOB_WORKERS,
        maxUploadBytes: config.MAX_UPLOAD_BYTES,
        rateLimitPerMinute: config.RATE_LIMIT_MAX,
      },
      note: 'Contains no credentials, cookies or media metadata by design.',
    };
  });

  app.get('/api/system/realtime-subscribers', async (request) => {
    requireAuth(request);
    return { count: realtimeBus.subscriberCount };
  });

  const feedback = z.object({
    message: z.string().trim().min(1).max(2000),
    rating: z.number().int().min(1).max(5).nullable().optional(),
  });
  void feedback;
}
