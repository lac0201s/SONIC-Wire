import type { FastifyInstance } from 'fastify';
import type { Provider } from '@sonicwire/contracts';
import type { AppDeps } from '../../http/app.js';
import { requireAuth } from '../../http/auth-plugin.js';
import { notFound, providerNotConfigured } from '../../http/errors.js';
import { execute, nowIso, queryAll } from '../../db/index.js';
import { recordAudit } from '../audit/service.js';
import { PROVIDERS, RESEARCH_DATE, isConfigured, providerById } from './registry.js';

export async function registerProviderRoutes(app: FastifyInstance, deps: AppDeps): Promise<void> {
  /**
   * The catalogue itself is public policy data (used by the marketing site);
   * workspace connection state is only read for authenticated requests.
   */
  app.get('/api/providers', async (request) => {
    const auth = request.auth;
    const connections = auth
      ? queryAll<{ provider_id: string; status: string }>(
          deps.db,
          'SELECT provider_id, status FROM provider_connections WHERE workspace_id = ?',
          auth.workspace.id,
        )
      : [];
    const connectionMap = new Map(connections.map((row) => [row.provider_id, row.status]));
    const items: Provider[] = PROVIDERS.map((provider) => {
      const connection = connectionMap.get(provider.id);
      return {
        id: provider.id,
        name: provider.name,
        category: provider.category,
        auth: provider.auth,
        capabilities: provider.capabilities,
        ingestion: provider.ingestion,
        restrictions: provider.restrictions,
        connectionStatus: connection
          ? (connection as Provider['connectionStatus'])
          : isConfigured(provider)
            ? 'available'
            : 'not_configured',
        docsUrl: provider.docsUrl,
        lastChecked: RESEARCH_DATE,
      } satisfies Provider;
    });
    return { items };
  });

  app.post('/api/providers/:id/connect', async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const provider = providerById(id);
    if (!provider) throw notFound('Unknown provider');
    if (!isConfigured(provider)) {
      throw providerNotConfigured(
        `${provider.name} needs operator-supplied OAuth credentials (${provider.requiredEnv.join(', ')}). SonicWire never fabricates a connection: set those environment variables, register the callback URL with the provider, then retry.`,
      );
    }
    // Credentials exist but the OAuth round-trip is a separate, explicitly
    // human-approved step; no silent connection is created here.
    recordAudit(deps.db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'provider.connect_requested',
      targetType: 'provider',
      targetId: provider.id,
    });
    return reply.code(409).send({
      error: {
        code: 'provider_not_configured',
        message:
          'Credentials are present, but the OAuth consent flow is not enabled in this build. Complete the provider handshake from the settings screen once the callback is registered.',
      },
    });
  });

  app.delete('/api/providers/:id/connection', async (request) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const removed = execute(
      deps.db,
      'DELETE FROM provider_connections WHERE workspace_id = ? AND provider_id = ?',
      auth.workspace.id,
      id,
    );
    if (removed === 0) throw notFound('No connection stored for that provider');
    execute(
      deps.db,
      'INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
      crypto.randomUUID(),
      auth.workspace.id,
      auth.user.id,
      'provider.disconnected',
      'provider',
      id,
      nowIso(),
    );
    return { ok: true };
  });
}
