import type { FastifyInstance } from 'fastify';
import { query } from '../../../db';
import { normalizeUrl } from '../../../lib/normalizeUrl';
import { makeSlug } from '../../../sync_to_db';
import { writeAudit } from '../../../lib/audit';
import { destroyImage } from '../../../lib/cloudinary';

// Full column set for the admin (more than the public read API exposes).
const COLS = `
  id, slug, name, image_url, image_hosted, image_public_id, image_status,
  COALESCE(image_hosted, image_url) AS image,
  stream_url, normalized_url, providers, countries, genres, languages,
  status, codec, bitrate, sample_rate, failure_count, is_verified,
  last_tested_at, metadata, created_at, updated_at
`;

const SORTABLE: Record<string, string> = {
  name: 'name',
  created_at: 'created_at',
  updated_at: 'updated_at',
  last_tested_at: 'last_tested_at',
  status: 'status',
};

interface ListQuery {
  country?: string;
  genre?: string;
  language?: string;
  status?: string;
  q?: string;
  image_status?: string;
  is_verified?: string;
  sort?: string;
  dir?: string;
  limit?: number;
  offset?: number;
}

const ARRAY_FIELDS = ['countries', 'genres', 'languages'] as const;
const SCALAR_FIELDS = [
  'name',
  'image_url',
  'stream_url',
  'status',
  'codec',
  'bitrate',
  'sample_rate',
  'is_verified',
] as const;

export default async function adminStationRoutes(app: FastifyInstance) {
  // LIST
  app.get<{ Querystring: ListQuery }>('/stations', async (req) => {
    const { country, genre, language, status, q, image_status, is_verified } = req.query;
    const sort = SORTABLE[req.query.sort ?? ''] ?? 'created_at';
    const dir = (req.query.dir ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: (i: number) => string, val: unknown) => {
      params.push(val);
      where.push(clause(params.length));
    };
    if (status) add((i) => `status = $${i}`, status);
    if (country) add((i) => `$${i} = ANY(countries)`, country);
    if (genre) add((i) => `$${i} = ANY(genres)`, genre);
    if (language) add((i) => `$${i} = ANY(languages)`, language);
    if (image_status) add((i) => `image_status = $${i}`, image_status);
    if (is_verified === 'true' || is_verified === 'false') {
      where.push(`is_verified = ${is_verified === 'true'}`);
    }
    if (q) add((i) => `name ILIKE $${i}`, `%${q}%`);

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (
      await query(`SELECT count(*)::int AS total FROM radio_stations ${whereSql}`, params)
    ).rows[0].total as number;

    params.push(limit, offset);
    const rows = (
      await query(
        `SELECT ${COLS} FROM radio_stations ${whereSql}
         ORDER BY ${sort} ${dir} NULLS LAST, id DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      )
    ).rows;

    return { data: rows, pagination: { limit, offset, total } };
  });

  // READ ONE
  app.get<{ Params: { id: string } }>('/stations/:id', async (req, reply) => {
    const res = await query(`SELECT ${COLS} FROM radio_stations WHERE id = $1`, [req.params.id]);
    if (!res.rows.length) return reply.code(404).send({ error: 'Station not found' });
    return res.rows[0];
  });

  // CREATE
  app.post<{ Body: Record<string, unknown> }>('/stations', async (req, reply) => {
    const b = req.body ?? {};
    const name = String(b.name ?? '').trim();
    const streamUrl = String(b.stream_url ?? '').trim();
    if (!name || !streamUrl) {
      return reply.code(400).send({ error: 'name and stream_url are required' });
    }
    const normalizedUrl = normalizeUrl(streamUrl);
    const slug = makeSlug(name, normalizedUrl);
    try {
      const res = await query(
        `INSERT INTO radio_stations
           (name, slug, image_url, stream_url, normalized_url, countries, genres, languages,
            status, codec, bitrate, sample_rate, is_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING ${COLS}`,
        [
          name,
          slug,
          b.image_url ?? null,
          streamUrl,
          normalizedUrl,
          (b.countries as string[]) ?? [],
          (b.genres as string[]) ?? [],
          (b.languages as string[]) ?? [],
          (b.status as string) ?? 'untested',
          b.codec ?? null,
          Number(b.bitrate) || 0,
          Number(b.sample_rate) || 0,
          b.is_verified === true,
        ],
      );
      const row = res.rows[0];
      await writeAudit('station.create', row.id, { name, stream_url: streamUrl });
      return reply.code(201).send(row);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: 'A station with this stream URL already exists' });
      }
      throw err;
    }
  });

  // UPDATE (partial)
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/stations/:id',
    async (req, reply) => {
      const b = req.body ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];
      const set = (col: string, val: unknown) => {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      };
      for (const f of SCALAR_FIELDS) if (f in b) set(f, b[f]);
      for (const f of ARRAY_FIELDS) if (f in b) set(f, (b[f] as string[]) ?? []);
      if ('metadata' in b) set('metadata', JSON.stringify(b.metadata ?? {}));
      if (!sets.length) return reply.code(400).send({ error: 'No editable fields supplied' });
      sets.push('updated_at = now()');
      params.push(req.params.id);
      const res = await query(
        `UPDATE radio_stations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${COLS}`,
        params,
      );
      if (!res.rows.length) return reply.code(404).send({ error: 'Station not found' });
      await writeAudit('station.update', res.rows[0].id, { fields: Object.keys(b) });
      return res.rows[0];
    },
  );

  // DELETE (+ remove hosted image)
  app.delete<{ Params: { id: string } }>('/stations/:id', async (req, reply) => {
    const res = await query(
      'DELETE FROM radio_stations WHERE id = $1 RETURNING id, name, image_public_id',
      [req.params.id],
    );
    if (!res.rows.length) return reply.code(404).send({ error: 'Station not found' });
    const row = res.rows[0];
    if (row.image_public_id) await destroyImage(row.image_public_id);
    await writeAudit('station.delete', row.id, { name: row.name });
    return { ok: true, id: row.id };
  });
}
