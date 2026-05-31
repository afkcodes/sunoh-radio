import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Set admin auth env BEFORE any module (config) loads.
process.env.ADMIN_PASSWORD = 'test-admin-pw';
process.env.SESSION_SECRET = 'test-session-secret';

const RUN = !!process.env.RUN_DB_TESTS;

describe.skipIf(!RUN)('Admin API', () => {
  let app: FastifyInstance;
  let closePool: () => Promise<void>;
  let cookie = '';

  beforeAll(async () => {
    const { migrate } = await import('../src/migrate');
    const db = await import('../src/db');
    closePool = db.closePool;
    await migrate();
    await db.query('TRUNCATE radio_stations RESTART IDENTITY');
    const { buildApp } = await import('../src/api/app');
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (closePool) await closePool();
  });

  it('rejects a wrong password', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/api/login', payload: { password: 'nope' } });
    expect(res.statusCode).toBe(401);
  });

  it('gates protected routes when unauthenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/stations' });
    expect(res.statusCode).toBe(401);
  });

  it('logs in and sets a session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/api/login',
      payload: { password: 'test-admin-pw' },
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    cookie = String(raw).split(';')[0];
    expect(cookie).toContain('sunoh_admin=');
  });

  it('creates, lists, and deletes a station (authed)', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/admin/api/stations',
      headers: { cookie },
      payload: { name: 'Admin Test FM', stream_url: 'https://s.example.com/a?token=x', genres: ['jazz'] },
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;
    expect(create.json().normalized_url).toBe('https://s.example.com/a'); // token stripped

    const list = await app.inject({ method: 'GET', url: '/admin/api/stations', headers: { cookie } });
    expect(list.json().pagination.total).toBe(1);

    const del = await app.inject({ method: 'DELETE', url: `/admin/api/stations/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);
  });

  it('records an audit trail for mutations', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/audit', headers: { cookie } });
    const actions = res.json().data.map((r: { action: string }) => r.action);
    expect(actions).toContain('station.create');
    expect(actions).toContain('station.delete');
  });
});
