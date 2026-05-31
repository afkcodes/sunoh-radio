import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';
import { writeAudit } from '../../../lib/audit';
import { destroyImage } from '../../../lib/cloudinary';

interface BulkBody {
  action: 'delete' | 'set_status' | 'set_verified';
  ids: number[];
  value?: string | boolean;
}

export default async function adminBulkRoutes(app: FastifyInstance) {
  app.post<{ Body: BulkBody }>('/stations/bulk', async (req, reply) => {
    const { action, ids, value } = req.body ?? ({} as BulkBody);
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids[] is required' });
    }
    const cleanIds = ids.map(Number).filter((n) => Number.isInteger(n));
    if (cleanIds.length === 0) return reply.code(400).send({ error: 'No valid ids' });

    if (action === 'delete') {
      const res = await query(
        'DELETE FROM radio_stations WHERE id = ANY($1::int[]) RETURNING id, image_public_id',
        [cleanIds],
      );
      // Best-effort: clean up Cloudinary assets for deleted rows.
      await Promise.all(
        res.rows.filter((r) => r.image_public_id).map((r) => destroyImage(r.image_public_id)),
      );
      await writeAudit('bulk.delete', null, { count: res.rowCount, ids: cleanIds });
      return { ok: true, affected: res.rowCount };
    }

    if (action === 'set_status') {
      const status = String(value);
      if (!['working', 'broken', 'untested'].includes(status)) {
        return reply.code(400).send({ error: 'value must be working|broken|untested' });
      }
      const res = await query(
        'UPDATE radio_stations SET status = $1, updated_at = now() WHERE id = ANY($2::int[])',
        [status, cleanIds],
      );
      await writeAudit('bulk.set_status', null, { status, count: res.rowCount });
      return { ok: true, affected: res.rowCount };
    }

    if (action === 'set_verified') {
      const verified = value === true || value === 'true';
      const res = await query(
        'UPDATE radio_stations SET is_verified = $1, updated_at = now() WHERE id = ANY($2::int[])',
        [verified, cleanIds],
      );
      await writeAudit('bulk.set_verified', null, { verified, count: res.rowCount });
      return { ok: true, affected: res.rowCount };
    }

    return reply.code(400).send({ error: 'Unknown action' });
  });
}
