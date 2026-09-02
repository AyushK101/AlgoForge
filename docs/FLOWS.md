# AlgoForge - System Flows & Data Flows

---

## 1. Submission Flow (End-to-End)

### User Submits Code

```
┌──────────────────────────────────────────────────────────────┐
│                     User Browser                              │
│                                                               │
│  1. User views problem statement                             │
│  2. Types code in editor                                     │
│  3. Selects language (C++, Python, etc.)                     │
│  4. Clicks "Submit" button                                   │
└───────────────┬────────────────────────────────────────────┘
                │ POST /submissions
                │ { problemSlug, languageSlug, sourceCode }
                ▼
┌──────────────────────────────────────────────────────────────┐
│                    API Service                                │
│                                                               │
│  Submission Creation Handler:                               │
│  5. Validate request with Zod                               │
│  6. Find problem by slug (DB query)                          │
│  7. Find language (DB query)                                 │
│  8. Fetch all testcases (DB query)                           │
│  9. Create Submission record:                                │
│     - status: QUEUED                                         │
│     - totalTests: testcase count                             │
│     - passedTests: 0                                         │
│                                                               │
│  10. Create N ExecutionJob records (1 per testcase):         │
│      For each testcase:                                      │
│        - Create ExecutionJob with status: QUEUED             │
│                                                               │
│  11. Enqueue all jobs to Redis:                              │
│      For each job:                                           │
│        queue.add('execute', {                                │
│          executionJobId,                                     │
│          sourceCode,                                         │
│          testcaseInput,                                      │
│          expectedOutput,                                     │
│          cpuLimitMs: 2000,                                   │
│          memoryLimitKb: 262144                               │
│        })                                                    │
│                                                               │
│  12. Return response:                                        │
│      {                                                       │
│        id: "sub-123",                                        │
│        status: "QUEUED",                                     │
│        totalTests: 5,                                        │
│        passedTests: 0,                                       │
│        createdAt: ISO8601                                    │
│      }                                                       │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
                │ Return submissionId   │ Queue jobs
                │                      ▼
                │              ┌──────────────────┐
                │              │  Redis Queue     │
                │              │                  │
                │              │  [Job-1]         │
                │              │  [Job-2]         │
                │              │  [Job-3]         │
                │              │  [Job-4]         │
                │              │  [Job-5]         │
                │              └────────┬─────────┘
                │                       │
                ▼                       │ Consume
        ┌───────────────┐               ▼
        │ Browser       │        ┌────────────────────────────┐
        │               │        │    Worker Pod              │
        │ Poll Status   │        │                            │
        │ GET /submissions/sub-123
        │               │        │ 13. Dequeue job-1          │
        │               │        │ 14. Lock: lockedBy=worker1 │
        │               │        │ 15. Update ExecutionJob:   │
        │ Response:     │        │     status: RUNNING        │
        │ {             │        │                            │
        │   status: Q   │        │ 16. Write source to file:  │
        │   passed: 0   │        │     main.cpp               │
        │ }             │        │                            │
        │               │        │ 17. Compile:               │
        └───────────────┘        │     g++ -O2 -o main main.cpp
                                 │     (capture output)       │
                                 │                            │
        ┌──────────────────┐     │ 18. If compilation fails:  │
        │ Browser          │     │     → ExecutionResult:     │
        │                  │     │        verdict=COMPILE_ERR │
        │ Poll again       │     │        compileOutput=...   │
        │ /submissions/    │     │                            │
        │ sub-123          │     │ 19. If success, run:       │
        │                  │     │     echo "test_input" |    │
        │ Response:        │     │     ./main                 │
        │ {                │     │                            │
        │   status: RUNNING│     │ 20. Capture:               │
        │   passed: 0      │     │     stdout, stderr         │
        │ }                │     │     exitCode               │
        │                  │     │     wallTimeMs             │
        └──────────────────┘     │     memoryKb               │
                                 │                            │
        ┌──────────────────┐     │ 21. Compare output:        │
        │ Browser          │     │     normalize(stdout)      │
        │                  │     │     vs                     │
        │ Poll again       │     │     normalize(expected)    │
        │ /submissions/    │     │                            │
        │ sub-123          │     │ 22. Determine verdict:     │
        │                  │     │     if match →ACCEPTED     │
        │ Response:        │     │     else → WRONG_ANSWER    │
        │ {                │     │                            │
        │   status: RUNNING│     │ 23. Create ExecutionResult:│
        │   passed: 2      │     │     verdict, stdout, etc   │
        │   jobs: [        │     │                            │
        │     {            │     │ 24. Update ExecutionJob:   │
        │       id: job-1  │     │     status: ACCEPTED       │
        │       verdict: A │     │     (or WRONG_ANSWER)      │
        │     },           │     │                            │
        │     {            │     │ 25. Repeat for each job    │
        │       id: job-2  │     │     (concurrent or seq)    │
        │       verdict: A │     │                            │
        │     }            │     │                            │
        │   ]              │     └────────────────┬───────────┘
        │ }                │                      │ Update DB
        │                  │                      ▼
        └──────────────────┘              ┌──────────────────┐
                                          │  PostgreSQL      │
                                          │                  │
                ┌─────────────────────────┤  Execution       │
                │                         │  Results stored  │
                │                         │                  │
                │                         │  ExecutionJob    │
                │                         │  status → RESULT │
                │                         │                  │
                │                         └──────────────────┘
                │
                ▼
        ┌──────────────────────────────┐
        │ Browser (keeps polling)      │
        │                              │
        │ Eventually:                  │
        │ GET /submissions/sub-123     │
        │ Response:                    │
        │ {                            │
        │   status: ACCEPTED           │
        │   passed: 5/5                │
        │   maxMemoryKb: 4096          │
        │   totalWallTimeMs: 245       │
        │   jobs: [                    │
        │     { verdict: ACCEPTED },   │
        │     { verdict: ACCEPTED },   │
        │     { verdict: ACCEPTED },   │
        │     { verdict: ACCEPTED },   │
        │     { verdict: ACCEPTED }    │
        │   ]                          │
        │ }                            │
        │                              │
        │ Display: "✓ All tests passed!"
        └──────────────────────────────┘
```

**Timeline Summary**:

```
T=0ms:    User submits code → API creates submission & jobs
T=1ms:    Jobs pushed to Redis queue
T=10ms:   Worker dequeues job-1, starts processing
T=45ms:   Job-1 complete (e.g., execution time 35ms)
T=50ms:   Worker dequeues job-2
T=100ms:  Browser polls submission status (shows RUNNING, 1/5 passed)
T=130ms:  All 5 jobs complete
T=130ms:  Orchestrator picks up submission (if next tick)
T=131ms:  Orchestrator aggregates results, updates to ACCEPTED
T=550ms:  Browser polls again, sees ACCEPTED status ✓
```

---

## 2. Job Processing Flow (Worker Detail)

```
Worker Process:
┌─────────────────────────────────────────┐
│  BullMQ Worker Loop (concurrency: 1)    │
└────────────────┬────────────────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Dequeue from Redis     │
    │ bullmq:judge-queue:... │
    │                        │
    │ Get Job:               │
    │ {                      │
    │   id: "job-uuid",      │
    │   data: {payload}      │
    │ }                      │
    └────────────┬───────────┘
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Parse & Validate Job Payload         │
    │                                      │
    │ executionJobPayloadSchema.parse(...)│
    │                                      │
    │ Extract:                             │
    │ - executionJobId                     │
    │ - sourceCode                         │
    │ - languageSlug (cpp)                 │
    │ - testcaseInput (stdin)              │
    │ - expectedOutput                     │
    │ - cpuLimitMs: 2000                   │
    │ - memoryLimitKb: 262144              │
    └────────────┬───────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │ Update ExecutionJob Status → RUNNING   │
    │                                        │
    │ UPDATE ExecutionJob SET                │
    │   status='RUNNING',                    │
    │   lockedBy='worker-pod-1',             │
    │   lockedAt=NOW(),                      │
    │   attempts=attempts+1                  │
    │ WHERE id='job-uuid'                    │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────┐
    │ Create Temporary Workspace               │
    │                                          │
    │ /tmp/exec-{jobId}/                       │
    │ ├── main.cpp          ← Write sourceCode │
    │ ├── input.txt         ← Write testInput  │
    │ └── output.txt        ← For capture     │
    └────────────┬─────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────┐
    │ COMPILATION STAGE (if compiled language) │
    │                                          │
    │ Execute: g++ -O2 -Wall -o main main.cpp │
    │ Timeout: 5 seconds                       │
    │ Capture: stdout, stderr                  │
    │                                          │
    │ Exit Codes:                              │
    │ - 0: Success → proceed to execution      │
    │ - 1+: Error → COMPILE_ERROR              │
    │                                          │
    │ Store compileOutput (first 50KB)         │
    └────────────┬────────────────────────────┘
                 │
                 ├─ Compilation Failed ─────────┐
                 │                              │
                 │                              ▼
                 │            ┌──────────────────────────────┐
                 │            │ Create ExecutionResult       │
                 │            │                              │
                 │            │ verdict: COMPILE_ERROR       │
                 │            │ stdout: ""                   │
                 │            │ stderr: ""                   │
                 │            │ compileOutput: "error: ..." │
                 │            │ exitCode: 1                  │
                 │            │ wallTimeMs: 3456             │
                 │            │ memoryKb: 0                  │
                 │            │ message: "Compilation failed"│
                 │            └───────────┬──────────────────┘
                 │                        │
                 │                        ▼
                 │            ┌────────────────────┐
                 │            │ Skip to Result DB  │
                 │            │ Storage (below)    │
                 │            └────────────────────┘
                 │
                 └─ Compilation Success ────────┐
                                                │
                                                ▼
                    ┌──────────────────────────────────────┐
                    │ EXECUTION STAGE                      │
                    │                                      │
                    │ Execute: ./main < input.txt         │
                    │ With limits:                         │
                    │ - timeout 2s (cpuLimitMs)           │
                    │ - ulimit -v 262144 (memoryKb)       │
                    │ - ulimit -t 3 (CPU seconds)         │
                    │                                      │
                    │ Capture:                             │
                    │ - stdout (to output.txt)             │
                    │ - stderr (to error.txt)              │
                    │ - exitCode                           │
                    │ - signal (SIGKILL, SIGSEGV, etc)    │
                    │ - wallTimeMs (real time)             │
                    │ - memoryKb (peak VmPeak from /proc)  │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ VERDICT DETERMINATION                │
                    │                                      │
                    │ if exitCode !== 0:                   │
                    │   if signal == SIGKILL:              │
                    │     verdict = TIME_LIMIT_EXCEEDED    │
                    │   else if memory_exhausted:          │
                    │     verdict = MEMORY_LIMIT_EXCEEDED  │
                    │   else:                              │
                    │     verdict = RUNTIME_ERROR          │
                    │                                      │
                    │ else if wallTimeMs > cpuLimitMs:     │
                    │   verdict = TIME_LIMIT_EXCEEDED      │
                    │                                      │
                    │ else if memoryKb > memoryLimitKb:    │
                    │   verdict = MEMORY_LIMIT_EXCEEDED    │
                    │                                      │
                    │ else:                                │
                    │   actual = normalize(stdout)         │
                    │   expected = normalize(output)       │
                    │   if actual == expected:             │
                    │     verdict = ACCEPTED               │
                    │   else:                              │
                    │     verdict = WRONG_ANSWER           │
                    │     store first 1KB of diff          │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ CREATE ExecutionResult               │
                    │                                      │
                    │ INSERT INTO ExecutionResult (        │
                    │   executionJobId: 'job-uuid',        │
                    │   verdict: 'ACCEPTED',               │
                    │   stdout: '10\n5\n3',                │
                    │   stderr: '',                        │
                    │   compileOutput: '',                 │
                    │   exitCode: 0,                       │
                    │   wallTimeMs: 123,                   │
                    │   memoryKb: 4096,                    │
                    │   createdAt: NOW()                   │
                    │ )                                    │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ UPDATE ExecutionJob                  │
                    │                                      │
                    │ UPDATE ExecutionJob SET              │
                    │   status = 'ACCEPTED'                │
                    │ WHERE id = 'job-uuid'                │
                    │                                      │
                    │ (or WRONG_ANSWER, RUNTIME_ERROR, etc)
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ CLEANUP                              │
                    │                                      │
                    │ rm -rf /tmp/exec-{jobId}             │
                    │ Delete temporary files               │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ RETURN JOB RESULT to BullMQ          │
                    │                                      │
                    │ return {                             │
                    │   executionJobId,                    │
                    │   verdict,                           │
                    │   stdout,                            │
                    │   stderr,                            │
                    │   compileOutput,                     │
                    │   exitCode,                          │
                    │   wallTimeMs,                        │
                    │   memoryKb,                          │
                    │   message                            │
                    │ }                                    │
                    │                                      │
                    │ BullMQ marks job: COMPLETED          │
                    │ Removes job from queue               │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ LOG EVENT                            │
                    │                                      │
                    │ {                                    │
                    │   event: 'job.completed',            │
                    │   jobId: 'job-uuid',                 │
                    │   verdict: 'ACCEPTED',               │
                    │   duration_ms: 156                   │
                    │ }                                    │
                    └────────────┬───────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ READY FOR NEXT JOB                   │
                    │                                      │
                    │ Worker loop continues...             │
                    │ Dequeue next job from queue          │
                    └──────────────────────────────────────┘
```

---

## 3. Orchestration Flow (Aggregation)

```
Orchestrator (Periodic Task every 1s):

┌──────────────────────────────────────────────────────┐
│ Tick() - Called every 1000ms                         │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Query Open Submissions                               │
│                                                      │
│ SELECT Submission WHERE status IN                    │
│   ('QUEUED', 'RUNNING')                              │
│ INCLUDE jobs (ExecutionJob)                          │
│ INCLUDE jobs.result (ExecutionResult)                │
│ LIMIT 100  (batch processing)                        │
│                                                      │
│ Result: [                                            │
│   {                                                  │
│     id: 'sub-1',                                     │
│     status: 'RUNNING',                               │
│     totalTests: 3,                                   │
│     jobs: [                                          │
│       {                                              │
│         id: 'job-1',                                 │
│         status: 'ACCEPTED',                          │
│         result: {                                    │
│           verdict: 'ACCEPTED',                       │
│           wallTimeMs: 45,                            │
│           memoryKb: 2000                             │
│         }                                            │
│       },                                             │
│       {                                              │
│         id: 'job-2',                                 │
│         status: 'QUEUED',                            │
│         result: null          ← Still pending!      │
│       },                                             │
│       {                                              │
│         id: 'job-3',                                 │
│         status: 'ACCEPTED',                          │
│         result: {                                    │
│           verdict: 'ACCEPTED',                       │
│           wallTimeMs: 38,                            │
│           memoryKb: 1800                             │
│         }                                            │
│       }                                              │
│     ]                                                │
│   }                                                  │
│ ]                                                    │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ For each submission:                                 │
│                                                      │
│ sub-1 Analysis:                                      │
│   totalJobs = 3                                      │
│   completedJobs = [job-1, job-3]  (have results)    │
│   pendingJobs = [job-2]            (no result)      │
│   completedCount = 2                                │
│   runningJobs = [job-2]  (status=QUEUED)            │
│                                                      │
│ Check: completedCount < totalJobs?                   │
│   YES → Some jobs still processing                   │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Handle Incomplete Submission                         │
│                                                      │
│ Determine status:                                    │
│   Any running jobs? → status = 'RUNNING'             │
│   All queued? → status = 'QUEUED'                    │
│                                                      │
│ Current status = 'RUNNING'                           │
│ New status = 'RUNNING'                               │
│                                                      │
│ Status unchanged → No update needed                  │
│ Move to next submission                              │
└───────────────┬──────────────────────────────────────┘
                │
                ▼
    ┌──────────────────────────────────────┐
    │ Later (T=5s)                         │
    │ Next tick - all jobs complete now    │
    │                                      │
    │ sub-1 Analysis:                      │
    │   completedJobs = [job-1, job-2, job-3]
    │   completedCount = 3                 │
    │   totalJobs = 3                      │
    │   All complete! ✓                    │
    └────────────┬─────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────────┐
    │ AGGREGATION: Apply Verdict Priority          │
    │                                              │
    │ Verdicts priority (highest to lowest):        │
    │ 1. INTERNAL_ERROR                            │
    │ 2. COMPILE_ERROR                             │
    │ 3. RUNTIME_ERROR                             │
    │ 4. TIME_LIMIT_EXCEEDED                       │
    │ 5. MEMORY_LIMIT_EXCEEDED                     │
    │ 6. WRONG_ANSWER                              │
    │ 7. ACCEPTED                                  │
    │                                              │
    │ Job Results:                                 │
    │ - job-1: ACCEPTED (wallTime: 45ms, mem: 2KB) │
    │ - job-2: WRONG_ANSWER (wallTime: 120ms)      │
    │ - job-3: ACCEPTED (wallTime: 38ms, mem: 1.8KB)
    │                                              │
    │ Priority Check:                              │
    │   Is there INTERNAL_ERROR? No                │
    │   Is there COMPILE_ERROR? No                 │
    │   Is there RUNTIME_ERROR? No                 │
    │   Is there TIME_LIMIT_EXCEEDED? No           │
    │   Is there MEMORY_LIMIT_EXCEEDED? No         │
    │   Is there WRONG_ANSWER? YES ← FOUND!        │
    │                                              │
    │ Final Verdict = WRONG_ANSWER                 │
    └────────────┬─────────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────────┐
    │ Calculate Statistics                         │
    │                                              │
    │ passedTests = count where verdict=ACCEPTED   │
    │   passedTests = 2                            │
    │                                              │
    │ maxMemoryKb = max of all memory usage         │
    │   maxMemoryKb = max(2000, ?, 1800) = 2000    │
    │                                              │
    │ totalWallTimeMs = sum of all wall times       │
    │   totalWallTimeMs = 45 + 120 + 38 = 203ms    │
    └────────────┬─────────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────────┐
    │ Update Submission in Database                │
    │                                              │
    │ UPDATE Submission SET                        │
    │   status = 'WRONG_ANSWER',                   │
    │   passedTests = 2,                           │
    │   maxMemoryKb = 2000,                        │
    │   totalWallTimeMs = 203,                     │
    │   updatedAt = NOW()                          │
    │ WHERE id = 'sub-1'                           │
    │                                              │
    │ ✓ Database updated                           │
    └────────────┬─────────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────────┐
    │ Log Aggregation Event                        │
    │                                              │
    │ {                                            │
    │   event: 'orchestrator.aggregated',          │
    │   count: 1,                                  │
    │   timestamp: '2026-09-02T10:30:05.000Z'     │
    │ }                                            │
    └────────────┬─────────────────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────────────────────┐
    │ Frontend polling gets updated status:         │
    │                                              │
    │ GET /submissions/sub-1                       │
    │ Response:                                    │
    │ {                                            │
    │   id: 'sub-1',                               │
    │   status: 'WRONG_ANSWER',  ← Updated!        │
    │   totalTests: 3,                             │
    │   passedTests: 2,          ← 2/3 passed      │
    │   maxMemoryKb: 2000,                         │
    │   totalWallTimeMs: 203,                      │
    │   jobs: [...]                                │
    │ }                                            │
    │                                              │
    │ Browser displays:                            │
    │ "✗ Wrong answer on test 2"                   │
    │ "Passed 2 / 3 tests"                         │
    │ "Max memory: 1.95 KB"                        │
    │ "Total time: 203 ms"                         │
    └──────────────────────────────────────────────┘
```

---

## 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Systems                         │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │  Prometheus      │         │  Structured      │             │
│  │  (Metrics)       │         │  JSON Logs       │             │
│  └────────┬─────────┘         └────────┬─────────┘             │
│           │                            │                       │
└───────────┼────────────────────────────┼─────────────────────┘
            │                            │
            │                            │
┌───────────┴────────────────────────────┴─────────────────────┐
│                         Core System                           │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                    Web Frontend                      │    │
│  │  (Next.js)                                           │    │
│  │  - Render problems                                   │    │
│  │  - Accept submissions                                │    │
│  │  - Poll status                                       │    │
│  └────────┬─────────────────────────────────┬──────────┘    │
│           │ HTTP REST                       │ HTTP REST      │
│           ▼                                 ▼                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │               API Service (Fastify)                  │    │
│  │  [Validation] [Rate Limit] [CORS]                   │    │
│  │                                                      │    │
│  │  Read: Problems, Submissions                        │    │
│  │  Write: Submissions, ExecutionJobs                  │    │
│  │  Enqueue: Jobs to Redis                             │    │
│  └────┬───────────────────────────────┬────────────────┘    │
│       │ Read/Write                    │ Enqueue             │
│       ▼                               ▼                      │
│  ┌─────────────────────┐    ┌──────────────────────┐        │
│  │    PostgreSQL       │    │   Redis + BullMQ     │        │
│  │    (Database)       │    │   (Job Queue)        │        │
│  │                     │    │                      │        │
│  │  Users              │    │ [ExecutionJob]       │        │
│  │  Problems           │    │ [ExecutionJob]       │        │
│  │  Testcases          │    │ [ExecutionJob]       │        │
│  │  Submissions        │    │ [ExecutionJob]       │        │
│  │  ExecutionJobs      │    │ ...                  │        │
│  │  ExecutionResults   │    │                      │        │
│  │  Languages          │    └──────────┬───────────┘        │
│  │                     │               │ Dequeue             │
│  └──────────┬──────────┘               ▼                     │
│             │ Read Results         ┌────────────────────┐    │
│             │                      │   Worker Pods      │    │
│             │                      │ (Docker containers)│    │
│             │                      │                    │    │
│             │                      │ [Process Job-1]    │    │
│             │                      │  - Compile         │    │
│             │                      │  - Execute         │    │
│             │                      │  - Capture output  │    │
│             │                      │                    │    │
│             │                      │ [Process Job-2]    │    │
│             │                      │  ...               │    │
│             │                      │                    │    │
│             │                      │ (Sandbox: gVisor)  │    │
│             └──────────────────────┼────────────────────┘    │
│                                    │ Store Results           │
│                                    │ Update Job Status       │
│                                    │                         │
│  ┌─────────────────────────────────▼──────────────────────┐  │
│  │            Orchestrator (Aggregator)                   │  │
│  │  (Periodic: every 1s)                                  │  │
│  │                                                        │  │
│  │  Query: QUEUED/RUNNING submissions                    │  │
│  │  Check: All jobs completed?                           │  │
│  │  Aggregate: Apply verdict priority                    │  │
│  │  Update: Set final verdict & statistics               │  │
│  └────────────────┬──────────────────────────────────────┘  │
│                   │ Update Submission Status                 │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          PostgreSQL (Feedback Loop)                  │   │
│  │                                                      │   │
│  │  Submission.status updated to FINAL_VERDICT        │   │
│  │  Frontend next poll sees updated status             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. State Transition Diagram

### Submission States

```
                    ┌─────────────────────────────────┐
                    │    Created (init: QUEUED)       │
                    │  (Frontend submits code)        │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────────┐
                    │  QUEUED                         │
                    │  Waiting in Redis queue         │
                    │  Jobs not yet assigned to       │
                    │  worker pod                     │
                    │                                 │
                    │  Trigger: Any job taken from Q  │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────────┐
                    │  RUNNING                        │
                    │  At least 1 job is processing   │
                    │  Not all jobs have results yet  │
                    │  Frontend shows progress        │
                    │  (e.g., 2/5 tests passed)       │
                    │                                 │
                    │  Trigger: All jobs completed    │
                    └────────────┬───────┬────────────┘
                                 │       │
                    ┌────────────┘       └────────────┐
                    │                                 │
                    ▼                                 ▼
    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │  ACCEPTED                    │   │  WRONG_ANSWER                │
    │  All jobs ACCEPTED           │   │  At least 1 WRONG_ANSWER     │
    │  ✓ All tests passed          │   │  (and no higher priority)    │
    │                              │   │  ✗ Tests failed              │
    └──────────────────────────────┘   └──────────────────────────────┘

    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │  COMPILE_ERROR               │   │  RUNTIME_ERROR               │
    │  At least 1 COMPILE_ERROR    │   │  At least 1 RUNTIME_ERROR    │
    │  ✗ Code doesn't compile      │   │  (and no higher priority)    │
    │                              │   │  ✗ Program crashed           │
    └──────────────────────────────┘   └──────────────────────────────┘

    ┌──────────────────────────────┐   ┌──────────────────────────────┐
    │  TIME_LIMIT_EXCEEDED         │   │  MEMORY_LIMIT_EXCEEDED       │
    │  At least 1 TLE              │   │  At least 1 MLE              │
    │  ✗ Too slow                  │   │  (and no higher priority)    │
    │                              │   │  ✗ Used too much memory      │
    └──────────────────────────────┘   └──────────────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │  INTERNAL_ERROR (Highest Priority)                       │
    │  System/infrastructure failure                           │
    │  Worker crash, DB connection lost, etc.                 │
    │  ✗ System error                                          │
    └──────────────────────────────────────────────────────────┘
```

### ExecutionJob States

```
QUEUED → RUNNING → ACCEPTED
           ↓       ↓
           ├─────→ WRONG_ANSWER
           ├─────→ COMPILE_ERROR
           ├─────→ RUNTIME_ERROR
           ├─────→ TIME_LIMIT_EXCEEDED
           ├─────→ MEMORY_LIMIT_EXCEEDED
           └─────→ INTERNAL_ERROR
```

---

## 6. Error Flow (Failure Cases)

### Case 1: Worker Crash During Execution

```
BullMQ Worker crashes while running job-5
                │
                ▼
    [Job not marked complete]
    Job still in ACTIVE state
                │
                ▼
    BullMQ timeout triggers (default: 30s)
                │
                ▼
    Job moved to FAILED state
                │
                ▼
    Retry logic (exponential backoff):
    - Attempt 1: Fail
    - Wait 2s
    - Attempt 2: Fail (another worker picks it up)
    - Wait 4s
    - Attempt 3: Fail
    - Wait 8s
                │
                ▼
    After 3 attempts, moved to Dead Letter Queue (DLQ)
                │
                ▼
    Manually inspect DLQ for debugging

    Submission stays in QUEUED/RUNNING status
    Frontend keeps polling...

    Manual intervention required to resume or mark as failed
```

### Case 2: Compilation Failure

```
Job processing starts
                │
                ▼
    Compile command fails
    e.g., syntax error in C++
                │
                ▼
    ExecutionResult created:
    {
      verdict: COMPILE_ERROR,
      compileOutput: "main.cpp:5: error: ...",
      wallTimeMs: 234,
      memoryKb: 0
    }
                │
                ▼
    ExecutionJob marked: status = COMPILE_ERROR
                │
                ▼
    Orchestrator processes submission next tick
                │
                ▼
    Verdict priority: COMPILE_ERROR found
    Submission.status = COMPILE_ERROR
                │
                ▼
    Frontend shows: "✗ Compilation failed"
    With compile error message
```

### Case 3: Database Connection Lost

```
API attempting to create submission
                │
                ▼
    Prisma throws PrismaClientInitializationError
                │
                ▼
    Error handler catches exception
                │
                ▼
    Response: 500 Internal Server Error
    Frontend retries OR shows error to user
                │
                ▼
    Logs event:
    {
      event: 'api.error',
      error: 'Database connection failed',
      timestamp: ISO
    }
```

---

## 7. Performance Flow: Request Latency Timeline

### End-to-End Timeline Example

```
T=0ms:     Browser initiates POST /submissions

T=1ms:     API validates payload (Zod)

T=5ms:     API queries problem by slug

T=7ms:     API queries language

T=8ms:     API queries 5 testcases

T=10ms:    API creates Submission record

T=11-15ms: API creates 5 ExecutionJob records
           (batched or sequential)

T=16ms:    API enqueues 5 jobs to Redis

T=17ms:    API returns response to frontend
           Browser receives: { id: 'sub-123', status: 'QUEUED' }
           ▲ Total latency: ~17ms ✓

T=18ms:    Job-1 dequeued by worker

T=20ms:    Job-1 marked RUNNING in DB

T=23ms:    Source code written to disk

T=25-120ms: Compilation (C++)

T=125ms:   Execution with test input

T=140ms:   Job-1 complete, result stored

T=145-240ms: Remaining jobs (Job-2-5) processed in parallel

T=245ms:   All 5 jobs complete

T=246ms:   (Next orchestrator tick = 1000ms cycle)
           Orchestrator queries and aggregates
           Submiss status: QUEUED → RUNNING → ACCEPTED

T=550ms:   Frontend polls (2nd poll)
           Gets updated status: RUNNING (2/5 passed)

T=1000ms:  Frontend polls (3rd poll)
           Gets final: ACCEPTED (5/5 passed)
```

---

## Summary of Flows

| Flow                      | Duration    | Key Components                 |
| ------------------------- | ----------- | ------------------------------ |
| **Submission Creation**   | 17ms        | API → DB + Queue               |
| **Single Job Processing** | 45-120ms    | Worker → Compile → Execute     |
| **Full Pipeline**         | 250-500ms   | Submit → Worker → Aggregate    |
| **Frontend Feedback**     | 500-1000ms  | Initial poll shows progress    |
| **Final Result**          | 1000-2000ms | After orchestrator tick + poll |

**Critical Path**:

1. Submit code (17ms)
2. Jobs enter queue (immediate)
3. Worker dequeues and processes (100-300ms per job)
4. Orchestrator aggregates (every 1s tick)
5. Frontend polls and displays (every 500ms)
