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
import { createContext, createWsContext } from './context/index.js';
const PORT = Number(process.env.PORT ?? 4000);
async function start() {
    const app = express();
    app.use(cors({ origin: ['http://localhost:3000'], credentials: false }));
    app.use(helmet());
    app.use(express.json());
    app.use(morgan('dev'));
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
}
start().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
});
