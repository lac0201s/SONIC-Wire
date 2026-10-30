import path from 'node:path';
import { z } from 'zod';

const bool = (fallback: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : /^(1|true|yes|on)$/i.test(v)));

const int = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().int().min(min).max(max));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: int(8787, 1, 65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATA_DIR: z.string().default(path.resolve(process.cwd(), 'var')),
  /** Allows the API to reach loopback/private addresses. Development only. */
  ALLOW_PRIVATE_NETWORK: bool(false),
  MAX_UPLOAD_BYTES: int(2 * 1024 * 1024 * 1024, 1024, 16 * 1024 * 1024 * 1024),
  MAX_DOWNLOAD_BYTES: int(1024 * 1024 * 1024, 1024, 16 * 1024 * 1024 * 1024),
  MAX_DOWNLOAD_SECONDS: int(900, 5, 7200),
  JOB_WORKERS: int(2, 1, 16),
  JOB_MAX_ATTEMPTS: int(3, 1, 10),
  JOB_LEASE_SECONDS: int(120, 10, 3600),
  JOB_TIMEOUT_SECONDS: int(1800, 10, 14400),
  SESSION_TTL_HOURS: int(24 * 14, 1, 24 * 365),
  RATE_LIMIT_MAX: int(600, 10, 100000),
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),
  /**
   * Base URL of the optional Python `media-core` service that performs the deep
   * measurements (loudness, silence, black frames, peaks). When unset the
   * analysis routes answer `503 core_unavailable` instead of inventing numbers.
   */
  MEDIA_CORE_URL: z.string().url().optional(),
  MEDIA_CORE_TIMEOUT_MS: int(120000, 1000, 900000),
  /** When set, the API serves the built web app from this directory. */
  WEB_DIST_DIR: z.string().optional(),
  /** Comma separated list of extra origins allowed to call the API (dev proxies). */
  ALLOWED_ORIGINS: z.string().default(''),
  TRUST_PROXY: bool(false),
  /**
   * Marks the session cookie Secure. Defaults to on for production builds,
   * which assumes TLS termination in front of the API. Set COOKIE_SECURE=false
   * only for a throwaway HTTP instance on a trusted network.
   */
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? undefined : /^(1|true|yes|on)$/i.test(v))),
});

export type Env = z.infer<typeof envSchema>;
