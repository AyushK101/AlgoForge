# AlgoForge - Low Level Design (LLD)

## Detailed System Components

---

## 1. Web Frontend (`apps/web`)

### Architecture

```
Next.js 15 App
├── Server Components
│   ├── Layout
│   ├── Page (SSG/ISR)
│   └── Dynamic Routes
├── Client Components
│   ├── Problem Builder
│   ├── Problem Workspace
│   └── Status Polling
├── API Layer (src/lib/api.ts)
│   ├── Axios instance
│   ├── Request interceptors
│   └── Error handling
└── Shared Types
    └── @algoforge/types
```

### Key Components

#### 1.1 Problem Listing Page

**Path**: `src/app/problems/page.tsx`
**Functionality**:

- Fetch problem list from `/problems` endpoint
- Display problem cards with:
  - Title, difficulty badge, acceptance rate
  - Tag pills
  - Submission count
- Search and filter by difficulty/tags
- Pagination (optional)

#### 1.2 Problem Detail & Editor

**Path**: `src/app/problems/[slug]/page.tsx`
**Components**:

- Problem statement renderer
- Code editor with syntax highlighting
- Language selector dropdown
- Testcase viewer (sample tests only)
- Submit button with loading state

**Editor State Management**:

```typescript
interface EditorState {
  problemSlug: string;
  selectedLanguage: LanguageSlug;
  sourceCode: string;
  isSubmitting: boolean;
  currentSubmissionId: string | null;
}
```

#### 1.3 Submission Status Component

**Path**: `src/components/problem-workspace.tsx`
**Polling Logic**:

```
Submit Code
  ↓
POST /submissions → { id, status: 'QUEUED' }
  ↓
Poll GET /submissions/:id every 500ms
  ↓
Display Status: QUEUED → RUNNING → FINAL_VERDICT
  ↓
Show Results: verdict, passed/total, memory, time
```

**Status Display States**:

- `QUEUED`: "Waiting in queue..."
- `RUNNING`: "Running tests... (3/5 passed)"
- `ACCEPTED`: "✓ All tests passed!"
- `WRONG_ANSWER`: "✗ Wrong answer on test 2"
- `COMPILE_ERROR`: "✗ Compilation failed"
- `RUNTIME_ERROR`: "✗ Runtime error"
- `TIME_LIMIT_EXCEEDED`: "✗ Time limit exceeded"
- `MEMORY_LIMIT_EXCEEDED`: "✗ Memory limit exceeded"
- `INTERNAL_ERROR`: "✗ Internal server error"

#### 1.4 Problem Builder (Admin)

**Path**: `src/app/admin/problems/`
**Functionality**:

- CRUD for problems
- Testcase management
- Problem versioning
- Draft/publish workflow

---

## 2. API Service (`apps/api`)

### Architecture

```
Fastify Server
├── Middleware
│   ├── CORS
│   ├── Helmet (security headers)
│   ├── Rate Limit (120/min)
│   └── Error Handler
├── Routes
│   ├── /health
│   ├── /metrics
│   ├── /problems
│   ├── /submissions
│   └── Custom hooks
└── Plugins
    ├── Database (Prisma)
    └── Queue (BullMQ)
```

### Core Route Implementations

#### 2.1 POST /submissions

**Purpose**: Create a new submission and enqueue jobs

**Request Schema**:

```typescript
{
  problemSlug: string; // Problem identifier
  languageSlug: LanguageSlug; // c | cpp | java | python
  sourceCode: string; // User's code
}
```

**Processing Steps**:

```
1. Validate input with Zod schema
2. Find problem by slug:
   await prisma.problem.findUnique({ where: { slug: problemSlug } })
3. Check problem is published
4. Find language by slug
5. Fetch all testcases for problem:
   await prisma.testcase.findMany({ where: { problemId } })
6. Create submission record:
   await prisma.submission.create({
     data: {
       problemId,
       languageId,
       sourceCode,
       userId: (optional),
       status: 'QUEUED',
       totalTests: testcases.length
     }
   })
7. Create execution job per testcase:
   For each testcase:
     await prisma.executionJob.create({
       data: {
         submissionId,
         testcaseId,
         status: 'QUEUED'
       }
     })
8. Enqueue jobs to Redis:
   For each job:
     await queue.add('execute', {
       executionJobId: job.id,
       submissionId: submission.id,
       testcaseId: job.testcaseId,
       sourceCode: submission.sourceCode,
       languageSlug,
       testcaseInput: testcase.input,
       expectedOutput: testcase.expectedOutput,
       cpuLimitMs: language.defaultCpuMs,
       memoryLimitKb: language.defaultMemoryKb
     })
9. Return submission response:
   {
     id,
     status: 'QUEUED',
     totalTests,
     passedTests: 0,
     createdAt
   }
```

**Response Schema**:

```typescript
{
  id: string;
  status: Verdict;
  totalTests: number;
  passedTests: number;
  maxMemoryKb: number;
  totalWallTimeMs: number;
  createdAt: ISO8601;
}
```

#### 2.2 GET /submissions/:id

**Purpose**: Poll submission status

**Processing**:

```
1. Validate submission ID format
2. Fetch submission with related jobs and results:
   await prisma.submission.findUnique({
     where: { id },
     include: {
       jobs: {
         include: { result: true }
       }
     }
   })
3. If not found → 404
4. Return submission with:
   - status (current)
   - passedTests count
   - totalTests count
   - maxMemoryKb
   - totalWallTimeMs
   - jobs (with individual verdicts)
```

**Response Example**:

```json
{
  "id": "uuid-1",
  "status": "RUNNING",
  "totalTests": 5,
  "passedTests": 2,
  "maxMemoryKb": 15000,
  "totalWallTimeMs": 1500,
  "jobs": [
    {
      "id": "job-1",
      "testcaseId": "test-1",
      "status": "ACCEPTED",
      "result": {
        "verdict": "ACCEPTED",
        "wallTimeMs": 45,
        "memoryKb": 2000,
        "stdout": "output"
      }
    }
  ]
}
```

#### 2.3 GET /problems

**Purpose**: List all published problems

**Query Parameters**:

```typescript
{
  skip?: number;      // Pagination offset
  take?: number;      // Page size (default: 20, max: 100)
  difficulty?: Difficulty[];  // Filter by difficulty
  tags?: string[];    // Filter by tags
  search?: string;    // Full-text search on title/statement
}
```

**Processing**:

```
1. Build Prisma where clause from filters
2. Query problems:
   await prisma.problem.findMany({
     where: {
       isPublished: true,
       AND: [
         difficulty filters,
         tag filters,
         search filters
       ]
     },
     skip,
     take: Math.min(take, 100),
     select: {
       id, slug, title, difficulty,
       tags, _count: { submissions: true }
     }
   })
3. Return paginated list with submission counts
```

#### 2.4 GET /problems/:slug

**Purpose**: Get single problem with testcases

**Processing**:

```
1. Fetch problem with testcases:
   await prisma.problem.findUnique({
     where: { slug },
     include: {
       testcases: {
         where: { isSample: true },  // Only sample tests to client
         select: { name, input, expectedOutput }
       }
     }
   })
2. If not published and not admin → 403
3. Return problem with:
   - Full statement, constraints
   - Sample testcases only (not hidden tests)
   - Accepted/total submission counts
```

#### 2.5 GET /health & GET /metrics

**Purpose**: Observability endpoints

**Health Check**:

```
1. Check database connectivity:
   await prisma.$queryRaw`SELECT 1`
2. Check Redis connectivity:
   await redis.ping()
3. Return status: UP/DOWN with details
```

**Metrics**:

```
Returns Prometheus-formatted metrics:
- http_request_duration_seconds (histogram)
  Labels: method, route, status_code
- judge_queue_depth (gauge)
- judge_worker_active (gauge)
```

### Error Handling

**Zod Validation Errors**:

```typescript
// Middleware catches ZodError
if (error instanceof ZodError) {
  return reply.code(400).send({
    error: "Validation failed",
    issues: error.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  });
}
```

**Database Errors**:

```typescript
// Catch and log Prisma errors
if (error instanceof Prisma.PrismaClientKnownRequestError) {
  app.log.error(error);
  return reply.code(500).send({ error: "Database error" });
}
```

### Middleware Pipeline

```
Request
  ↓
[1] CORS origin check
  ↓
[2] Helmet security headers
  ↓
[3] Rate limiter (120/min)
  ↓
[4] Request timer (startTime = hrtime)
  ↓
[5] Route handler
  ↓
[6] Response interceptor (duration metric)
  ↓
[7] Error handler (ZodError, etc.)
  ↓
Response
```

---

## 3. Worker Service (`apps/worker`)

### Architecture

```
Worker (BullMQ Consumer)
├── Job Consumer Loop
│   ├── Dequeue job
│   ├── Lock job (prevent duplicate processing)
│   ├── Execute code
│   └── Store result
├── Language Runners
│   ├── C Compiler
│   ├── C++ Compiler
│   ├── Java Compiler
│   └── Python Interpreter
└── Resource Management
    ├── Memory tracking
    ├── CPU limiting
    └── Timeout handling
```

### Job Processing Pipeline

#### 3.1 Job Consumption

```typescript
const worker = new Worker(
  "judge-queue",
  async (job) => {
    // Deserialize payload
    const payload = executionJobPayloadSchema.parse(job.data);

    // Update job as RUNNING
    await prisma.executionJob.update({
      where: { id: payload.executionJobId },
      data: {
        status: "RUNNING",
        lockedBy: workerId,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    // Execute the job
    const result = await executeJob(payload);

    // Store execution result
    await prisma.executionResult.upsert({
      where: { executionJobId: payload.executionJobId },
      create: result,
      update: result,
    });

    // Update job status
    await prisma.executionJob.update({
      where: { id: payload.executionJobId },
      data: { status: result.verdict },
    });

    return result;
  },
  { connection, concurrency: 1 },
);
```

#### 3.2 Job Payload Structure

```typescript
interface ExecutionJobPayload {
  executionJobId: string; // Reference for storing result
  submissionId: string; // Associated submission
  sourceCode: string; // Code to execute
  languageSlug: LanguageSlug; // c | cpp | java | python
  testcaseInput: string; // stdin
  expectedOutput: string; // Expected stdout
  cpuLimitMs: number; // CPU time limit (2000ms default)
  memoryLimitKb: number; // Memory limit (256MB default)

  // For interpreted languages:
  sourceFile?: string; // e.g., "main.py"

  // For compiled languages:
  compileCommand?: string[]; // e.g., ["gcc", "-o", "main", "main.c"]
  runCommand?: string[]; // e.g., ["./main"]
}
```

#### 3.3 Code Execution Process

**For Compiled Languages (C, C++, Java)**:

```
1. Create temp working directory
2. Write source code to file (main.c, Main.java)
3. Compile:
   - Command: gcc -o main main.c (with flags)
   - Timeout: 5 seconds
   - Capture: stdout, stderr as compileOutput
   - If compilation fails → verdict: COMPILE_ERROR
4. Run compiled executable:
   - Provide testcase input via stdin
   - Redirect stdout/stderr
   - Apply time/memory limits via:
     • timeout command (CPU time limit)
     • ulimit -v (virtual memory limit)
     • Docker resource limits
   - Capture: stdout, stderr, exit code, metrics
5. Compare output:
   - Trim whitespace (normalize)
   - Exact match check
   - If match → ACCEPTED
   - If no match → WRONG_ANSWER
6. Handle special exit codes:
   - exit(0) + correct output → ACCEPTED
   - exit(1) → RUNTIME_ERROR
   - SIGKILL (124) → TIME_LIMIT_EXCEEDED
   - SIGSEGV (139) → RUNTIME_ERROR
   - Memory exhausted → MEMORY_LIMIT_EXCEEDED
```

**For Interpreted Languages (Python)**:

```
1. Write source code to file (main.py)
2. Run interpreter directly:
   - Command: timeout 2s python3 main.py
   - Input: testcase input via stdin
   - Output: capture stdout/stderr
3. Same output comparison logic
```

#### 3.4 ExecutionResult Storage

```typescript
interface ExecutionResult {
  id: string;
  executionJobId: string; // Foreign key to job
  verdict: Verdict; // Result status
  stdout: string; // Program output (first 100KB)
  stderr: string; // Error output (first 50KB)
  compileOutput: string; // Compile errors (if any)
  exitCode: number | null; // Program exit code
  wallTimeMs: number; // Actual execution time
  memoryKb: number; // Peak memory usage
  message?: string; // Error message (if verdict is ERROR)
  createdAt: DateTime;
}
```

#### 3.5 Verdict Determination Logic

```typescript
function determineVerdict(
  exitCode: number | null,
  signal: string | null,
  wallTimeMs: number,
  memoryKb: number,
  expectedOutput: string,
  actualOutput: string,
  limits: { cpuMs: number; memoryKb: number },
): Verdict {
  // Check compile error (caught earlier)

  // Check time limit
  if (wallTimeMs > limits.cpuMs) {
    return "TIME_LIMIT_EXCEEDED";
  }

  // Check memory limit
  if (memoryKb > limits.memoryKb) {
    return "MEMORY_LIMIT_EXCEEDED";
  }

  // Check runtime error (non-zero exit)
  if (exitCode !== 0 && exitCode !== null) {
    return "RUNTIME_ERROR";
  }

  // Check output correctness
  if (normalize(actualOutput) !== normalize(expectedOutput)) {
    return "WRONG_ANSWER";
  }

  return "ACCEPTED";
}

function normalize(s: string): string {
  return s
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}
```

#### 3.6 Error Handling in Worker

```typescript
worker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      event: "job.completed",
      jobId: job.id,
      jobData: job.data,
    }),
  );
});

worker.on("failed", async (job, error) => {
  const payload = job ? executionJobPayloadSchema.safeParse(job.data) : null;

  if (payload?.success) {
    // Store error result
    await prisma.executionResult.upsert({
      where: { executionJobId: payload.data.executionJobId },
      create: {
        executionJobId: payload.data.executionJobId,
        verdict: "INTERNAL_ERROR",
        stdout: "",
        stderr: "",
        compileOutput: "",
        exitCode: null,
        wallTimeMs: 0,
        memoryKb: 0,
        message: error.message,
      },
      update: {
        verdict: "INTERNAL_ERROR",
        message: error.message,
      },
    });

    // Update job status
    await prisma.executionJob.update({
      where: { id: payload.data.executionJobId },
      data: { status: "INTERNAL_ERROR" },
    });
  }
});
```

### Language Configuration

**Database Schema**:

```prisma
model Language {
  id              String    @id @default(uuid())
  slug            LanguageSlug @unique
  name            String
  sourceFile      String    // e.g., "main.c", "Main.java"
  compileCommand  String[]  // e.g., ["gcc", "-O2", "-o", "main", "{sourceFile}"]
  runCommand      String[]  // e.g., ["./main"]
  defaultCpuMs    Int       @default(2000)  // Time limit
  defaultMemoryKb Int       @default(262144) // 256 MB
  isEnabled       Boolean   @default(true)
}
```

**Example Configurations**:

C:

```
sourceFile: "main.c"
compileCommand: ["gcc", "-Wall", "-O2", "-o", "main", "main.c"]
runCommand: ["./main"]
defaultCpuMs: 2000
defaultMemoryKb: 262144
```

Python:

```
sourceFile: "main.py"
compileCommand: []  // No compilation
runCommand: ["python3", "main.py"]
defaultCpuMs: 5000
defaultMemoryKb: 524288  // 512 MB
```

Java:

```
sourceFile: "Main.java"
compileCommand: ["javac", "Main.java"]
runCommand: ["java", "Main"]
defaultCpuMs: 3000
defaultMemoryKb: 524288
```

### Resource Limits & Sandboxing

**In Docker Container**:

```dockerfile
# Dockerfile.c
FROM ubuntu:20.04
RUN apt-get update && apt-get install -y gcc
RUN useradd -m judge
USER judge
WORKDIR /tmp

# Execution with resource limits
CMD ["sh", "-c", "timeout 2s ulimit -v 262144 && gcc -o main main.c && ./main"]
```

**Resource Constraints**:

- CPU time: `timeout` command (SIGKILL at limit)
- Memory: `ulimit -v` (virtual memory limit)
- Disk: Temporary directory with size limit
- Network: No network access

**gVisor Runtime** (Kubernetes):

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: worker-pod
spec:
  runtimeClassName: gvisor
  containers:
    - name: worker
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        allowPrivilegeEscalation: false
        capabilities:
          drop:
            - ALL
      resources:
        limits:
          cpu: "1"
          memory: "1Gi"
        requests:
          cpu: "500m"
          memory: "512Mi"
```

---

## 4. Orchestrator Service (`apps/orchestrator`)

### Architecture

```
Orchestrator (Polling Loop)
├── Periodic Tick (1s interval)
│   ├── Query open submissions
│   ├── Check job completion
│   ├── Aggregate results
│   └── Update submission status
└── Database Queries (optimized)
    ├── Fetch N submissions with status
    ├── Include all jobs and results
    └── Batch updates
```

### Aggregation Algorithm

#### 4.1 Main Loop

```typescript
async function aggregateOpenSubmissions() {
  // Query submissions still being processed
  const submissions = await prisma.submission.findMany({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
    },
    include: {
      jobs: {
        include: { result: true },
      },
    },
    take: 100, // Process in batches
  });

  for (const submission of submissions) {
    // Process each submission
    await aggregateSubmission(submission);
  }

  return submissions.length;
}
```

#### 4.2 Aggregation Logic

```typescript
async function aggregateSubmission(submission: SubmissionWithJobs) {
  const totalJobs = submission.jobs.length;
  const completedJobs = submission.jobs.filter((job) => job.result);
  const runningJobs = submission.jobs.filter((job) => job.status === "RUNNING");

  // Case 1: Some jobs still pending
  if (completedJobs.length < totalJobs) {
    const newStatus = runningJobs.length > 0 ? "RUNNING" : "QUEUED";

    // Update status if changed
    if (submission.status !== newStatus) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: newStatus },
      });
    }
    return;
  }

  // Case 2: All jobs completed
  const verdictPriority = [
    "INTERNAL_ERROR",
    "COMPILE_ERROR",
    "RUNTIME_ERROR",
    "TIME_LIMIT_EXCEEDED",
    "MEMORY_LIMIT_EXCEEDED",
    "WRONG_ANSWER",
    "ACCEPTED",
  ];

  // Find highest-priority failing verdict
  let finalVerdict = "ACCEPTED";
  for (const verdict of verdictPriority) {
    const hasFailed = completedJobs.some(
      (job) => job.result?.verdict === verdict,
    );
    if (hasFailed) {
      finalVerdict = verdict;
      break;
    }
  }

  // Count passed tests
  const passedTests = completedJobs.filter(
    (job) => job.result?.verdict === "ACCEPTED",
  ).length;

  // Calculate statistics
  const maxMemoryKb = Math.max(
    0,
    ...completedJobs.map((job) => job.result?.memoryKb ?? 0),
  );

  const totalWallTimeMs = completedJobs.reduce(
    (sum, job) => sum + (job.result?.wallTimeMs ?? 0),
    0,
  );

  // Update submission with final results
  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: finalVerdict,
      passedTests,
      maxMemoryKb,
      totalWallTimeMs,
    },
  });
}
```

#### 4.3 Verdict Priority Logic

```
Priority ordering (highest to lowest):
1. INTERNAL_ERROR     - System/infrastructure failure
2. COMPILE_ERROR      - Code doesn't compile
3. RUNTIME_ERROR      - Execution crash
4. TIME_LIMIT_EXCEEDED - Code ran too long
5. MEMORY_LIMIT_EXCEEDED - Used too much memory
6. WRONG_ANSWER       - Output mismatch
7. ACCEPTED           - All tests passed

If any job has INTERNAL_ERROR → submission is INTERNAL_ERROR
Else if any job has COMPILE_ERROR → submission is COMPILE_ERROR
Else if any job has RUNTIME_ERROR → submission is RUNTIME_ERROR
...
Else if any job has WRONG_ANSWER → submission is WRONG_ANSWER
Else (all are ACCEPTED) → submission is ACCEPTED
```

#### 4.4 Performance Optimization

```typescript
// Only query submissions needing aggregation
where: {
  status: { in: ['QUEUED', 'RUNNING'] }
  // Excludes completed submissions
}

// Batch aggregation (process 100 at a time)
take: 100

// Include relationships in single query
include: {
  jobs: {
    include: { result: true }
  }
}

// Update only if status changed
if (submission.status !== newStatus) {
  await update(...)
}
```

#### 4.5 Error Resilience

```typescript
async function tick() {
  try {
    const count = await aggregateOpenSubmissions();
    if (count > 0) {
      console.log(
        JSON.stringify({
          event: "orchestrator.aggregated",
          count,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "orchestrator.error",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }),
    );
    // Continue despite errors
  } finally {
    // Always schedule next tick
    setTimeout(tick, intervalMs);
  }
}
```

---

## 5. Database Layer (`packages/db`)

### Prisma Schema & Optimization

**Indexes** (for query performance):

```prisma
model Problem {
  ...
  @@index([slug])  // Fast lookups by slug
}

model Submission {
  ...
  @@index([userId, problemId, createdAt])
  @@index([problemId, status])
}

model ExecutionJob {
  ...
  @@index([status, createdAt])  // For orchestrator queries
}
```

**Query Patterns**:

1. **Create Submission**:

   ```
   INSERT 1 Submission
   INSERT N ExecutionJob (N = testcase count)
   ```

2. **Poll Submission**:

   ```
   SELECT Submission WHERE id = ?
   SELECT ExecutionJob WHERE submissionId = ?
   SELECT ExecutionResult WHERE executionJobId IN (?)
   ```

3. **Aggregate**:
   ```
   SELECT Submission WHERE status IN ['QUEUED', 'RUNNING']
   LEFT JOIN ExecutionJob ON ...
   LEFT JOIN ExecutionResult ON ...
   ```

### Connection Pooling

```typescript
// Prisma client with connection pool
const prisma = new PrismaClient({
  __internal: {
    debug: true, // Enable query logging
  },
});

// Connection pool size (default: 2 * CPU cores)
// DATABASE_URL="postgresql://...?connection_limit=20"
```

---

## 6. Queue System (Redis + BullMQ)

### Queue Configuration

```typescript
const queue = new Queue("judge-queue", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3, // Retry failed jobs 3 times
    backoff: {
      type: "exponential",
      delay: 2000, // Exponential backoff (2s, 4s, 8s)
    },
    removeOnComplete: true, // Remove from queue after success
    removeOnFail: false, // Keep failed jobs for inspection
  },
});
```

### Job Lifecycle

```
[1] QUEUED (in Redis)
  │
  └─→ [2] ACTIVE (worker processing)
       │
       ├─→ [3] COMPLETED ✓
       │
       └─→ [3] FAILED ✗
            │
            └─→ [4] RETRY WAIT (exponential backoff)
                 │
                 └─→ [2] ACTIVE (retry)
                      │
                      └─→ ... (up to 3 attempts)
                           │
                           └─→ [5] FAILED (moved to DLQ)
```

### Monitoring Queue

```typescript
// Queue depth (for KEDA scaling)
const jobCount = await queue.getWaitingCount();
const activeCount = await queue.getActiveCount();
const failedCount = await queue.getFailedCount();

// Metrics
gauge.set("queue_waiting", jobCount);
gauge.set("queue_active", activeCount);
gauge.set("queue_failed", failedCount);
```

---

## 7. Shared Types (`packages/types` & `packages/judge-protocol`)

### Type Definitions

```typescript
// packages/types/src/index.ts
export type Verdict =
  | "QUEUED"
  | "RUNNING"
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";

export type LanguageSlug = "c" | "cpp" | "java" | "python";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type Role = "USER" | "ADMIN";

export interface CreateSubmissionRequest {
  problemSlug: string;
  languageSlug: LanguageSlug;
  sourceCode: string;
}

export interface SubmissionResponse {
  id: string;
  status: Verdict;
  totalTests: number;
  passedTests: number;
  maxMemoryKb: number;
  totalWallTimeMs: number;
  jobs: JobResponse[];
  createdAt: string;
}

export interface JobResponse {
  id: string;
  testcaseId: string;
  status: Verdict;
  result?: ExecutionResultResponse;
}

export interface ExecutionResultResponse {
  verdict: Verdict;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number | null;
  wallTimeMs: number;
  memoryKb: number;
  message?: string;
}
```

### Judge Protocol Contract

```typescript
// packages/judge-protocol/src/index.ts
export const executionJobPayloadSchema = z.object({
  executionJobId: z.string().uuid(),
  submissionId: z.string().uuid(),
  sourceCode: z.string(),
  languageSlug: z.enum(["c", "cpp", "java", "python"]),
  testcaseInput: z.string(),
  expectedOutput: z.string(),
  cpuLimitMs: z.number().positive(),
  memoryLimitKb: z.number().positive(),
});

export const executionResultSchema = z.object({
  executionJobId: z.string().uuid(),
  verdict: verdictSchema,
  stdout: z.string().max(100000),
  stderr: z.string().max(50000),
  compileOutput: z.string().max(50000),
  exitCode: z.number().int().nullable(),
  wallTimeMs: z.number().non_negative(),
  memoryKb: z.number().non_negative(),
  message: z.string().optional(),
});
```

---

## 8. Metrics & Observability

### Prometheus Metrics

```typescript
// HTTP request duration histogram
const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// Recorded in middleware:
httpRequestDuration.observe(
  {
    method: request.method,
    route: request.routeOptions.url ?? request.url,
    status_code: String(reply.statusCode),
  },
  duration,
);
```

**Queue Metrics**:

```typescript
const queueDepthGauge = new Gauge({
  name: "judge_queue_depth",
  help: "Number of pending jobs in judge queue",
  collect: async () => {
    const count = await queue.getWaitingCount();
    queueDepthGauge.set(count);
  },
});

const activeWorkersGauge = new Gauge({
  name: "judge_workers_active",
  help: "Number of active workers",
  collect: async () => {
    const count = await queue.getActiveCount();
    activeWorkersGauge.set(count);
  },
});
```

### Structured Logging

```json
// API submission request
{
  "timestamp": "2026-09-02T10:30:45.123Z",
  "level": "info",
  "event": "submission.created",
  "submissionId": "uuid-123",
  "userId": "user-456",
  "problemSlug": "two-sum",
  "languageSlug": "cpp",
  "testcaseCount": 5,
  "duration_ms": 45
}

// Worker job completion
{
  "timestamp": "2026-09-02T10:30:47.890Z",
  "level": "info",
  "event": "job.completed",
  "jobId": "job-123",
  "executionJobId": "exec-456",
  "verdict": "ACCEPTED",
  "wallTimeMs": 123,
  "memoryKb": 4096
}

// Orchestrator aggregation
{
  "timestamp": "2026-09-02T10:30:50.000Z",
  "level": "info",
  "event": "orchestrator.aggregated",
  "count": 42,
  "duration_ms": 256
}
```

---

## 9. Kubernetes Deployment Details

### StatefulSet (Worker)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  namespace: algoforge
spec:
  replicas: 2 # Base replicas
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      runtimeClassName: gvisor # gVisor sandbox
      serviceAccountName: worker
      containers:
        - name: worker
          image: algoforge-worker:latest
          imagePullPolicy: IfNotPresent
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: algoforge-secrets
                  key: redis-url
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: algoforge-secrets
                  key: database-url
            - name: WORKER_CONCURRENCY
              value: "1"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            exec:
              command:
                - /bin/sh
                - -c
                - ps aux | grep "[n]ode"
            initialDelaySeconds: 10
            periodSeconds: 30
```

### KEDA ScaledObject

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: judge-queue-scaler
  namespace: algoforge
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: redis
      metadata:
        address: redis-service:6379
        databaseIndex: "0"
        listName: bull:judge-queue:wait # BullMQ queue name
        listLength: "5" # Scale up when 5 jobs waiting per pod
      authModes:
        - password
```

---

## Summary of Key Algorithms

| Component           | Algorithm                    | Time Complexity | Space Complexity |
| ------------------- | ---------------------------- | --------------- | ---------------- |
| Submission Creation | N testcase job creation      | O(N)            | O(N)             |
| Job Processing      | Code compile + test          | O(T)            | O(L)             |
| Aggregation         | Verdict priority check       | O(N)            | O(1)             |
| Output Comparison   | String normalization + match | O(M)            | O(M)             |
| Queue Processing    | BullMQ dequeue + lock        | O(1) amortized  | O(1)             |

Where:

- N = testcase count
- T = code complexity + time limit
- L = memory limit
- M = output string length
