import type { FastifyInstance } from 'fastify';
import { query } from '../../db';
import { getStationSchema, listStationsSchema, recentStationsSchema } from '../schemas/stations';

const STATION_COLUMNS = `
  id, slug, name,
  image_url, image_hosted,
  COALESCE(image_hosted, image_url) AS image,  -- ready-to-use: prefer hosted, fall back to source
  stream_url,
  countries, genres, languages, status, codec, bitrate, sample_rate, play_count
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

  // GET /stations/recent — newest stations first, optionally scoped to a country
  // (and an optional `days` recency window). Registered before /stations/:slug.
  app.get<{ Querystring: { country?: string; status: string; days?: number; limit: number; offset: number } }>(
    '/stations/recent',
    { schema: recentStationsSchema },
    async (req) => {
      const { country, status, days, limit, offset } = req.query;
      const where: string[] = [];
      const params: unknown[] = [];

      params.push(status);
      where.push(`status = $${params.length}`);
      if (country) {
        params.push(country);
        where.push(`$${params.length} = ANY(countries)`);
      }
      if (days) {
        params.push(`${days} days`);
        where.push(`created_at >= now() - $${params.length}::interval`);
      }
      const whereSql = where.join(' AND ');

      const total = (
        await query(`SELECT count(*)::int AS total FROM radio_stations WHERE ${whereSql}`, params)
      ).rows[0].total as number;

      params.push(limit, offset);
      const rows = (
        await query(
          `SELECT ${STATION_COLUMNS}
             FROM radio_stations
            WHERE ${whereSql}
            ORDER BY created_at DESC, id DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        )
      ).rows;

      return { data: rows, pagination: { limit, offset, total } };
    },
  );

  // POST /stations/:slug/play — record a play (increment the counter). Public,
  // lightweight; clients call this when a user starts a station. Returns the
  // new count. Debounce on the client to avoid double-counting reconnects.
  app.post<{ Params: { slug: string } }>('/stations/:slug/play', async (req, reply) => {
    const res = await query(
      'UPDATE radio_stations SET play_count = play_count + 1 WHERE slug = $1 RETURNING play_count',
      [req.params.slug],
    );
    if (res.rows.length === 0) return reply.status(404).send({ error: 'Station not found' });
    return { ok: true, play_count: res.rows[0].play_count as number };
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
