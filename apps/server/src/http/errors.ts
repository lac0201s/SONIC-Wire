import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type { ErrorCode } from '@sonicwire/contracts';
import { logger } from '../logger.js';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  unsupported_media: 415,
  provider_unavailable: 503,
  provider_not_configured: 409,
  upstream_failed: 502,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError('bad_request', message, details);
export const unauthorized = (message = 'Authentication required') =>
  new AppError('unauthorized', message);
export const forbidden = (message = 'Not permitted') => new AppError('forbidden', message);
export const notFound = (message = 'Not found') => new AppError('not_found', message);
export const conflict = (message: string, details?: unknown) =>
  new AppError('conflict', message, details);
export const unsupportedMedia = (message: string) => new AppError('unsupported_media', message);
export const providerNotConfigured = (message: string) =>
  new AppError('provider_not_configured', message);

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Consistent error envelope for every failure, with correlation id. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | ZodError, req: FastifyRequest, reply: FastifyReply) => {
    const requestId = req.id;

    if (error instanceof AppError) {
      if (error.status >= 500) logger.error({ err: error, requestId }, error.message);
      return reply
        .code(error.status)
        .send({ error: { code: error.code, message: error.message, details: error.details, requestId } });
    }

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: 'bad_request',
          message: 'Request validation failed',
          details: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
          requestId,
        },
      });
    }

    // Fastify's own errors carry statusCode; preserve client-safe ones.
    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode && fastifyError.statusCode < 500) {
      const code = fastifyError.statusCode === 413 ? 'payload_too_large' : 'bad_request';
      return reply
        .code(fastifyError.statusCode)
        .send({ error: { code, message: fastifyError.message, requestId } });
    }

    logger.error({ err: error, requestId }, 'unhandled request error');
    return reply.code(500).send({
      error: {
        code: 'internal',
        message: 'An unexpected error occurred. Reference this id when reporting the issue.',
        requestId,
      },
    });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      error: { code: 'not_found', message: `No route for ${req.method} ${req.url}`, requestId: req.id },
    });
  });
}
