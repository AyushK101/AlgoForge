# AlgoForge Rewrite Architecture

AlgoForge is now structured as a Kubernetes-native online judge with clear service boundaries:

- `apps/web`: Next.js UI only. It talks to the API through `src/lib/api.ts`.
- `apps/api`: Fastify API for problems, submissions, admin operations, health, readiness, and metrics.
- `apps/orchestrator`: Aggregates testcase job results into final submission verdicts.
- `apps/worker`: Consumes Redis/BullMQ execution jobs and runs code.
- `packages/db`: Prisma schema and database client.
- `packages/types`: shared public input/output types.
- `packages/judge-protocol`: queue payloads, execution result contract, and output comparison.
- `infra/k8s`: Kustomize manifests for local Kubernetes.
- `infra/docker/runners`: language runtime image definitions.

## Submission Flow

1. The web app posts `{ problemSlug, languageSlug, sourceCode }` to `POST /submissions`.
2. The API validates the payload, creates a `Submission`, creates one `ExecutionJob` per testcase, and enqueues jobs in Redis.
3. Worker pods consume jobs from BullMQ, compile/run source code, and write `ExecutionResult` rows.
4. The orchestrator periodically aggregates all completed jobs for queued/running submissions.
5. The frontend polls `GET /submissions/:id` to show verdict progress.

## Local Development

Start dependencies:

```bash
docker compose up -d postgres redis minio
```

Install dependencies and prepare the database:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm --filter @algoforge/db seed
```

Run services:

```bash
pnpm dev:api
pnpm dev:orchestrator
pnpm dev:worker
pnpm dev:web
```

Open the web app at `http://localhost:3000`.

## Kubernetes Local

Build local images and load them into Kind/k3d:

```bash
docker build -t algoforge-api:local -f apps/api/Dockerfile .
docker build -t algoforge-web:local -f apps/web/Dockerfile .
docker build -t algoforge-worker:local -f apps/worker/Dockerfile .
docker build -t algoforge-orchestrator:local -f apps/orchestrator/Dockerfile .
```

Apply the local overlay:

```bash
kubectl apply -k infra/k8s/overlays/local
```

For true sandbox validation, use a Linux Kubernetes node with gVisor installed and a `runsc` runtime handler. Kind on Docker Desktop is not enough for hostile-code isolation validation.

## Security Notes

- Rotate credentials that were previously committed in the old Judge0 ConfigMap.
- Keep real secrets out of Git; `secrets.example.yaml` is only a template.
- Worker pods use `runtimeClassName: gvisor`, non-root execution, dropped capabilities, and resource limits.
- NetworkPolicy denies general judge egress and only allows Redis/Postgres access for the current worker design.
- The current worker is local-first. A stronger production path is one Kubernetes Job per execution batch.
