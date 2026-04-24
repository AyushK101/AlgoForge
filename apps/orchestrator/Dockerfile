FROM node:20-slim AS deps
WORKDIR /repo
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY packages/db packages/db
COPY apps/orchestrator apps/orchestrator
RUN pnpm --filter @algoforge/db generate
RUN pnpm --filter @algoforge/orchestrator build

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=build /repo .
USER node
CMD ["apps/orchestrator/node_modules/.bin/tsx", "apps/orchestrator/src/orchestrator.ts"]
