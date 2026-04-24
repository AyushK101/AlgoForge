# AlgoForge Agentic Flow

Use these agents as a development workflow. They are not runtime services.

## Agents

- Product/Design Agent: owns screen inventory, workflows, accessibility, and UI acceptance criteria.
- Architecture Agent: owns service boundaries, data model, queue design, and failure modes.
- Security/Sandbox Agent: owns gVisor, runtime images, resource limits, and abuse cases.
- Backend Agent: owns Fastify APIs, Prisma, auth, submissions, and orchestration contracts.
- Frontend Agent: owns Next.js screens, typed API usage, editor UX, and admin forms.
- Infrastructure Agent: owns Dockerfiles, Kustomize, KEDA, local cluster scripts, and CI image builds.
- QA/Test Agent: owns unit, integration, E2E, sandbox smoke, and load scenarios.
- Review Agent: owns final PR review for bugs, security regressions, scalability risks, and missing tests.

## Feature Workflow

1. Planning Agent writes a feature brief with acceptance criteria.
2. Architecture and Security agents review data flow and threat model.
3. Implementation agents work in disjoint areas.
4. QA Agent adds tests and records verification commands.
5. Review Agent checks correctness, operational behavior, and observability before merge.

## PR Checklist

- Public types updated in `packages/types` or `packages/judge-protocol` when contracts change.
- Prisma migrations included for schema changes.
- Tests cover success and failure paths.
- No frontend code imports Prisma or server-only packages.
- No committed secrets.
- Worker changes include sandbox abuse smoke cases.
- K8s changes include resources, probes, and security context.
