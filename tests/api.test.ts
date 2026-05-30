import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

// DB-backed integration test. Runs only when RUN_DB_TESTS is set (CI provides a
// throwaway Postgres). It runs migrations against the target DB and seeds a few
// rows, so point DB_* at a DISPOSABLE database, never production.
const RUN = !!process.env.RUN_DB_TESTS;

describe.skipIf(!RUN)('API (integration)', () => {
  let app: FastifyInstance;
  let closePool: () => Promise<void>;

  beforeAll(async () => {
    const { migrate } = await import('../src/migrate');
    const db = await import('../src/db');
    closePool = db.closePool;
    await migrate();
    await db.query('TRUNCATE radio_stations RESTART IDENTITY');
    await db.query(
      `INSERT INTO radio_stations (slug, name, image_url, image_hosted, stream_url, normalized_url, providers, countries, genres, languages, status, codec, bitrate, sample_rate)
       VALUES
        ('jazz-fm-1953003626','Jazz FM','https://cdn.x/b.png','https://res.cloudinary.com/x/jazz.png','https://stream.example.com/jazz','https://stream.example.com/jazz','{"orb":"1"}',ARRAY['GB','US'],ARRAY['jazz'],ARRAY['English'],'working','aac',128000,44100),
        ('dead-x-78cf1c37ec','Dead Station','',NULL,'https://dead.example.com/x','https://dead.example.com/x','{"orb":"2"}',ARRAY['US'],ARRAY['talk'],ARRAY['English'],'broken',NULL,0,0)`,
    );

    const { buildApp } = await import('../src/api/app');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (closePool) await closePool();
  });

  it('GET /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('GET /stations defaults to working + pagination envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/stations' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.pagination.total).toBe(1); // only the working one
    expect(body.data[0].name).toBe('Jazz FM');
  });

  it('GET /stations filters by country', async () => {
    const res = await app.inject({ method: 'GET', url: '/stations?country=GB' });
    expect(res.json().pagination.total).toBe(1);
  });

  it('GET /stations rejects limit over the cap (400)', async () => {
    const res = await app.inject({ method: 'GET', url: '/stations?limit=999' });
    expect(res.statusCode).toBe(400);
  });

  it('GET /stations/:slug returns the station or 404', async () => {
    const ok = await app.inject({ method: 'GET', url: '/stations/jazz-fm-1953003626' });
    expect(ok.statusCode).toBe(200);
    const missing = await app.inject({ method: 'GET', url: '/stations/nope-0000000000' });
    expect(missing.statusCode).toBe(404);
  });

  it('resolves `image` to image_hosted when present', async () => {
    const res = await app.inject({ method: 'GET', url: '/stations?country=GB' });
    const jazz = res.json().data[0];
    expect(jazz.image).toBe('https://res.cloudinary.com/x/jazz.png'); // hosted wins over image_url
  });

  it('GET /countries returns working-station facet counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/countries' });
    const rows = res.json();
    expect(rows).toEqual(expect.arrayContaining([{ value: 'GB', count: 1 }]));
    expect(rows.find((r: { value: string }) => r.value === 'US')).toBeTruthy();
  });

  it('GET /stats summarizes counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/stats' });
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.working).toBe(1);
  });
});
