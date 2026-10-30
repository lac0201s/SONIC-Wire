import type { FastifyInstance } from 'fastify';
import { JobQuerySchema } from '@sonicwire/contracts';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { notFound } from '../../http/errors.js';
import { recordAudit } from '../audit/service.js';
import { realtimeBus } from '../events/bus.js';
import { getJob, listJobs, requestCancel, toJob } from './repository.js';

export async function registerJobRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  app.get('/api/jobs', async (request) => {
    const auth = requireAuth(request);
    const query = JobQuerySchema.parse(request.query);
    return { items: listJobs(deps.db, auth.workspace.id, query) };
  });

  app.get('/api/jobs/:id', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const job = getJob(deps.db, auth.workspace.id, id);
    if (!job) throw notFound('Job not found');
    return job;
  });

  app.post('/api/jobs/:id/cancel', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const row = requestCancel(deps.db, auth.workspace.id, id);
    if (!row) throw notFound('Job not found');
    deps.queue.cancel(auth.workspace.id, id);
    realtimeBus.publish({ type: 'job.updated', job: toJob(row) });
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'job.cancel_requested',
      targetType: 'job',
      targetId: id,
    });
    return { ok: true, status: row.status };
  });

  /**
   * Server-sent events. SSE is used instead of a WebSocket here because the
   * stream is server-to-client only, survives proxies better and reconnects
   * natively. The client resynchronises by refetching after every reconnect.
   */
  app.get('/api/events', async (request, reply) => {
    requireAuth(request);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write('retry: 3000\n\n');

    const send = (payload: unknown): void => {
      if (reply.raw.writableEnded) return;
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({ type: 'heartbeat', at: new Date().toISOString() });
    const unsubscribe = realtimeBus.subscribe(send);
    const ping = setInterval(() => send({ type: 'heartbeat', at: new Date().toISOString() }), 20_000);
    ping.unref();

    request.raw.on('close', () => {
      clearInterval(ping);
      unsubscribe();
      if (!reply.raw.writableEnded) reply.raw.end();
    });
  });
}
