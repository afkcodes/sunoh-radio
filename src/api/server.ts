import dotenv from 'dotenv';
import Fastify from 'fastify';
import { query } from '../db';

dotenv.config();

const fastify = Fastify({ logger: true });

// Basic health check
fastify.get('/health', async () => {
  return { status: 'ok', service: 'sunoh-radio-scraper-api' };
});

// Sample endpoint to get stations
fastify.get('/stations', async (request, reply) => {
  try {
    const { country, genre } = request.query as { country?: string; genre?: string };

    let sql = 'SELECT name, slug, image_url, stream_url, countries, genres FROM radio_stations WHERE status = $1';
    const params: any[] = ['working'];

    if (country) {
      params.push(country);
      sql += ` AND $${params.length} = ANY(countries)`;
    }

    if (genre) {
      params.push(genre);
      sql += ` AND $${params.length} = ANY(genres)`;
    }

    sql += ' ORDER BY name LIMIT 50';

    const res = await query(sql, params);
    return res.rows;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Database error' });
  }
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`API Server listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
