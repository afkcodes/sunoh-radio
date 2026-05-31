import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';
import { writeAudit } from '../../../lib/audit';
import {
  destroyImage,
  hasCloudinaryCreds,
  publicIdForSlug,
  uploadImage,
} from '../../../lib/cloudinary';

export default async function adminImageRoutes(app: FastifyInstance) {
  // Upload or REPLACE a station logo. The old Cloudinary asset is deleted first,
  // then the new file is uploaded and image_hosted/image_public_id updated.
  app.post<{ Params: { id: string } }>('/stations/:id/image', async (req, reply) => {
    if (!hasCloudinaryCreds()) {
      return reply.code(503).send({ error: 'Cloudinary is not configured' });
    }
    const cur = await query(
      'SELECT id, slug, image_public_id FROM radio_stations WHERE id = $1',
      [req.params.id],
    );
    if (!cur.rows.length) return reply.code(404).send({ error: 'Station not found' });
    const station = cur.rows[0];

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'No file uploaded (field name: file)' });
    if (!file.mimetype?.startsWith('image/')) {
      return reply.code(415).send({ error: 'Uploaded file must be an image' });
    }
    const buffer = await file.toBuffer();

    const newPublicId = publicIdForSlug(station.slug);
    // Delete the previous asset if it lived at a different public_id.
    if (station.image_public_id && station.image_public_id !== newPublicId) {
      await destroyImage(station.image_public_id);
    }
    const uploaded = await uploadImage(buffer, newPublicId);

    const res = await query(
      `UPDATE radio_stations
          SET image_hosted = $1, image_public_id = $2, image_status = 'hosted',
              last_image_attempt_at = now(), updated_at = now()
        WHERE id = $3
        RETURNING id, image_url, image_hosted, image_public_id, image_status,
                  COALESCE(image_hosted, image_url) AS image`,
      [uploaded.url, uploaded.publicId, station.id],
    );
    await writeAudit('image.replace', station.id, { publicId: uploaded.publicId });
    return res.rows[0];
  });

  // Remove the hosted logo (delete from Cloudinary + clear columns).
  app.delete<{ Params: { id: string } }>('/stations/:id/image', async (req, reply) => {
    const cur = await query(
      'SELECT id, image_public_id FROM radio_stations WHERE id = $1',
      [req.params.id],
    );
    if (!cur.rows.length) return reply.code(404).send({ error: 'Station not found' });
    if (cur.rows[0].image_public_id) await destroyImage(cur.rows[0].image_public_id);
    const res = await query(
      `UPDATE radio_stations
          SET image_hosted = NULL, image_public_id = NULL, image_status = 'pending', updated_at = now()
        WHERE id = $1
        RETURNING id, image_url, image_hosted, image_public_id, image_status,
                  COALESCE(image_hosted, image_url) AS image`,
      [req.params.id],
    );
    await writeAudit('image.delete', cur.rows[0].id, {});
    return res.rows[0];
  });
}
