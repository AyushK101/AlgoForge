import { prisma } from '@algoforge/db';

const intervalMs = Number(process.env.ORCHESTRATOR_INTERVAL_MS ?? 1000);

const verdictPriority = [
  'INTERNAL_ERROR',
  'COMPILE_ERROR',
  'RUNTIME_ERROR',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'WRONG_ANSWER',
  'ACCEPTED',
] as const;

async function aggregateOpenSubmissions() {
  const submissions = await prisma.submission.findMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    include: { jobs: { include: { result: true } } },
    take: 100,
  });

  for (const submission of submissions) {
    const finished = submission.jobs.filter((job) => job.result);
    if (finished.length < submission.jobs.length) {
      const status = submission.jobs.some((job) => job.status === 'RUNNING') ? 'RUNNING' : 'QUEUED';
      if (submission.status !== status) {
        await prisma.submission.update({ where: { id: submission.id }, data: { status } });
      }
      continue;
    }

    const status =
      verdictPriority.find((candidate) => finished.some((job) => job.result?.verdict === candidate)) ??
      'INTERNAL_ERROR';

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status,
        passedTests: finished.filter((job) => job.result?.verdict === 'ACCEPTED').length,
        maxMemoryKb: Math.max(0, ...finished.map((job) => job.result?.memoryKb ?? 0)),
        totalWallTimeMs: finished.reduce((sum, job) => sum + (job.result?.wallTimeMs ?? 0), 0),
      },
    });
  }

  return submissions.length;
}

async function tick() {
  try {
    const count = await aggregateOpenSubmissions();
    if (count > 0) console.log(JSON.stringify({ event: 'orchestrator.aggregated', count }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'orchestrator.error', error: error instanceof Error ? error.message : error }));
  } finally {
    setTimeout(tick, intervalMs);
  }
}

console.log(JSON.stringify({ event: 'orchestrator.started', intervalMs }));
void tick();
