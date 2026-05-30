import caching from '@fastify/caching';
import fp from 'fastify-plugin';
import { config } from '../../config';

/**
 * Caching layer:
 *  - Sets `Cache-Control: public, max-age=<ttl>` on responses so a CDN/edge can
 *    absorb the bulk of read traffic (the cheapest scale lever for read-only,
 *    slow-changing data).
 *  - Decorates the instance with a small server-side cache (in-memory LRU)
 *    used by the aggregate endpoints (/countries, /genres, /stats). At
 *    multi-replica scale, swap the default store for abstract-cache-redis.
 */

declare module 'fastify' {
  interface FastifyInstance {
    cacheGet<T = unknown>(key: string): Promise<T | null>;
    cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  }
}

export default fp(async (app) => {
  await app.register(caching, {
    privacy: caching.privacy.PUBLIC,
    expiresIn: config.api.aggregateCacheTtl,
  });

  app.decorate('cacheGet', function <T = unknown>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      app.cache.get(key, (err, cached) => {
        if (err || !cached) return resolve(null);
        resolve((cached as { item: T }).item);
      });
    });
  });

  app.decorate('cacheSet', function (key: string, value: unknown, ttlSeconds: number): Promise<void> {
    return new Promise((resolve) => {
      app.cache.set(key, value, ttlSeconds * 1000, () => resolve());
    });
  });
});
