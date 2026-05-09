import type {
  CreateProblemInput,
  CreateSubmissionInput,
} from "@algoforge/types";

function resolveApiUrl() {
  const fallbackApiUrl = "http://localhost:4001";

  if (typeof window === "undefined") {
    const internalApiUrl =
      process.env["INTERNAL_APIV2_URL"] ?? process.env["INTERNAL_API_URL"];
    const publicApiUrl =
      process.env["NEXT_PUBLIC_APIV2_URL"] ??
      process.env["NEXT_PUBLIC_API_URL"];
    return (internalApiUrl ?? publicApiUrl ?? fallbackApiUrl).replace(
      /\/$/,
      "",
    );
  }

  return "/api";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type ProblemListItem = {
  id: string;
  slug: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  createdAt: string;
};

export type ProblemDetail = {
  id: string;
  slug: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  statement: string;
  constraints: string;
  tags: string[];
  testcases: Array<{
    id: string;
    name: string;
    input: string;
    expectedOutput: string;
    isSample: boolean;
  }>;
};

export type SubmissionDetail = {
  id: string;
  sourceCode: string;
  status: string;
  totalTests: number;
  passedTests: number;
  maxMemoryKb: number;
  totalWallTimeMs: number;
  createdAt: string;
  problem: { slug: string; title: string };
  language: { slug: string; name: string };
  jobs: Array<{
    id: string;
    status: string;
    testcase: { name: string; isSample: boolean };
    result: null | {
      verdict: string;
      stdout: string;
      stderr: string;
      compileOutput: string;
      wallTimeMs: number;
      memoryKb: number;
      message: string | null;
    };
  }>;
};

export const api = {
  listProblems: (params = "") =>
    request<{ problems: ProblemListItem[]; page: number; limit: number }>(
      `/problems${params}`,
    ),
  getProblem: (slug: string) =>
    request<{ problem: ProblemDetail }>(`/problems/${slug}`),
  createSubmission: (input: CreateSubmissionInput) =>
    request<{ submissionId: string; status: string }>("/submissions", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  getSubmission: (id: string) =>
    request<{ submission: SubmissionDetail }>(`/submissions/${id}`),
  createProblem: (input: CreateProblemInput) =>
    request<{ problem: ProblemDetail }>("/admin/problems", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
