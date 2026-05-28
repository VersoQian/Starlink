# Multi-stage build for @starlink/web.
#
# Build context expected: repo root.
#   docker build -f apps/web/Dockerfile -t starlink-web .

FROM node:22-alpine AS deps

WORKDIR /repo

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

RUN corepack pnpm install --frozen-lockfile --prod=false

FROM deps AS build

WORKDIR /repo

COPY tsconfig.base.json ./
COPY apps/web apps/web
COPY packages/shared packages/shared
COPY packages/ui packages/ui

ARG NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
ENV NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL

RUN corepack pnpm --filter @starlink/shared build \
 && corepack pnpm --filter @starlink/ui build \
 && corepack pnpm --filter @starlink/web build

FROM node:22-alpine AS run

WORKDIR /repo

RUN corepack enable \
 && addgroup -S starlink \
 && adduser -S -G starlink starlink

COPY --from=build /repo ./

USER starlink

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["corepack", "pnpm", "--filter", "@starlink/web", "start"]
