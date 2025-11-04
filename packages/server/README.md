# Knowledge Base Backend API

Node.js + Express + TypeScript REST API supporting the knowledge-base builder front-end.

## Prerequisites

- Node.js 18+
- PostgreSQL database

## Setup

```bash
pnpm install
pnpm prisma migrate dev
pnpm dev
```

## Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start development server with `ts-node-dev` |
| `pnpm build` | Compile TypeScript to `dist` |
| `pnpm start` | Run compiled server |
| `pnpm test` | Execute Jest unit tests |

## Environment Variables

Create `.env` based on `.env.example`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/kb_dev?schema=public"
UPLOAD_DIR="./uploads"
PORT=4000
```

## API Summary

- `POST /kb` — create knowledge base
- `GET /kb/:id` — fetch knowledge base
- `PUT /kb/:id` — update knowledge base fields
- `POST /kb/:id/seed` — add text seed and queue task
- `POST /kb/:id/import/file` — upload files (multipart)
- `POST /kb/:id/import/url` — import from URL
- `GET /kb/:id/status` — aggregated status and tasks
- `POST /kb/:id/publish` — publish knowledge base
- `GET /usage` — usage counters

Uploads are stored under `/uploads` (configurable) and served statically.
