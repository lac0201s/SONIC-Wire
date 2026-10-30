import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATA_DIR: '/tmp/sonicwire-vitest-data',
      RATE_LIMIT_MAX: '100000',
      JOB_WORKERS: '2',
      ALLOW_PRIVATE_NETWORK: 'false',
    },
  },
});
