import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "@algoforge/db";

type Runtime = {
  sourceFile: string;
  compile?: string[];
  run: string[];
};

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  wallTimeMs: number;
  failedToStart: boolean;
};

type ExecutionVerdict =
  | "QUEUED"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "RUNTIME_ERROR"
  | "COMPILE_ERROR"
  | "INTERNAL_ERROR"
  | "CANCELED";

const defaultLimits = {
  wallMs: Number(process.env.APIV2_WALL_MS ?? 5000),
  stdoutLimitBytes: Number(process.env.APIV2_STDOUT_LIMIT_BYTES ?? 65_536),
  stderrLimitBytes: Number(process.env.APIV2_STDERR_LIMIT_BYTES ?? 65_536),
};

const executorConcurrency = Math.max(
  1,
  Number(process.env.APIV2_EXECUTOR_CONCURRENCY ?? 1),
);

const queue: string[] = [];
const queued = new Set<string>();
let activeWorkers = 0;

function runtimeFor(language: "c" | "cpp" | "java" | "python"): Runtime {
  switch (language) {
    case "c":
      return {
        sourceFile: "main.c",
        compile: ["gcc", "main.c", "-O2", "-std=c17", "-pipe", "-o", "main"],
        run: ["./main"],
      };
    case "cpp":
      return {
        sourceFile: "main.cpp",
        compile: [
          "g++",
          "main.cpp",
          "-O2",
          "-std=c++20",
          "-pipe",
          "-o",
          "main",
        ],
        run: ["./main"],
      };
    case "java":
      return {
        sourceFile: "Main.java",
        compile: ["javac", "Main.java"],
        run: ["java", "-Xmx256m", "Main"],
      };
    case "python":
      return {
        sourceFile: "main.py",
        run: ["python3", "main.py"],
      };
  }
}

function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, "\n").trimEnd();
}

function compareOutput(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

async function runCommand(
  command: string[],
  cwd: string,
  stdin: string,
  timeoutMs: number,
  outputLimit: number,
): Promise<CommandResult> {
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: cwd },
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let failedToStart = false;

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: stdout.slice(0, outputLimit),
        stderr: stderr.slice(0, outputLimit),
        timedOut,
        wallTimeMs: Date.now() - started,
        failedToStart,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
      if (stdout.length > outputLimit) child.kill("SIGKILL");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > outputLimit) child.kill("SIGKILL");
    });

    child.on("error", (error) => {
      failedToStart = true;
      stderr += `\n${error.message}`;
      finish(null);
    });

    child.on("close", (code) => finish(code));
    child.stdin.end(stdin);
  });
}

async function processExecutionJob(jobId: string) {
  const job = await prisma.executionJob.findUnique({
    where: { id: jobId },
    include: {
      testcase: true,
      submission: {
        include: {
          language: true,
        },
      },
    },
  });

  if (!job) return;

  const runtime = runtimeFor(job.submission.language.slug);
  const workdir = await mkdtemp(join(tmpdir(), `algoforge-${job.id}-`));
  const sourcePath = join(workdir, runtime.sourceFile);
  await writeFile(sourcePath, job.submission.sourceCode, "utf8");

  await prisma.executionJob.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      lockedBy: `apiv2-${process.pid}`,
      lockedAt: new Date(),
    },
  });

  try {
    if (runtime.compile) {
      const compile = await runCommand(
        runtime.compile,
        workdir,
        "",
        defaultLimits.wallMs,
        defaultLimits.stderrLimitBytes,
      );

      if (compile.timedOut || compile.exitCode !== 0 || compile.failedToStart) {
        const verdict: ExecutionVerdict = compile.timedOut
          ? "TIME_LIMIT_EXCEEDED"
          : "COMPILE_ERROR";

        await prisma.executionResult.upsert({
          where: { executionJobId: job.id },
          create: {
            executionJobId: job.id,
            verdict,
            stdout: compile.stdout,
            stderr: compile.stderr,
            compileOutput: compile.stderr,
            exitCode: compile.exitCode,
            wallTimeMs: compile.wallTimeMs,
            memoryKb: 0,
            message: compile.timedOut
              ? "Compilation timed out"
              : "Compilation failed",
          },
          update: {
            verdict,
            stdout: compile.stdout,
            stderr: compile.stderr,
            compileOutput: compile.stderr,
            exitCode: compile.exitCode,
            wallTimeMs: compile.wallTimeMs,
            memoryKb: 0,
            message: compile.timedOut
              ? "Compilation timed out"
              : "Compilation failed",
          },
        });

        await prisma.executionJob.update({
          where: { id: job.id },
          data: { status: verdict },
        });
        return;
      }
    }

    const run = await runCommand(
      runtime.run,
      workdir,
      job.testcase.input,
      Math.min(defaultLimits.wallMs, job.submission.language.defaultCpuMs * 3),
      Math.max(defaultLimits.stdoutLimitBytes, defaultLimits.stderrLimitBytes),
    );

    const verdict: ExecutionVerdict = run.failedToStart
      ? "INTERNAL_ERROR"
      : run.timedOut
        ? "TIME_LIMIT_EXCEEDED"
        : run.exitCode !== 0
          ? "RUNTIME_ERROR"
          : compareOutput(run.stdout, job.testcase.expectedOutput)
            ? "ACCEPTED"
            : "WRONG_ANSWER";

    await prisma.executionResult.upsert({
      where: { executionJobId: job.id },
      create: {
        executionJobId: job.id,
        verdict,
        stdout: run.stdout,
        stderr: run.stderr,
        compileOutput: "",
        exitCode: run.exitCode,
        wallTimeMs: run.wallTimeMs,
        memoryKb: 0,
        message: run.failedToStart ? "Runtime failed to start" : null,
      },
      update: {
        verdict,
        stdout: run.stdout,
        stderr: run.stderr,
        compileOutput: "",
        exitCode: run.exitCode,
        wallTimeMs: run.wallTimeMs,
        memoryKb: 0,
        message: run.failedToStart ? "Runtime failed to start" : null,
      },
    });

    await prisma.executionJob.update({
      where: { id: job.id },
      data: { status: verdict },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown execution error";

    await prisma.executionResult.upsert({
      where: { executionJobId: job.id },
      create: {
        executionJobId: job.id,
        verdict: "INTERNAL_ERROR",
        stdout: "",
        stderr: "",
        compileOutput: "",
        exitCode: null,
        wallTimeMs: 0,
        memoryKb: 0,
        message,
      },
      update: {
        verdict: "INTERNAL_ERROR",
        message,
      },
    });

    await prisma.executionJob.update({
      where: { id: job.id },
      data: { status: "INTERNAL_ERROR" },
    });
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function aggregateSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { jobs: { include: { result: true } } },
  });

  if (!submission) return;

  const finished = submission.jobs.filter((job) => job.result);
  if (finished.length < submission.jobs.length) {
    const anyRunning = submission.jobs.some((job) => job.status === "RUNNING");
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: anyRunning ? "RUNNING" : "QUEUED" },
    });
    return;
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

  const status: ExecutionVerdict =
    verdictPriority.find((candidate) =>
      finished.some((job) => job.result?.verdict === candidate),
    ) ?? "INTERNAL_ERROR";

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status,
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

async function executeSubmission(submissionId: string) {
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "RUNNING" },
  });

  const jobs = await prisma.executionJob.findMany({
    where: { submissionId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const job of jobs) {
    await processExecutionJob(job.id);
  }

  await aggregateSubmission(submissionId);
}

async function drainQueue() {
  while (activeWorkers < executorConcurrency && queue.length > 0) {
    const nextSubmissionId = queue.shift();
    if (!nextSubmissionId) continue;

    activeWorkers += 1;
    void executeSubmission(nextSubmissionId)
      .catch(() => {
        void prisma.submission.update({
          where: { id: nextSubmissionId },
          data: { status: "INTERNAL_ERROR" },
        });
      })
      .finally(() => {
        queued.delete(nextSubmissionId);
        activeWorkers -= 1;
        void drainQueue();
      });
  }
}

export function enqueueSubmissionExecution(submissionId: string) {
  if (queued.has(submissionId)) return;
  queued.add(submissionId);
  queue.push(submissionId);
  void drainQueue();
}
