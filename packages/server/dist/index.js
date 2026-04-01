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
const PORT = Number(process.env.PORT ?? 4000);
async function start() {
    const app = express();
    const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim());
    app.use(cors({ origin: corsOrigins, credentials: false }));
    app.use(helmet());
    app.use(express.json());
    app.use(morgan('dev'));
    app.use('/internal', internalRouter);
    app.use('/kb', kbProxyRouter);
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const apollo = new ApolloServer({ schema });
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
