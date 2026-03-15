# GraphQL Gateway

Express + Apollo GraphQL gateway for workspace/canvas/conversation.

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Setup

```bash
pnpm install
pnpm --filter @starlink/server dev
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm --filter @starlink/server dev` | Start gateway |
| `pnpm --filter @starlink/server build` | Compile TypeScript |
| `pnpm --filter @starlink/server start` | Run compiled server |
| `pnpm --filter @starlink/server lint` | Type check |

## Environment Variables

Create `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/kb_dev?schema=public"
PORT=4000
INTERNAL_SERVICE_TOKEN="change-me"
KB_TASK_SERVICE_URL="http://localhost:4001"
```

## API Summary

- `POST /graphql` — queries/mutations
- `WS /graphql` — subscription stream
- `POST /internal/task-events` — internal KB task event ingestion (token protected)
- `POST /kb/:kbId/import/file` — proxy multipart file upload to task service

The gateway keeps task status projections in memory and exposes:
- `kbTaskStatus(workspaceId: ID!, kbId: ID!)`
- `knowledgeBases(workspaceId: ID!)`
- `createKnowledgeBase(workspaceId: ID!)`
- `publishKnowledgeBase(workspaceId: ID!, kbId: ID!)`
- `addKnowledgeSeed(workspaceId: ID!, kbId: ID!, text: String!)`
- `importKnowledgeUrl(workspaceId: ID!, kbId: ID!, url: String!)`
