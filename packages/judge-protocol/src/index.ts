import { z } from 'zod';
import { verdictSchema } from '@algoforge/types';

export const judgeQueueName = 'judge.execution-jobs';

export const executionLimitsSchema = z.object({
  cpuMs: z.number().int().positive(),
  wallMs: z.number().int().positive(),
  memoryKb: z.number().int().positive(),
  stdoutLimitBytes: z.number().int().positive(),
  stderrLimitBytes: z.number().int().positive(),
});

export const executionJobPayloadSchema = z.object({
  executionJobId: z.string(),
  submissionId: z.string(),
  problemId: z.string(),
  testcaseId: z.string(),
  languageSlug: z.enum(['c', 'cpp', 'java', 'python']),
  sourceCode: z.string(),
  stdin: z.string(),
  expectedOutput: z.string(),
  limits: executionLimitsSchema,
});

export const executionResultSchema = z.object({
  executionJobId: z.string(),
  verdict: verdictSchema,
  stdout: z.string(),
  stderr: z.string(),
  compileOutput: z.string(),
  exitCode: z.number().int().nullable(),
  wallTimeMs: z.number().int().nonnegative(),
  memoryKb: z.number().int().nonnegative(),
  message: z.string().nullable(),
});

export type ExecutionLimits = z.infer<typeof executionLimitsSchema>;
export type ExecutionJobPayload = z.infer<typeof executionJobPayloadSchema>;
export type ExecutionResult = z.infer<typeof executionResultSchema>;

export function normalizeOutput(value: string): string {
  return value.replace(/\r\n/g, '\n').trimEnd();
}

export function compareOutput(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}
