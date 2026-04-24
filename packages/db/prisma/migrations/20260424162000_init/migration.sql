CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');
CREATE TYPE "LanguageSlug" AS ENUM ('c', 'cpp', 'java', 'python');
CREATE TYPE "Verdict" AS ENUM (
  'QUEUED',
  'RUNNING',
  'ACCEPTED',
  'WRONG_ANSWER',
  'TIME_LIMIT_EXCEEDED',
  'MEMORY_LIMIT_EXCEEDED',
  'RUNTIME_ERROR',
  'COMPILE_ERROR',
  'INTERNAL_ERROR',
  'CANCELED'
);

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "username" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Problem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "difficulty" "Difficulty" NOT NULL,
  "statement" TEXT NOT NULL,
  "constraints" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isPublished" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProblemVersion" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "problemId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProblemVersion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Testcase" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "problemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "input" TEXT NOT NULL,
  "expectedOutput" TEXT NOT NULL,
  "isSample" BOOLEAN NOT NULL DEFAULT FALSE,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Testcase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Language" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "slug" "LanguageSlug" NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "sourceFile" TEXT NOT NULL,
  "compileCommand" TEXT[] NOT NULL,
  "runCommand" TEXT[] NOT NULL,
  "defaultCpuMs" INTEGER NOT NULL DEFAULT 2000,
  "defaultMemoryKb" INTEGER NOT NULL DEFAULT 262144,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE "Submission" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "userId" TEXT,
  "problemId" TEXT NOT NULL,
  "languageId" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "status" "Verdict" NOT NULL DEFAULT 'QUEUED',
  "totalTests" INTEGER NOT NULL DEFAULT 0,
  "passedTests" INTEGER NOT NULL DEFAULT 0,
  "maxMemoryKb" INTEGER NOT NULL DEFAULT 0,
  "totalWallTimeMs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Submission_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExecutionJob" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "submissionId" TEXT NOT NULL,
  "testcaseId" TEXT NOT NULL,
  "status" "Verdict" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lockedBy" TEXT,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExecutionJob_testcaseId_fkey" FOREIGN KEY ("testcaseId") REFERENCES "Testcase"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExecutionResult" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "executionJobId" TEXT NOT NULL UNIQUE,
  "verdict" "Verdict" NOT NULL,
  "stdout" TEXT NOT NULL DEFAULT '',
  "stderr" TEXT NOT NULL DEFAULT '',
  "compileOutput" TEXT NOT NULL DEFAULT '',
  "exitCode" INTEGER,
  "wallTimeMs" INTEGER NOT NULL DEFAULT 0,
  "memoryKb" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExecutionResult_executionJobId_fkey" FOREIGN KEY ("executionJobId") REFERENCES "ExecutionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProblemVersion_problemId_version_key" ON "ProblemVersion"("problemId", "version");
CREATE UNIQUE INDEX "Testcase_problemId_name_key" ON "Testcase"("problemId", "name");
CREATE INDEX "Problem_slug_idx" ON "Problem"("slug");
CREATE INDEX "Submission_userId_problemId_createdAt_idx" ON "Submission"("userId", "problemId", "createdAt");
CREATE INDEX "Submission_problemId_status_idx" ON "Submission"("problemId", "status");
CREATE INDEX "ExecutionJob_status_createdAt_idx" ON "ExecutionJob"("status", "createdAt");
