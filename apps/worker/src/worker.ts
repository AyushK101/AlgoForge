import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@algoforge/db';
import { executionJobPayloadSchema, judgeQueueName } from '@algoforge/judge-protocol';
import { executeJob } from './runner';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const workerId = process.env.HOSTNAME ?? `worker-${process.pid}`;
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  judgeQueueName,
  async (job) => {
    const payload = executionJobPayloadSchema.parse(job.data);

    await prisma.executionJob.update({
      where: { id: payload.executionJobId },
      data: {
        status: 'RUNNING',
        lockedBy: workerId,
        lockedAt: new Date(),
        attempts: { increment: 1 },
        submission: { update: { status: 'RUNNING' } },
      },
    });

    const result = await executeJob(payload);

    await prisma.executionResult.upsert({
      where: { executionJobId: payload.executionJobId },
      create: result,
      update: result,
    });

    await prisma.executionJob.update({
      where: { id: payload.executionJobId },
      data: { status: result.verdict },
    });

    return result;
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 1),
  },
);

worker.on('completed', (job) => {
  console.log(JSON.stringify({ event: 'job.completed', jobId: job.id }));
});

worker.on('failed', async (job, error) => {
  console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id, error: error.message }));
  const payload = job ? executionJobPayloadSchema.safeParse(job.data) : null;
  if (payload?.success) {
    await prisma.executionResult.upsert({
      where: { executionJobId: payload.data.executionJobId },
      create: {
        executionJobId: payload.data.executionJobId,
        verdict: 'INTERNAL_ERROR',
        stdout: '',
        stderr: '',
        compileOutput: '',
        exitCode: null,
        wallTimeMs: 0,
        memoryKb: 0,
        message: error.message,
      },
      update: {
        verdict: 'INTERNAL_ERROR',
        message: error.message,
      },
    });
    await prisma.executionJob.update({
      where: { id: payload.data.executionJobId },
      data: { status: 'INTERNAL_ERROR' },
    });
  }
});

console.log(JSON.stringify({ event: 'worker.started', workerId, queue: judgeQueueName }));
