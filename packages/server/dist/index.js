// IMPORTANT: OpenTelemetry must initialise BEFORE any module that should be
// auto-instrumented (express, http, pg, graphql, …). Top-level `await` here
// gates the static imports below — ES module spec guarantees the awaited
// promise settles before sibling import bindings are evaluated.
//
// When OTEL_ENABLED is unset/false, initOtel() is a no-op and the OTel SDK
// packages are never imported (lazy `await import` inside otel-init.ts) — so
// dependency cost only kicks in when telemetry is on.
import { initOtel } from './infrastructure/telemetry/otel-init.js';
await initOtel();
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { typeDefs } from './graphql/type-defs.js';
import { resolvers } from './graphql/resolvers.js';
import { createContext, createWsContext, shutdownContextServices } from './context/index.js';
import { internalRouter } from './routes/internal-task-events.js';
import { kbProxyRouter } from './routes/kb-proxy.js';
import { depthLimitPlugin } from './middleware/depth-limit-plugin.js';
import { rateLimitPlugin } from './middleware/rate-limit-plugin.js';
import { telemetryPlugin } from './middleware/telemetry-plugin.js';
import { pool, ensureExtensions, probeDatabaseHealth } from './infrastructure/db/pool.js';
import { describeEmbeddingConfig } from './services/embedding-service.js';
import { assertProductionConfig, isProduction } from './infrastructure/config-validate.js';
const PORT = Number(process.env.PORT ?? 4000);
const STARTED_AT = Date.now();
async function start() {
    // Boot-time production config gate. Fails fast (and crashes the
    // process) in production when any required secret is missing or
    // matches a known placeholder. In dev / test the issues are logged
    // as warnings but boot continues.
    const configIssues = assertProductionConfig();
    if (!isProduction() && configIssues.length > 0) {
        console.warn(`[boot] non-production; ${configIssues.length} config issue(s) would fail in production:`);
        for (const issue of configIssues) {
            console.warn(`  · ${issue.variable}: ${issue.detail}`);
        }
    }
    // Boot-time PG extension install. pgvector + pgcrypto are required
    // for memory vector search and user-skill encryption. Self-healing
    // CREATE EXTENSION IF NOT EXISTS — fresh databases come up clean.
    // Failure is fatal: if extensions can't be installed, memory + KB
    // will silently fail at query time, which is worse than a boot crash.
    try {
        await ensureExtensions();
        console.log('[boot] PG extensions ready (vector / pgcrypto / uuid-ossp)');
    }
    catch (err) {
        console.error('[boot] FATAL · ensureExtensions failed:', err);
        throw err;
    }
    // Boot-time DB health snapshot — lets operators verify in one log line
    // that SSL is on (in production), pgvector is installed, and the
    // connection actually works.
    const dbHealth = await probeDatabaseHealth();
    if (!dbHealth.connected) {
        console.error('[boot] FATAL · database probe failed:', dbHealth.error);
        throw new Error(`database not reachable: ${dbHealth.error ?? 'unknown'}`);
    }
    console.log(`[boot] database connected · ssl=${dbHealth.ssl} · ext={vector:${dbHealth.extensions.vector}, pgcrypto:${dbHealth.extensions.pgcrypto}}`);
    // Boot-time embedding sanity log. Operators need to know at boot whether
    // RAG / memory will use a real embedding endpoint or fall back to the
    // local hash (which yields near-random retrieval quality).
    const embeddingConfig = describeEmbeddingConfig();
    if (embeddingConfig.mode === 'remote') {
        console.log(`[boot] embedding=remote · model=${embeddingConfig.model} · base=${embeddingConfig.baseUrl}`);
    }
    else {
        console.warn(`[boot] embedding=LOCAL-HASH (poor quality) · ${embeddingConfig.warning}`);
    }
    const app = express();
    const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim());
    app.use(cors({ origin: corsOrigins, credentials: false }));
    app.use(helmet());
    app.use(express.json());
    app.use(morgan('dev'));
    // Health endpoints — registered BEFORE GraphQL / auth so load-balancers
    // and orchestrators (Docker / K8s / Fly health checks) can probe without
    // hitting rate limits or auth gates.
    //   /health  — cheap liveness: process is up + event loop responsive.
    //              Always 200 unless the process is dead.
    //   /ready   — readiness: PG reachable. Returns 503 when the DB pool
    //              can't answer SELECT 1 within 2s. Use this for "send
    //              traffic only when DB is ready" gating.
    app.get('/health', (_req, res) => {
        res.status(200).json({
            status: 'ok',
            uptimeSeconds: Math.floor((Date.now() - STARTED_AT) / 1000),
            timestamp: new Date().toISOString()
        });
    });
    app.get('/ready', async (_req, res) => {
        try {
            const probe = pool.query('SELECT 1 AS ok');
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('db-probe-timeout')), 2000));
            await Promise.race([probe, timeout]);
            res.status(200).json({ status: 'ready', db: 'ok' });
        }
        catch (err) {
            res.status(503).json({
                status: 'not-ready',
                db: 'fail',
                error: err instanceof Error ? err.message : String(err)
            });
        }
    });
    // /health/embedding — exposes whether KB / memory vector search is
    // running on a real embedding provider or the deterministic local-hash
    // fallback. Frontend can fetch this on canvas mount and surface a
    // discreet "⚠ 检索质量下降" chip when mode === 'local-hash' so users
    // know their RAG queries aren't returning semantically-relevant chunks.
    app.get('/health/embedding', (_req, res) => {
        const cfg = describeEmbeddingConfig();
        res.status(200).json({
            mode: cfg.mode,
            baseUrl: cfg.baseUrl,
            model: cfg.model,
            warning: cfg.warning,
        });
    });
    // /health/database — exposes connection status, SSL mode, and which
    // PG extensions are installed. Returns 503 if not connected so it
    // can also be used for orchestration probes (k8s readiness etc).
    app.get('/health/database', async (_req, res) => {
        const probe = await probeDatabaseHealth();
        res.status(probe.connected ? 200 : 503).json(probe);
    });
    app.use('/internal', internalRouter);
    app.use('/kb', kbProxyRouter);
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const maxDepth = Number(process.env.GRAPHQL_MAX_DEPTH ?? 10);
    const apollo = new ApolloServer({
        schema,
        plugins: [depthLimitPlugin(maxDepth), rateLimitPlugin(), telemetryPlugin()]
    });
    await apollo.start();
    app.use('/graphql', expressMiddleware(apollo, { context: createContext }));
    const server = http.createServer(app);
    const wsServer = new WebSocketServer({ server, path: '/graphql' });
    useServer({
        schema,
        context: async (ctx) => createWsContext(ctx.connectionParams ?? undefined)
    }, wsServer);
    await new Promise((resolve) => {
        server.listen(PORT, () => {
            console.log(`Branching Chat GraphQL server running on http://localhost:${PORT}/graphql`);
            resolve();
        });
    });
    const shutdown = async (signal) => {
        console.log(`[server] received ${signal}, shutting down`);
        await shutdownContextServices();
        wsServer.close();
        server.close(() => {
            process.exit(0);
        });
    };
    process.once('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.once('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
}
start().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
