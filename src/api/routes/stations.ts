import type { FastifyInstance } from 'fastify';
import { query } from '../../db';
import { getStationSchema, listStationsSchema } from '../schemas/stations';

const STATION_COLUMNS = `
  id, slug, name,
  image_url, image_hosted,
  COALESCE(image_hosted, image_url) AS image,  -- ready-to-use: prefer hosted, fall back to source
  stream_url,
  countries, genres, languages, status, codec, bitrate, sample_rate
`;

interface ListQuery {
  country?: string;
  genre?: string;
  language?: string;
  status: string;
  q?: string;
  limit: number;
  offset: number;
}

export default async function stationRoutes(app: FastifyInstance) {
  // GET /stations — paginated, filterable list.
  app.get<{ Querystring: ListQuery }>('/stations', { schema: listStationsSchema }, async (req) => {
    const { country, genre, language, status, q, limit, offset } = req.query;

    const where: string[] = [];
    const params: unknown[] = [];

    params.push(status);
    where.push(`status = $${params.length}`);

    if (country) {
      params.push(country);
      where.push(`$${params.length} = ANY(countries)`);
    }
    if (genre) {
      params.push(genre);
      where.push(`$${params.length} = ANY(genres)`);
    }
    if (language) {
      params.push(language);
      where.push(`$${params.length} = ANY(languages)`);
    }
    // Free-text search: match the name OR any genre tag (case-insensitive,
    // trigram-accelerated for name). `likeIdx` is reused in ORDER BY below.
    let likeIdx = 0;
    if (q) {
      params.push(`%${q}%`);
      likeIdx = params.length;
      where.push(
        `(name ILIKE $${likeIdx} OR EXISTS (SELECT 1 FROM unnest(genres) g WHERE g ILIKE $${likeIdx}))`,
      );
    }

    const whereSql = where.join(' AND ');

    const totalRes = await query(
      `SELECT count(*)::int AS total FROM radio_stations WHERE ${whereSql}`,
      params,
    );
    const total = totalRes.rows[0].total as number;

    // Relevance ranking when searching: exact name hits first, then by trigram
    // similarity to the name, then alphabetically. Plain alphabetical otherwise.
    let orderBy = 'ORDER BY name ASC, id ASC';
    if (q) {
      params.push(q);
      const rawIdx = params.length; // raw term for similarity()
      orderBy = `ORDER BY (name ILIKE $${likeIdx}) DESC, similarity(name, $${rawIdx}) DESC, name ASC, id ASC`;
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const rowsRes = await query(
      `SELECT ${STATION_COLUMNS}
         FROM radio_stations
        WHERE ${whereSql}
        ${orderBy}
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    return { data: rowsRes.rows, pagination: { limit, offset, total } };
  });

  // GET /stations/:slug — single station.
  app.get<{ Params: { slug: string } }>(
    '/stations/:slug',
    { schema: getStationSchema },
    async (req, reply) => {
      const res = await query(
        `SELECT ${STATION_COLUMNS} FROM radio_stations WHERE slug = $1`,
        [req.params.slug],
      );
      if (res.rows.length === 0) {
        return reply.status(404).send({ error: 'Station not found' });
      }
      return res.rows[0];
    },
  );
}
