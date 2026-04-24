# AlgoForge

AlgoForge is a Kubernetes-native online judge platform for running programming problems with isolated execution workers, queue-driven orchestration, and a modern web interface.

## Project Description

AlgoForge is built as a distributed system rather than a single app process. The platform accepts submissions, fan-outs execution jobs per testcase, evaluates verdicts, and serves real-time status to users.

It is designed for:

- Secure, sandboxed code execution
- Horizontal scaling via queue workers
- Service-level observability and health checks
- Local development with Docker or Kubernetes

## Monorepo Structure

- apps/web: Next.js web app for problem solving and admin workflows
- apps/api: Fastify API for problems, submissions, health, and metrics
- apps/worker: Queue consumer that runs compile/execute jobs
- apps/orchestrator: Aggregates job results into final submission verdicts
- packages/db: Prisma schema and database client
- packages/types: Shared request and response types
- packages/judge-protocol: Shared execution and queue contracts
- infra/k8s: Kubernetes manifests and overlays
- infra/docker/runners: Language runner image definitions
- docs: Architecture and agent flow documentation

## How It Works

1. Web sends a submission request to the API.
2. API validates input and stores a submission.
3. API creates execution jobs (one per testcase) and pushes them to Redis/BullMQ.
4. Worker pulls jobs, compiles/runs code, and stores results.
5. Orchestrator aggregates results into final verdict and stats.
6. Web polls submission status and renders progress/output.

## Tech Stack

- Frontend: Next.js 15, React 19
- API: Fastify, Zod, Prometheus metrics
- Data: PostgreSQL with Prisma
- Queue: Redis + BullMQ
- Infra: Docker, Kubernetes (Kustomize), optional gVisor runtime
- Tooling: pnpm workspaces, TypeScript, Vitest, ESLint

## Local Development

### 1. Start dependencies

```bash
docker compose up -d postgres redis minio
```

### 2. Install and prepare database

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm --filter @algoforge/db seed
```

### 3. Run services

```bash
pnpm dev:api
pnpm dev:orchestrator
pnpm dev:worker
pnpm dev:web
```

Open: http://localhost:3000

## Kubernetes (Local)

### Build images

```bash
docker build -t algoforge-api:local -f apps/api/Dockerfile .
docker build -t algoforge-web:local -f apps/web/Dockerfile .
docker build -t algoforge-worker:local -f apps/worker/Dockerfile .
docker build -t algoforge-orchestrator:local -f apps/orchestrator/Dockerfile .
```

### If using minikube, load images into cluster runtime

```bash
minikube image load algoforge-api:local
minikube image load algoforge-web:local
minikube image load algoforge-worker:local
minikube image load algoforge-orchestrator:local
```

### Apply manifests

```bash
kubectl apply -k infra/k8s/overlays/local
```

### Access web

```bash
kubectl port-forward -n algoforge-app svc/web 3000:3000
```

## Core Scripts

- pnpm dev: run web + api in parallel
- pnpm build: build all packages/apps
- pnpm typecheck: typecheck all workspaces
- pnpm lint: lint all workspaces
- pnpm test: run tests in all workspaces

## Security Notes

- Do not commit real secrets; use infra/k8s/base/secrets.example.yaml as a template.
- For stronger runtime isolation, run workers with gVisor-enabled nodes.
- Restrict egress with NetworkPolicy for execution workloads.

## License

Internal project. Add a formal license file if you plan to publish.
