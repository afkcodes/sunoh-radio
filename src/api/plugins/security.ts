import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';
import { config } from '../../config';

/**
 * Security headers (helmet) + CORS allow-list. Origins come from config
 * (CORS_ORIGINS); default '*' in dev, explicit list expected in production.
 */
export default fp(async (app) => {
  await app.register(helmet, {
    // The API serves JSON only; CSP is irrelevant and would just add overhead.
    contentSecurityPolicy: false,
  });

  const origins = config.api.corsOrigins;
  await app.register(cors, {
    origin: origins.includes('*') ? true : origins,
    methods: ['GET'],
  });
});
