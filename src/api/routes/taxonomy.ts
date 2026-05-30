import type { FastifyInstance } from 'fastify';
import { query } from '../../db';
import { config } from '../../config';

const TTL = config.api.aggregateCacheTtl;

/**
 * Aggregate facets used to build filter UIs. These change slowly, so results
 * are cached server-side (and via Cache-Control for the CDN).
 */
async function facetCounts(column: 'countries' | 'genres' | 'languages') {
  const res = await query(
    `SELECT value, count(*)::int AS count
       FROM radio_stations, unnest(${column}) AS value
      WHERE status = 'working'
      GROUP BY value
      ORDER BY count DESC, value ASC`,
  );
  return res.rows;
}

export default async function taxonomyRoutes(app: FastifyInstance) {
  app.get('/countries', async () => {
    const key = 'facet:countries';
    const cached = await app.cacheGet(key);
    if (cached) return cached;
    const data = await facetCounts('countries');
    await app.cacheSet(key, data, TTL);
    return data;
  });

  app.get('/genres', async () => {
    const key = 'facet:genres';
    const cached = await app.cacheGet(key);
    if (cached) return cached;
    const data = await facetCounts('genres');
    await app.cacheSet(key, data, TTL);
    return data;
  });

  app.get('/languages', async () => {
    const key = 'facet:languages';
    const cached = await app.cacheGet(key);
    if (cached) return cached;
    const data = await facetCounts('languages');
    await app.cacheSet(key, data, TTL);
    return data;
  });
}
