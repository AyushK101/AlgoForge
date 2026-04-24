import type { FastifyInstance } from 'fastify';
import { prisma } from '@algoforge/db';
import { redis } from '../queue';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/readyz', async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return reply.send({ ok: true });
  });
}
