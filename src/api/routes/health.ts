import type { FastifyInstance } from 'fastify';
import { query } from '../../db';

export default async function healthRoutes(app: FastifyInstance) {
  // Liveness: process is up.
  app.get('/health', async () => ({ status: 'ok', service: 'sunoh-radio-api' }));

  // Readiness: dependencies (DB) reachable.
  app.get('/ready', async (_req, reply) => {
    try {
      await query('SELECT 1');
      return { status: 'ready' };
    } catch (err) {
      app.log.error(err, 'readiness check failed');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });
}
