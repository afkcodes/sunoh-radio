import type { FastifyInstance } from 'fastify';
import { query } from '../../db';
import { config } from '../../config';

const TTL = config.api.aggregateCacheTtl;

export default async function statsRoutes(app: FastifyInstance) {
  app.get('/stats', async () => {
    const key = 'stats:summary';
    const cached = await app.cacheGet(key);
    if (cached) return cached;

    const [byStatus, distinct] = await Promise.all([
      query(`SELECT status, count(*)::int AS count FROM radio_stations GROUP BY status`),
      query(
        `SELECT
           (SELECT count(*)::int FROM (SELECT DISTINCT unnest(countries) FROM radio_stations WHERE status='working') c) AS countries,
           (SELECT count(*)::int FROM (SELECT DISTINCT unnest(genres) FROM radio_stations WHERE status='working') g) AS genres`,
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const row of byStatus.rows) {
      statusCounts[row.status] = row.count;
      total += row.count;
    }

    const data = {
      total,
      by_status: statusCounts,
      working: statusCounts.working ?? 0,
      countries: distinct.rows[0].countries as number,
      genres: distinct.rows[0].genres as number,
    };
    await app.cacheSet(key, data, TTL);
    return data;
  });
}
