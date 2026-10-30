import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Database } from '../db/index.js';
import { config } from '../config.js';
import { forbidden, unauthorized } from './errors.js';
import { resolveSession, type AuthContext } from '../modules/auth/service.js';

export const SESSION_COOKIE = 'sonicwire_session';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

/**
 * Paths reachable without a session. Everything else under /api requires one.
 * These are also the only paths exempt from CSRF enforcement (they either have
 * no session yet or are read-only).
 */
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/auth/session',
  '/api/auth/setup',
  '/api/auth/login',
  // Public capability catalogue: static provider policy, no workspace data.
  '/api/providers',
]);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigin(origin: string, request: FastifyRequest): boolean {
  if (config.NODE_ENV !== 'production') return true;
  const configured = config.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

export function registerAuthPlugin(app: FastifyInstance, db: Database): void {
  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE];
    request.auth = token ? resolveSession(db, token) : null;

    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api')) return;
    if (PUBLIC_PATHS.has(path)) return;

    if (!request.auth) throw unauthorized();

    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowedOrigin(origin, request)) {
        throw forbidden('Request origin is not allowed');
      }
      const csrf = request.headers['x-sonicwire-csrf'];
      if (typeof csrf !== 'string' || csrf !== request.auth.csrfToken) {
        throw forbidden('Missing or invalid CSRF token');
      }
    }
  });
}

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) throw unauthorized();
  return request.auth;
}
