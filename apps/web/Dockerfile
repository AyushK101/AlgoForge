FROM node:20-slim AS deps
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY packages/types packages/types
COPY apps/web apps/web
RUN pnpm --filter @algoforge/web build

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /repo .
USER node
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
