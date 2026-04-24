import { z } from 'zod';

export const verdictSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILE_ERROR',
  'INTERNAL_ERROR',
  'CANCELED',
]);

export type Verdict = z.infer<typeof verdictSchema>;

export const languageSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.enum(['c', 'cpp', 'java', 'python']),
  sourceFile: z.string(),
  compileCommand: z.array(z.string()).nullable(),
  runCommand: z.array(z.string()),
  defaultCpuMs: z.number().int().positive(),
  defaultMemoryKb: z.number().int().positive(),
});

export type Language = z.infer<typeof languageSchema>;

export const createSubmissionSchema = z.object({
  problemSlug: z.string().min(1),
  languageSlug: languageSchema.shape.slug,
  sourceCode: z.string().min(1).max(128_000),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const createProblemSchema = z.object({
  title: z.string().min(4),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  statement: z.string().min(10),
  constraints: z.string().default(''),
  tags: z.array(z.string().min(1)).default([]),
  testcases: z
    .array(
      z.object({
        name: z.string().min(1),
        input: z.string(),
        expectedOutput: z.string(),
        isSample: z.boolean().default(false),
        weight: z.number().int().positive().default(1),
      }),
    )
    .min(1),
});

export type CreateProblemInput = z.infer<typeof createProblemSchema>;
