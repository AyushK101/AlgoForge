import { prisma } from "@algoforge/db";
import {
  createSubmissionSchema,
  type CreateSubmissionInput,
} from "@algoforge/types";
import { submissionsCreated } from "../metrics";
import { ensureLanguageSeeded } from "../bootstrap";
import { enqueueSubmissionExecution } from "./local-executor";

const maxQueuedSubmissionsPerUser = Number(
  process.env.MAX_QUEUED_SUBMISSIONS_PER_USER ?? 5,
);

export async function createSubmission(rawInput: unknown, userId?: string) {
  const input: CreateSubmissionInput = createSubmissionSchema.parse(rawInput);

  if (userId) {
    const queued = await prisma.submission.count({
      where: { userId, status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (queued >= maxQueuedSubmissionsPerUser) {
      throw new Error("Too many queued submissions for this user");
    }
  }

  const problem = await prisma.problem.findUnique({
    where: { slug: input.problemSlug },
    include: { testcases: true },
  });
  if (!problem || !problem.isPublished) {
    throw new Error("Problem not found");
  }

  await ensureLanguageSeeded(input.languageSlug);

  const language = await prisma.language.findUnique({
    where: { slug: input.languageSlug },
  });
  if (!language || !language.isEnabled) {
    throw new Error("Language not available");
  }

  const submission = await prisma.submission.create({
    data: {
      userId,
      problemId: problem.id,
      languageId: language.id,
      sourceCode: input.sourceCode,
      totalTests: problem.testcases.length,
      jobs: {
        create: problem.testcases.map((testcase) => ({
          testcaseId: testcase.id,
        })),
      },
    },
    include: { jobs: true },
  });

  await prisma.submission.update({
    where: { id: submission.id },
    data: { status: "QUEUED" },
  });

  enqueueSubmissionExecution(submission.id);

  submissionsCreated.inc({ language: language.slug });
  return submission;
}

export async function aggregateSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { jobs: { include: { result: true } } },
  });
  if (!submission) return null;

  const jobs = submission.jobs;
  const finished = jobs.filter((job) => job.result);
  if (finished.length < jobs.length) {
    const anyRunning = jobs.some((job) => job.status === "RUNNING");
    return prisma.submission.update({
      where: { id: submissionId },
      data: { status: anyRunning ? "RUNNING" : "QUEUED" },
    });
  }

  const verdictPriority = [
    "INTERNAL_ERROR",
    "COMPILE_ERROR",
    "RUNTIME_ERROR",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "WRONG_ANSWER",
    "ACCEPTED",
  ] as const;

  const verdict =
    verdictPriority.find((candidate) =>
      finished.some((job) => job.result?.verdict === candidate),
    ) ?? "INTERNAL_ERROR";

  return prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: verdict,
      passedTests: finished.filter((job) => job.result?.verdict === "ACCEPTED")
        .length,
      maxMemoryKb: Math.max(
        0,
        ...finished.map((job) => job.result?.memoryKb ?? 0),
      ),
      totalWallTimeMs: finished.reduce(
        (sum, job) => sum + (job.result?.wallTimeMs ?? 0),
        0,
      ),
    },
  });
}
