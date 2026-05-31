import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config';

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that 401s unless a valid admin session cookie is present. */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Single-admin auth: a signed JWT stored in an httpOnly cookie. `app.authenticate`
 * is used as a preHandler on protected `/admin/api/*` routes.
 */
export default fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.admin.sessionSecret,
    cookie: { cookieName: config.admin.cookieName, signed: false },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });
});
