import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../config';

/** Constant-time string compare to avoid leaking the password via timing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const COOKIE = config.admin.cookieName;

export default async function authRoutes(app: FastifyInstance) {
  // POST /admin/api/login { password } -> sets httpOnly session cookie
  app.post<{ Body: { password?: string } }>('/login', async (req, reply) => {
    const password = req.body?.password ?? '';
    if (!config.admin.password) {
      return reply.code(500).send({ error: 'Admin password not configured' });
    }
    if (!password || !safeEqual(password, config.admin.password)) {
      return reply.code(401).send({ error: 'Invalid password' });
    }
    const token = app.jwt.sign({ role: 'admin' }, { expiresIn: config.admin.sessionTtl });
    reply.setCookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
    return { ok: true };
  });

  // POST /admin/api/logout -> clears the cookie
  app.post('/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  // GET /admin/api/me -> 200 if a valid session, else 401
  app.get('/me', { preHandler: app.authenticate }, async () => {
    return { authenticated: true, role: 'admin' };
  });
}
