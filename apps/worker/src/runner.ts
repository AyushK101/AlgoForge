import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compareOutput, type ExecutionJobPayload, type ExecutionResult } from '@algoforge/judge-protocol';
import { runtimeFor } from './languages';

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  wallTimeMs: number;
};

async function runCommand(command: string[], cwd: string, stdin: string, timeoutMs: number, outputLimit: number) {
  const started = Date.now();
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(command[0]!, command.slice(1), {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: cwd },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

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
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > outputLimit) child.kill('SIGKILL');
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > outputLimit) child.kill('SIGKILL');
    });

    child.on('error', () => finish(null));
    child.on('close', (code) => finish(code));
    child.stdin.end(stdin);
  });
}

export async function executeJob(payload: ExecutionJobPayload): Promise<ExecutionResult> {
  const runtime = runtimeFor(payload.languageSlug);
  const workdir = await mkdtemp(join(tmpdir(), `algoforge-${payload.executionJobId}-`));

  const sourcePath = join(workdir, runtime.sourceFile);
  await writeFile(sourcePath, payload.sourceCode, 'utf8');

  try {
    if (runtime.compile) {
      const compile = await runCommand(
        runtime.compile,
        workdir,
        '',
        payload.limits.wallMs,
        payload.limits.stderrLimitBytes,
      );

      if (compile.timedOut) {
        return {
          executionJobId: payload.executionJobId,
          verdict: 'TIME_LIMIT_EXCEEDED',
          stdout: compile.stdout,
          stderr: compile.stderr,
          compileOutput: compile.stderr,
          exitCode: compile.exitCode,
          wallTimeMs: compile.wallTimeMs,
          memoryKb: 0,
          message: 'Compilation timed out',
        };
      }

      if (compile.exitCode !== 0) {
        return {
          executionJobId: payload.executionJobId,
          verdict: 'COMPILE_ERROR',
          stdout: compile.stdout,
          stderr: compile.stderr,
          compileOutput: compile.stderr,
          exitCode: compile.exitCode,
          wallTimeMs: compile.wallTimeMs,
          memoryKb: 0,
          message: 'Compilation failed',
        };
      }
    }

    const run = await runCommand(
      runtime.run,
      workdir,
      payload.stdin,
      payload.limits.wallMs,
      Math.max(payload.limits.stdoutLimitBytes, payload.limits.stderrLimitBytes),
    );

    const verdict = run.timedOut
      ? 'TIME_LIMIT_EXCEEDED'
      : run.exitCode !== 0
        ? 'RUNTIME_ERROR'
        : compareOutput(run.stdout, payload.expectedOutput)
          ? 'ACCEPTED'
          : 'WRONG_ANSWER';

    return {
      executionJobId: payload.executionJobId,
      verdict,
      stdout: run.stdout,
      stderr: run.stderr,
      compileOutput: '',
      exitCode: run.exitCode,
      wallTimeMs: run.wallTimeMs,
      memoryKb: 0,
      message: null,
    };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
