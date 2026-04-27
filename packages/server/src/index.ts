// IMPORTANT: OpenTelemetry must initialise BEFORE any module that should be
// auto-instrumented (express, http, pg, graphql, …). Top-level `await` here
// gates the static imports below — ES module spec guarantees the awaited
// promise settles before sibling import bindings are evaluated.
//
// When OTEL_ENABLED is unset/false, initOtel() is a no-op and the OTel SDK
// packages are never imported (lazy `await import` inside otel-init.ts) — so
// dependency cost only kicks in when telemetry is on.
import { initOtel } from './infrastructure/telemetry/otel-init.js'
await initOtel()

import http from 'node:http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/use/ws'
import { typeDefs } from './graphql/type-defs.js'
import { resolvers } from './graphql/resolvers.js'
import { createContext, createWsContext, shutdownContextServices } from './context/index.js'
import { internalRouter } from './routes/internal-task-events.js'
import { kbProxyRouter } from './routes/kb-proxy.js'
import { depthLimitPlugin } from './middleware/depth-limit-plugin.js'
import { rateLimitPlugin } from './middleware/rate-limit-plugin.js'
import { telemetryPlugin } from './middleware/telemetry-plugin.js'

const PORT = Number(process.env.PORT ?? 4000)

async function start() {
  const app = express()
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim())
  app.use(cors({ origin: corsOrigins, credentials: false }))
  app.use(helmet())
  app.use(express.json())
  app.use(morgan('dev'))
  app.use('/internal', internalRouter)
  app.use('/kb', kbProxyRouter)

  const schema = makeExecutableSchema({ typeDefs, resolvers })

  const maxDepth = Number(process.env.GRAPHQL_MAX_DEPTH ?? 10)
  const apollo = new ApolloServer({
    schema,
    plugins: [depthLimitPlugin(maxDepth), rateLimitPlugin(), telemetryPlugin()]
  })
  await apollo.start()

  app.use('/graphql', expressMiddleware(apollo, { context: createContext }))

  const server = http.createServer(app)

  const wsServer = new WebSocketServer({ server, path: '/graphql' })
  useServer(
    {
      schema,
      context: async (ctx) => createWsContext(ctx.connectionParams ?? undefined)
    },
    wsServer
  )

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      console.log(`Branching Chat GraphQL server running on http://localhost:${PORT}/graphql`)
      resolve()
    })
  })

  const shutdown = async (signal: string) => {
    console.log(`[server] received ${signal}, shutting down`)
    await shutdownContextServices()
    wsServer.close()
    server.close(() => {
      process.exit(0)
    })
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
