import type { FastifyInstance } from 'fastify';
import { CredentialsSchema, SetupSchema, type SessionInfo } from '@sonicwire/contracts';
import { z } from 'zod';
import { config } from '../../config.js';
import type { Database } from '../../db/index.js';
import { recordAudit } from '../audit/service.js';
import { SESSION_COOKIE, requireAuth } from '../../http/auth-plugin.js';
import { badRequest, conflict, unauthorized } from '../../http/errors.js';
import {
  authenticate,
  countUsers,
  createOwner,
  createSessionFor,
  deleteSession,
  hashPassword,
  recordLoginFailure,
  verifyPassword,
} from './service.js';
import { execute, nowIso, queryOne } from '../../db/index.js';

const cookieOptions = () => ({
  path: '/',
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
  maxAge: config.SESSION_TTL_HOURS * 60 * 60,
});

const CAPABILITIES = [
  'library.read',
  'library.write',
  'acquisition.run',
  'transform.run',
  'workflow.run',
  'observatory.read',
];

export async function registerAuthRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/auth/session', async (request) => {
    const needsSetup = countUsers(db) === 0;
    const auth = request.auth;
    const session: SessionInfo = {
      needsSetup,
      user: auth?.user ?? null,
      workspace: auth?.workspace ?? null,
      csrfToken: auth?.csrfToken ?? null,
      capabilities: auth ? CAPABILITIES : [],
    };
    return session;
  });

  app.post(
    '/api/auth/setup',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const input = SetupSchema.parse(request.body);
      const session = createOwner(db, input);
      recordAudit(db, {
        workspaceId: session.workspace.id,
        actorId: session.user.id,
        action: 'workspace.created',
        targetType: 'workspace',
        targetId: session.workspace.id,
      });
      reply.setCookie(SESSION_COOKIE, session.token, cookieOptions());
      const info: SessionInfo = {
        needsSetup: false,
        user: session.user,
        workspace: session.workspace,
        csrfToken: session.csrfToken,
        capabilities: CAPABILITIES,
      };
      return reply.code(201).send(info);
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email, password } = CredentialsSchema.parse(request.body);
      if (countUsers(db) === 0) throw conflict('SonicWire has not been initialised yet');
      try {
        const identity = authenticate(db, email, password);
        const session = createSessionFor(
          db,
          identity.userId,
          identity.workspaceId,
          identity.role,
          request.headers['user-agent'],
        );
        recordAudit(db, {
          workspaceId: session.workspace.id,
          actorId: session.user.id,
          action: 'auth.login',
          targetType: 'user',
          targetId: session.user.id,
        });
        reply.setCookie(SESSION_COOKIE, session.token, cookieOptions());
        const info: SessionInfo = {
          needsSetup: false,
          user: session.user,
          workspace: session.workspace,
          csrfToken: session.csrfToken,
          capabilities: CAPABILITIES,
        };
        return info;
      } catch (error) {
        recordLoginFailure(db, email);
        throw error;
      }
    },
  );

  app.post('/api/auth/logout', async (request, reply) => {
    const auth = requireAuth(request);
    deleteSession(db, auth.sessionId);
    recordAudit(db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'auth.logout',
      targetType: 'user',
      targetId: auth.user.id,
    });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.post('/api/auth/password', async (request, reply) => {
    const auth = requireAuth(request);
    const body = z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z.string().min(10).max(200),
      })
      .parse(request.body);
    const row = queryOne<{ password_hash: string }>(
      db,
      'SELECT password_hash FROM users WHERE id = ?',
      auth.user.id,
    );
    if (!row || !verifyPassword(body.currentPassword, row.password_hash)) {
      throw unauthorized('Current password is incorrect');
    }
    if (body.currentPassword === body.newPassword) {
      throw badRequest('The new password must be different');
    }
    execute(
      db,
      'UPDATE users SET password_hash = ? WHERE id = ?',
      hashPassword(body.newPassword),
      auth.user.id,
    );
    // Invalidate every other session for this user after a credential change.
    execute(db, 'DELETE FROM sessions WHERE user_id = ? AND id <> ?', auth.user.id, auth.sessionId);
    recordAudit(db, {
      workspaceId: auth.workspace.id,
      actorId: auth.user.id,
      action: 'auth.password_changed',
      targetType: 'user',
      targetId: auth.user.id,
    });
    return { ok: true, updatedAt: nowIso() };
  });
}
