import path from 'node:path';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
import type { Database } from '../db/index.js';
import { logger } from '../logger.js';
import type { JobQueue } from '../modules/jobs/queue.js';
import type { Storage } from '../modules/storage/storage.js';
import { registerAuthPlugin } from './auth-plugin.js';
import { registerErrorHandler } from './errors.js';
import { registerAuthRoutes } from '../modules/auth/routes.js';
import { registerLibraryRoutes } from '../modules/library/routes.js';
import { registerAcquisitionRoutes } from '../modules/acquisition/routes.js';
import { registerJobRoutes } from '../modules/jobs/routes.js';
import { registerWorkflowRoutes } from '../modules/workflows/routes.js';
import { registerProviderRoutes } from '../modules/providers/routes.js';
import { registerObservatoryRoutes } from '../modules/observatory/routes.js';
import { registerSystemRoutes } from '../modules/system/routes.js';
import { registerSettingsRoutes } from '../modules/settings/routes.js';

export interface AppDeps {
  db: Database;
  storage: Storage;
  queue: JobQueue;
  startedAt: number;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({
    loggerInstance: logger as unknown as FastifyBaseLogger,
    trustProxy: config.TRUST_PROXY,
    bodyLimit: 2 * 1024 * 1024,
    disableRequestLogging: config.NODE_ENV === 'test',
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_UPLOAD_BYTES,
      files: 1,
      fields: 8,
      fieldSize: 4096,
    },
  });
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.auth?.user.id ?? request.ip,
    allowList: () => config.NODE_ENV === 'test',
  });

  registerAuthPlugin(app, deps.db);
  registerErrorHandler(app);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (config.NODE_ENV === 'production') {
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
      );
    }
    return payload;
  });

  await registerAuthRoutes(app, deps.db);
  await registerSystemRoutes(app, deps);
  await registerLibraryRoutes(app, deps);
  await registerAcquisitionRoutes(app, deps);
  await registerJobRoutes(app, deps);
  await registerWorkflowRoutes(app, deps);
  await registerProviderRoutes(app, deps);
  await registerObservatoryRoutes(app, deps);
  await registerSettingsRoutes(app, deps);

  if (config.WEB_DIST_DIR) {
    registerStaticWeb(app, config.WEB_DIST_DIR);
  }

  return app;
}

/**
 * Serves the built single-page application. Only files that resolve inside the
 * dist root are readable; unknown non-API paths fall back to index.html so the
 * client router owns navigation.
 */
function registerStaticWeb(app: FastifyInstance, distDir: string): void {
  const root = path.resolve(distDir);

  app.get('/*', async (request, reply) => {
    const requestPath = (request.params as { '*': string })['*'] ?? '';
    if (requestPath.startsWith('api/')) {
      return reply.code(404).send({ error: { code: 'not_found', message: 'Not found' } });
    }
    const candidate = path.resolve(root, requestPath);
    if (!candidate.startsWith(root)) {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'Forbidden' } });
    }
    let target = candidate;
    let stat = await fsp.stat(target).catch(() => null);
    if (!stat || stat.isDirectory()) {
      target = path.join(root, 'index.html');
      stat = await fsp.stat(target).catch(() => null);
      if (!stat) {
        return reply.code(404).send({ error: { code: 'not_found', message: 'Web build not found' } });
      }
    }
    const extension = path.extname(target).toLowerCase();
    reply.header('Content-Type', CONTENT_TYPES[extension] ?? 'application/octet-stream');
    reply.header('Content-Length', String(stat.size));
    reply.header(
      'Cache-Control',
      target.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    return reply.send(createReadStream(target));
  });
}
