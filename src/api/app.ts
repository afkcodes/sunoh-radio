import Fastify, { type FastifyInstance } from 'fastify';
import { config } from '../config';
import cachePlugin from './plugins/cache';
import rateLimitPlugin from './plugins/rateLimit';
import securityPlugin from './plugins/security';
import authPlugin from './plugins/auth';
import staticPlugin from './plugins/static';
import healthRoutes from './routes/health';
import stationRoutes from './routes/stations';
import statsRoutes from './routes/stats';
import taxonomyRoutes from './routes/taxonomy';
import adminRoutes from './routes/admin';

export interface BuildAppOptions {
  logger?: boolean | object;
}

/**
 * Build the Fastify instance: registers plugins + routes and returns the app
 * WITHOUT calling listen(). Used by server.ts (production) and by tests via
 * `app.inject()`.
 */
export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? { level: config.api.logLevel },
    trustProxy: true, // correct client IPs behind a load balancer / CDN
    bodyLimit: 15 * 1024 * 1024, // allow CSV/JSON imports
  });

  // Cross-cutting plugins
  await app.register(securityPlugin);
  await app.register(rateLimitPlugin);
  await app.register(cachePlugin);
  await app.register(authPlugin);

  // Public read API
  await app.register(healthRoutes);
  await app.register(stationRoutes);
  await app.register(taxonomyRoutes);
  await app.register(statsRoutes);

  // Admin API (auth-gated) under /admin/api
  await app.register(adminRoutes, { prefix: '/admin/api' });

  // Serve the built admin SPA at /admin (production only) — must be last so its
  // global not-found handler is registered after all routes.
  await app.register(staticPlugin);

  return app;
}

export default buildApp;
