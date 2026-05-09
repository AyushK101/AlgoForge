import type { FastifyInstance } from "fastify";
import { registry } from "../metrics";

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", registry.contentType);
    return registry.metrics();
  });
}
