export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  host: process.env.API_HOST ?? "0.0.0.0",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  webOrigins: (
    process.env.WEB_ORIGINS ??
    process.env.WEB_ORIGIN ??
    "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxQueuedSubmissionsPerUser: Number(
    process.env.MAX_QUEUED_SUBMISSIONS_PER_USER ?? 5,
  ),
};
