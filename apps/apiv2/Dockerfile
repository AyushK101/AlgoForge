FROM node:22-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache openssl ca-certificates libc6-compat
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/apiv2/package.json apps/apiv2/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY packages packages
COPY apps/apiv2 apps/apiv2
RUN pnpm --filter @algoforge/db generate
RUN pnpm --filter @algoforge/apiv2 build

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
RUN apk add --no-cache openssl ca-certificates libc6-compat
RUN corepack enable
COPY --from=build /repo .
USER node
EXPOSE 4000
CMD ["apps/apiv2/node_modules/.bin/tsx", "apps/apiv2/src/server.ts"]