FROM node:20-slim AS deps
WORKDIR /repo
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/judge-protocol/package.json packages/judge-protocol/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @algoforge/db generate
RUN pnpm --filter @algoforge/api build

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY --from=build /repo .
USER node
EXPOSE 4000
CMD ["apps/api/node_modules/.bin/tsx", "apps/api/src/server.ts"]
