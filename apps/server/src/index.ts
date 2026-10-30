import { config } from './config.js';
import { openDatabase } from './db/index.js';
import { logger } from './logger.js';
import { buildApp } from './http/app.js';
import { Storage } from './modules/storage/storage.js';
import { JobQueue } from './modules/jobs/queue.js';
import { registerJobHandlers } from './modules/jobs/handlers.js';
import { purgeExpiredSessions } from './modules/auth/service.js';

async function main(): Promise<void> {
  const storage = new Storage(config.DATA_DIR);
  await storage.init();

  const db = openDatabase(`${config.DATA_DIR}/sonicwire.db`);
  const queue = new JobQueue(db);
  registerJobHandlers(queue, { db, storage, config });

  const app = await buildApp({ db, storage, queue, startedAt: Date.now() });

  queue.start();
  const maintenance = setInterval(
    () => {
      void storage.cleanupTmp().catch((error) => logger.warn({ err: error }, 'tmp cleanup failed'));
      try {
        const removed = purgeExpiredSessions(db);
        if (removed > 0) logger.info({ removed }, 'purged expired sessions');
      } catch (error) {
        logger.warn({ err: error }, 'session purge failed');
      }
    },
    60 * 60 * 1000,
  );
  maintenance.unref();

  await app.listen({ host: config.HOST, port: config.PORT });
  logger.info(
    {
      port: config.PORT,
      dataDir: config.DATA_DIR,
      environment: config.NODE_ENV,
      workers: config.JOB_WORKERS,
    },
    'SonicWire API listening',
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    clearInterval(maintenance);
    await queue.stop();
    await app.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled promise rejection');
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, 'SonicWire failed to start');
  process.exit(1);
});
