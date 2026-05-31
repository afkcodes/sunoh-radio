import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';

export default async function adminStatsRoutes(app: FastifyInstance) {
  app.get('/stats', async () => {
    const [byStatus, byImage, verified, distinct, topCountries, topGenres] = await Promise.all([
      query(`SELECT status, count(*)::int AS count FROM radio_stations GROUP BY status`),
      query(`SELECT image_status, count(*)::int AS count FROM radio_stations GROUP BY image_status`),
      query(`SELECT count(*)::int AS count FROM radio_stations WHERE is_verified`),
      query(
        `SELECT
           (SELECT count(*)::int FROM (SELECT DISTINCT unnest(countries) FROM radio_stations WHERE status='working') c) AS countries,
           (SELECT count(*)::int FROM (SELECT DISTINCT unnest(genres) FROM radio_stations WHERE status='working') g) AS genres`,
      ),
      query(
        `SELECT value, count(*)::int AS count FROM radio_stations, unnest(countries) AS value
          WHERE status='working' GROUP BY value ORDER BY count DESC LIMIT 10`,
      ),
      query(
        `SELECT value, count(*)::int AS count FROM radio_stations, unnest(genres) AS value
          WHERE status='working' GROUP BY value ORDER BY count DESC LIMIT 10`,
      ),
    ]);

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const r of byStatus.rows) {
      statusCounts[r.status] = r.count;
      total += r.count;
    }
    const imageCounts: Record<string, number> = {};
    for (const r of byImage.rows) imageCounts[r.image_status ?? 'unknown'] = r.count;

    return {
      total,
      by_status: statusCounts,
      working: statusCounts.working ?? 0,
      verified: verified.rows[0].count,
      images: imageCounts,
      hosted: imageCounts.hosted ?? 0,
      countries: distinct.rows[0].countries,
      genres: distinct.rows[0].genres,
      top_countries: topCountries.rows,
      top_genres: topGenres.rows,
    };
  });
}
