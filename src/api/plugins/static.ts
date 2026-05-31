import fs from 'fs';
import path from 'path';
import fastifyStatic from '@fastify/static';
import fp from 'fastify-plugin';

/**
 * Serve the built admin SPA at /admin (production). In dev the SPA runs under
 * the Vite dev server and proxies /admin/api to this API, so admin/dist won't
 * exist — we simply skip registration then.
 */
export default fp(async (app) => {
  const adminDist = path.join(__dirname, '..', '..', '..', 'admin', 'dist');
  if (!fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.log.warn(`[static] admin/dist not built — /admin disabled (looked in ${adminDist})`);
    return;
  }

  await app.register(fastifyStatic, { root: adminDist, prefix: '/admin/' });

  // SPA history fallback: serve index.html for unknown GET /admin/* paths
  // (but never for the API). Other unmatched routes get a JSON 404.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && req.url.startsWith('/admin') && !req.url.startsWith('/admin/api')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });
});
