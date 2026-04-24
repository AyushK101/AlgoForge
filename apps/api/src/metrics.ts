import client from 'prom-client';

client.collectDefaultMetrics();

export const httpRequestDuration = new client.Histogram({
  name: 'algoforge_api_http_request_duration_seconds',
  help: 'API HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

export const submissionsCreated = new client.Counter({
  name: 'algoforge_submissions_created_total',
  help: 'Total submissions created',
  labelNames: ['language'],
});

export const registry = client.register;
