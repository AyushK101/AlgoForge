import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { judgeQueueName } from '@algoforge/judge-protocol';
import { config } from './config';

export const redis = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export const judgeQueue = new Queue(judgeQueueName, {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});
