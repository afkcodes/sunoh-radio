import { buildApp } from './app';
import { assertConfig, config } from '../config';
import { closePool } from '../db';

async function start() {
  assertConfig();
  const app = await buildApp();

  // Graceful shutdown: stop accepting connections, then close the DB pool.
  // Important under Docker `restart: always` / orchestrator SIGTERM.
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    try {
      await app.close();
      await closePool();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'error during shutdown');
      process.exit(1);
    }
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => void shutdown(signal));
  }

  try {
    await app.listen({ port: config.api.port, host: config.api.host });
  } catch (err) {
    app.log.error(err, 'failed to start server');
    await closePool();
    process.exit(1);
  }
}

void start();
