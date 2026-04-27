/**
 * OpenTelemetry SDK bootstrap (Wave 3 Agent C).
 *
 * Initialises Node SDK with OTLP/HTTP trace exporter + auto-instrumentations
 * BEFORE Apollo / Express imports run, so HTTP / GraphQL / pg / fetch
 * spans are picked up automatically.
 *
 * Behaviour:
 *   - OTEL_ENABLED=false (default): no SDK is loaded; getTracer() returns a
 *     no-op tracer from the API package (zero perf cost — every span method
 *     short-circuits when no provider is registered). Existing stdout-only
 *     telemetry continues unchanged.
 *   - OTEL_ENABLED=true: NodeSDK starts with BatchSpanProcessor pushing to
 *     OTEL_EXPORTER_OTLP_ENDPOINT (default http://localhost:4318) and registers
 *     SIGTERM/SIGINT shutdown hooks that flush pending spans before exit.
 *
 * Co-exists with LangSmith tracing: LangSmith uses its own callback-based
 * exporter (LANGSMITH_TRACING env), so both can run in parallel — they
 * observe the same call stack but emit to separate backends.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { trace, type Tracer } from '@opentelemetry/api'

let started = false
let sdkRef: { shutdown: () => Promise<void> } | null = null

function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    // dist/infrastructure/telemetry/otel-init.js → ../../../package.json
    const pkgPath = resolve(here, '../../../package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function initOtel(): Promise<void> {
  if (started) return
  if (process.env.OTEL_ENABLED !== 'true') return
  started = true

  // Lazy import — when OTEL_ENABLED=false we never pull these deps into memory.
  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
  const { Resource } = await import('@opentelemetry/resources')
  const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions')

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'starlink-server'
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'
  const traceUrl = endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint.replace(/\/$/, '')}/v1/traces`

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: readPackageVersion(),
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'starlink'
  })

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: traceUrl }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // pg / http / express / graphql come for free; opt out of fs noise.
        '@opentelemetry/instrumentation-fs': { enabled: false }
      })
    ]
  })

  sdk.start()
  sdkRef = sdk

  const shutdown = async (signal: string) => {
    try {
      await sdk.shutdown()
      // eslint-disable-next-line no-console
      console.log(`[otel] flushed spans on ${signal}`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[otel] shutdown failed', err)
    }
  }
  process.once('SIGTERM', () => void shutdown('SIGTERM'))
  process.once('SIGINT', () => void shutdown('SIGINT'))

  // eslint-disable-next-line no-console
  console.log(`[otel] enabled · service=${serviceName} → ${traceUrl}`)
}

/**
 * Returns a tracer for the given module. Always safe to call: when OTel is
 * disabled, the API package returns a no-op tracer whose spans are essentially
 * free (a couple of pointer comparisons per call).
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name)
}

export function isOtelEnabled(): boolean {
  return started
}

/** Test-only — flush + shutdown the SDK. */
export async function shutdownOtel(): Promise<void> {
  if (sdkRef) {
    await sdkRef.shutdown()
    sdkRef = null
    started = false
  }
}
