# AlgoForge - High Level Design (HLD)

## System Overview

AlgoForge is a **Kubernetes-native distributed online judge platform** designed for secure, scalable execution of programming problems. It uses queue-driven orchestration with isolated execution workers to enable horizontal scaling while maintaining security and reliability.

### Key Characteristics

- **Distributed**: Microservices architecture deployed on Kubernetes
- **Queue-based**: Asynchronous job processing via Redis + BullMQ
- **Sandboxed**: Execution isolation using gVisor runtime
- **Scalable**: Horizontal scaling of worker pods based on job queue
- **Observable**: Built-in Prometheus metrics and structured logging

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                        User/Browser                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Web Frontend (Next.js)                    │
│  - Problem listing, UI, Submission form                     │
│  - Real-time status polling                                 │
│  - Admin problem builder                                    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Service (Fastify)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Routes:                                              │  │
│  │ - POST /submissions (create)                         │  │
│  │ - GET /submissions/:id (poll status)                 │  │
│  │ - GET /problems (list)                               │  │
│  │ - GET /health, /metrics                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────┬──────────────────────────────────────┬─────────────────┘
     │                                      │
     │ Create Jobs, Write Results           │ Read/Update Data
     ▼                                      ▼
┌──────────────────────────┐        ┌─────────────────┐
│  Redis/BullMQ Queue      │        │   PostgreSQL    │
│  (judge-queue)           │        │   Database      │
│  ┌────────────────────┐  │        │  ┌───────────┐  │
│  │ Execution Jobs     │  │        │  │ User      │  │
│  │ (per testcase)     │  │        │  │ Problem   │  │
│  └────────────────────┘  │        │  │ Testcase  │  │
└────────┬─────────────────┘        │  │ Submission│  │
         │                          │  │ Job       │  │
         │ Consume Jobs             │  │ Result    │  │
         ▼                          │  └───────────┘  │
    ┌────────────────────────────┐ │                 │
    │   Worker Pods (scaled)     │ │  Update Status  │
    │                            │ │                 │
    │ ┌──────────────────────┐   │ │                 │
    │ │ Job Processor        │───┼─┼────────────────┬┘
    │ │ - Compile code       │   │ │                │
    │ │ - Run testcases      │   │ │                │
    │ │ - Capture output     │   │ │                │
    │ └──────────────────────┘   │ │                │
    │                            │ │                │
    │ Container runtimes:        │ │   Update Results
    │ - gVisor sandbox           │ │                │
    │ - Resource limits          │ │                │
    │ - Non-root execution       │ │                │
    └────────────┬───────────────┘ │                │
                 │                 │                │
                 └─────────────────┼────────────────┘
                                   │
                                   ▼
                         ┌──────────────────┐
                         │  Orchestrator    │
                         │  (Aggregator)    │
                         │                  │
                         │ Every 1s:        │
                         │ - Poll QUEUED/   │
                         │   RUNNING jobs   │
                         │ - Aggregate      │
                         │   results        │
                         │ - Update verdict │
                         └──────────────────┘
```

---

## Service Responsibilities

### 1. **Web Frontend** (`apps/web`)

**Technology**: Next.js 15, React 19, TypeScript
**Responsibilities**:

- Render problem list and problem details
- Accept user code submissions
- Display submission status and results
- Provide admin interface for problem management
- Real-time polling of submission status

**Key APIs Called**:

- `GET /problems` - Fetch problems
- `POST /submissions` - Submit code
- `GET /submissions/:id` - Poll submission status

---

### 2. **API Service** (`apps/api`)

**Technology**: Fastify, Zod validation, Prometheus metrics
**Port**: 3001 (default)
**Responsibilities**:

- **Request Validation**: Validate submissions using Zod schemas
- **Data Persistence**: Create submissions and testcase jobs in PostgreSQL
- **Job Queuing**: Push execution jobs to Redis queue
- **Status Serving**: Return submission status to frontend
- **Observability**: Expose metrics (Prometheus) and health checks
- **Rate Limiting**: 120 requests per minute
- **CORS**: Managed for web origin

**Key Routes**:

```
POST   /submissions              - Create submission
GET    /submissions/:id          - Get submission status
GET    /problems                 - List all problems
GET    /problems/:slug           - Get problem details
POST   /problems                 - Create problem (admin)
PUT    /problems/:id             - Update problem (admin)
GET    /health                   - Readiness check
GET    /metrics                  - Prometheus metrics
```

**Database Interactions**:

- Create `Submission` record with status `QUEUED`
- Create one `ExecutionJob` per testcase
- Update `Submission.status` as jobs complete
- Aggregate results from `ExecutionResult` table

---

### 3. **Worker Service** (`apps/worker`)

**Technology**: Node.js, BullMQ, Docker containers
**Concurrency**: Configurable (default: 1 job per pod)
**Responsibilities**:

- **Job Consumption**: Pull jobs from Redis queue
- **Code Compilation**: Compile source code for target language
- **Test Execution**: Run compiled code against testcases
- **Resource Monitoring**: Track CPU, memory, wall-time
- **Result Storage**: Persist execution results to database
- **Error Handling**: Graceful handling of crashes, timeouts, OOM

**Processing Pipeline**:

1. Dequeue `ExecutionJob` from BullMQ
2. Fetch source code from `Submission`
3. Fetch testcase input from `Testcase`
4. Compile source code (if compiled language)
5. Run executable with testcase input
6. Capture output (stdout, stderr)
7. Compare output with expected output
8. Determine verdict (ACCEPTED, WRONG_ANSWER, etc.)
9. Store `ExecutionResult` in database
10. Update `ExecutionJob.status`

**Language Support**:

- C, C++, Java, Python
- Configurable compile/run commands per language
- Separate Docker images for each language runtime
- Resource limits (CPU, memory) per language

---

### 4. **Orchestrator Service** (`apps/orchestrator`)

**Technology**: Node.js, Prisma
**Polling Interval**: Configurable (default: 1 second)
**Responsibilities**:

- **Aggregation**: Combine individual testcase results into final verdict
- **Status Transitions**: Update submission from QUEUED → RUNNING → FINAL_STATUS
- **Verdict Logic**: Apply priority ordering to determine final verdict
- **Statistics**: Calculate pass count, memory, and time statistics

**Verdict Priority** (highest to lowest):

1. `INTERNAL_ERROR` - System failure
2. `COMPILE_ERROR` - Code doesn't compile
3. `RUNTIME_ERROR` - Crash during execution
4. `TIME_LIMIT_EXCEEDED` - Exceeded CPU time limit
5. `MEMORY_LIMIT_EXCEEDED` - Exceeded memory limit
6. `WRONG_ANSWER` - Output mismatch
7. `ACCEPTED` - All tests passed

**Aggregation Logic**:

- If all jobs have results → compute final verdict
- If any job results remain empty → keep QUEUED/RUNNING
- Final verdict = highest-priority failing verdict (or ACCEPTED if all pass)

---

## Data Model

### Core Entities

```
User
├── id (UUID)
├── email (unique)
├── username
├── role (USER, ADMIN)
└── submissions → [Submission]

Problem
├── id (UUID)
├── slug (unique, indexed)
├── title
├── difficulty (EASY, MEDIUM, HARD)
├── statement (HTML/Markdown)
├── constraints
├── tags []
├── isPublished
├── versions → [ProblemVersion]
├── testcases → [Testcase]
└── submissions → [Submission]

Testcase
├── id (UUID)
├── problemId
├── name (e.g., "sample1", "test2")
├── input
├── expectedOutput
├── isSample (true for sample/visible)
├── weight (for scoring)
└── jobs → [ExecutionJob]

Submission
├── id (UUID)
├── userId
├── problemId
├── languageId
├── sourceCode
├── status (QUEUED, RUNNING, ACCEPTED, etc.)
├── totalTests (testcase count)
├── passedTests
├── maxMemoryKb
├── totalWallTimeMs
└── jobs → [ExecutionJob]

ExecutionJob
├── id (UUID)
├── submissionId
├── testcaseId
├── status (QUEUED, RUNNING, ACCEPTED, etc.)
├── attempts
├── lockedBy (worker ID)
├── lockedAt
└── result → ExecutionResult

ExecutionResult
├── id (UUID)
├── executionJobId (unique)
├── verdict (ACCEPTED, WRONG_ANSWER, etc.)
├── stdout
├── stderr
├── compileOutput
├── exitCode
├── wallTimeMs
├── memoryKb
└── message (error details)

Language
├── id (UUID)
├── slug (c, cpp, java, python)
├── name
├── sourceFile (main.c, etc.)
├── compileCommand []
├── runCommand []
├── defaultCpuMs (2000)
└── defaultMemoryKb (256MB)
```

---

## Technology Stack

| Layer               | Technology                       | Purpose                     |
| ------------------- | -------------------------------- | --------------------------- |
| **Frontend**        | Next.js 15, React 19, TypeScript | Web UI                      |
| **API**             | Fastify, Zod, Node.js            | REST API, validation        |
| **Queue**           | Redis 7.x, BullMQ                | Job distribution            |
| **Database**        | PostgreSQL 15+, Prisma ORM       | Data persistence            |
| **Execution**       | Docker, gVisor, Linux containers | Code execution              |
| **Orchestration**   | Kubernetes, Kustomize            | Container orchestration     |
| **Monitoring**      | Prometheus, structured JSON logs | Observability               |
| **Package Manager** | pnpm                             | Monorepo management         |
| **Language**        | TypeScript                       | Type safety across services |

---

## Deployment Architecture

### Local Development

```
docker-compose.yml
├── PostgreSQL
├── Redis
└── MinIO (S3-compatible storage)

Running Services:
- pnpm dev:api       (port 3001)
- pnpm dev:worker    (process)
- pnpm dev:orchestrator (process)
- pnpm dev:web       (port 3000)
```

### Kubernetes (Production-like)

```
Namespace: algoforge

Deployments:
├── api (1-3 replicas)
│   └── Service: api-service
├── web (1-3 replicas)
│   └── Service: web-service
├── worker (scaled via KEDA)
│   └── Scaled based on queue depth
└── orchestrator (1 replica)

StatefulSets:
├── PostgreSQL (with PVC)
└── Redis (with PVC)

ConfigMaps:
├── database config
├── language runtimes config
└── queue config

Secrets:
├── DATABASE_URL
├── REDIS_URL
└── API credentials

KEDA ScaledObject:
├── Monitors: redis queue depth
├── Min replicas: 1
├── Max replicas: 10
├── Scales workers based on job count
```

---

## Communication Patterns

### Synchronous

- **Frontend → API**: HTTP REST (polling)
- **API → Database**: Prisma ORM
- **Health Checks**: HTTP endpoints

### Asynchronous

- **API → Queue**: Push execution jobs to Redis
- **Queue → Workers**: BullMQ job distribution
- **Workers → Database**: Update results via Prisma
- **Orchestrator → Database**: Periodic aggregation

---

## Security Considerations

### Execution Isolation

- **gVisor Runtime**: Lightweight sandboxing for container escape protection
- **Resource Limits**: CPU and memory limits per language
- **Dropped Capabilities**: Non-root execution, no privileged operations
- **NetworkPolicy**: Workers can only access Redis and PostgreSQL

### Data Security

- Environment variables for credentials (DATABASE_URL, REDIS_URL)
- CORS configuration for frontend origin
- Rate limiting (120 req/min)
- Input validation with Zod schemas
- Role-based access control (USER, ADMIN)

### Secrets Management

- Kubernetes Secrets for production credentials
- `secrets.example.yaml` as template (never commit real secrets)
- Rotate credentials if accidentally exposed

---

## Scalability & Performance

### Horizontal Scaling

- **Workers**: Auto-scale via KEDA based on queue depth
- **API**: Stateless, can scale horizontally
- **Database**: Single PostgreSQL instance (potential bottleneck for massive scale)

### Queue Dynamics

- BullMQ handles job distribution
- Configurable concurrency per worker
- Failed jobs can be retried

### Performance Characteristics

- **Submission Creation**: ~50ms (1 query + N queue pushes)
- **Job Processing**: 100ms - 60s (depends on testcase count and code complexity)
- **Aggregation**: ~100ms (10 submissions at a time)
- **Frontend Poll**: 500ms interval (configurable)

---

## Error Handling & Resilience

| Error Scenario           | Handling                                            |
| ------------------------ | --------------------------------------------------- |
| Worker crash             | BullMQ marks job as failed, retries or moves to DLQ |
| Worker timeout           | Configurable timeout per job type                   |
| Database connection loss | Prisma reconnection logic                           |
| Queue overload           | KEDA auto-scales workers                            |
| Submission incomplete    | Orchestrator waits, keeps polling                   |
| Corrupted result         | Marked as INTERNAL_ERROR                            |

---

## Monitoring & Observability

### Prometheus Metrics

- HTTP request duration (by method, route, status)
- Queue depth (jobs pending)
- Worker processing time
- Database operation latency

### Structured Logging

- JSON logs for all events
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for tracing (future enhancement)

### Health Endpoints

- `GET /health` - API readiness
- Kubernetes liveness/readiness probes
- Queue consumer monitoring

---

## Future Enhancements

1. **Distributed Tracing**: OpenTelemetry for end-to-end request tracing
2. **Advanced Sandboxing**: WebAssembly runtime for code execution
3. **Contest Mode**: Leaderboards, multiple submissions tracking
4. **Code Plagiarism Detection**: Automated submission comparison
5. **Custom Test Cases**: Allow users to submit their own test cases
6. **Collaborative Environment**: Real-time code collaboration
7. **Advanced Metrics**: Per-problem difficulty scoring, user ratings
8. **Microservice Optimization**: Split API into problems/submissions services

---

## Summary

AlgoForge is a **modern, cloud-native judge platform** that:

- ✅ Scales horizontally via Kubernetes and KEDA
- ✅ Provides secure execution via gVisor sandboxing
- ✅ Supports multiple programming languages
- ✅ Uses async queue patterns for high throughput
- ✅ Offers real-time status feedback to users
- ✅ Maintains observability through structured logs and metrics

The architecture is designed for **reliability, security, and scalability** in a production Kubernetes environment.
