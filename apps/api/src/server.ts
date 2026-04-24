import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config } from "./config";
import { healthRoutes } from "./routes/health";
import { metricsRoutes } from "./routes/metrics";
import { problemRoutes } from "./routes/problems";
import { submissionRoutes } from "./routes/submissions";
import { httpRequestDuration } from "./metrics";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

app.addHook("onRequest", async (request) => {
  request.startTime = process.hrtime.bigint();
});

app.addHook("onResponse", async (request, reply) => {
  const startTime = request.startTime;
  if (!startTime) return;
  const duration = Number(process.hrtime.bigint() - startTime) / 1_000_000_000;
  httpRequestDuration.observe(
    {
      method: request.method,
      route: request.routeOptions.url ?? request.url,
      status_code: String(reply.statusCode),
    },
    duration,
  );
});

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply
      .code(400)
      .send({ error: "Validation failed", issues: error.issues });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "Internal server error" });
});

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || config.webOrigins.includes(origin)) {
      callback(null, origin ?? false);
      return;
    }

    callback(null, false);
  },
  credentials: true,
});
await app.register(helmet);
await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
await app.register(healthRoutes);
await app.register(metricsRoutes);
await app.register(problemRoutes);
await app.register(submissionRoutes);

await app.listen({ port: config.port, host: config.host });

declare module "fastify" {
  interface FastifyRequest {
    startTime?: bigint;
  }
}
