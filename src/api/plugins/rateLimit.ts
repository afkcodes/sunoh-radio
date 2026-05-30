import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import { config } from '../../config';

/**
 * Global IP-based rate limiting. In-memory store (per instance) — swap for the
 * Redis store when running multiple replicas. Adds X-RateLimit-* headers.
 */
export default fp(async (app) => {
  await app.register(rateLimit, {
    max: config.api.rateLimit.max,
    timeWindow: config.api.rateLimit.timeWindow,
  });
});
