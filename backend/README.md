# Knowledge Task Service

Node.js + Express + TypeScript service for KB import/indexing pipeline.

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Setup

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start development server with `ts-node-dev` |
| `npm run build` | Compile TypeScript to `dist` |
| `npm run start` | Run compiled server |
| `npm run test` | Execute Jest unit tests |

## Environment Variables

Create `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/kb_dev?schema=public"
UPLOAD_DIR="./uploads"
PORT=4001
GATEWAY_TASK_EVENT_URL="http://localhost:4000/internal/task-events"
INTERNAL_SERVICE_TOKEN="change-me"
TASK_EVENT_RETRY_COUNT=3
TASK_RUNNER_DELAY_MS=300
TASK_RUNNER_FORCE_FAILURE=false
```

## API Summary

- `GET /kb?workspaceId=:workspaceId` — list workspace-scoped knowledge bases
- `POST /kb` — create knowledge base (`{ workspaceId }`)
- `GET /kb/:id?workspaceId=:workspaceId` — fetch workspace-scoped knowledge base
- `PUT /kb/:id` — update knowledge base fields
- `POST /kb/:id/seed` — add text seed and queue task (`{ workspaceId, text }`)
- `POST /kb/:id/import/file?workspaceId=:workspaceId` — upload files (multipart)
- `POST /kb/:id/import/url` — import from URL (`{ workspaceId, url }`)
- `GET /kb/:id/status?workspaceId=:workspaceId` — aggregated status and tasks
- `POST /kb/:id/publish?workspaceId=:workspaceId` — publish knowledge base
- `GET /usage` — usage counters

The service emits task status events (`created/processing/succeeded/failed`) to gateway via `GATEWAY_TASK_EVENT_URL`.
