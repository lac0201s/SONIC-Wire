import { envSchema } from './env.js';

/**
 * Configuration is parsed once, validated once. Every module receives the
 * resolved config instead of reading process.env so that tests can build an
 * isolated instance and misconfiguration fails at boot rather than at 3am.
 */
export const config = envSchema.parse(process.env);

export type Config = typeof config;
export type EnvInput = NodeJS.ProcessEnv;
