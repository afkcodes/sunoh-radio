import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';

export default async function adminAuditRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: number; offset?: number } }>('/audit', async (req) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const total = (await query('SELECT count(*)::int AS total FROM audit_log')).rows[0].total;
    const rows = (
      await query(
        `SELECT id, action, station_id, actor, details, created_at
           FROM audit_log ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      )
    ).rows;
    return { data: rows, pagination: { limit, offset, total } };
  });
}
