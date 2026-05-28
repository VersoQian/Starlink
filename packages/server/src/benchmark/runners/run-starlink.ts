import type { BenchmarkCase, BenchmarkRun } from '../types.js'
import { releaseHandoffLogger } from '../../infrastructure/handoff-log/index.js'
import { BusinessLangGraphService } from '../../services/business-langgraph.js'
import { ToolRegistry } from '../../tool-registry/registry.js'
import { loadAllTools } from '../../tool-registry/loader.js'
import { setToolRegistryForAgents } from '../../agents/shared/register-helpers.js'
import { loadYamlAgents } from '../../agents/index.js'
import { computePerAgentContribution } from '../eval/per-agent-contribution.js'
import { ablationContext } from '../../services/ablation-context.js'

let benchBootstrapPromise: Promise<void> | undefined

/**
 * Headless boot for benchmark runs.
 *
 * Apollo's createContext does this in production via context/index.ts. The
 * benchmark cannot import context/index.ts because that module eagerly opens
 * PG pools (FlowStore, ExecutionStore, etc) at import time. So we run the
 * standalone subset:
 *
 *   1. Build a fresh ToolRegistry and populate it via loadAllTools.
 *   2. Inject it into agents/shared/register-helpers so agent graph.ts
 *      modules see a populated registry when their `ready` IIFE runs.
 *   3. Then loadYamlAgents — this triggers the per-agent graph.ts modules,
 *      which call resolveLangchainToolsForAgent against the registry.
 */
function ensureBenchmarkBootstrapped(): Promise<void> {
  if (!benchBootstrapPromise) {
    benchBootstrapPromise = (async () => {
      const reg = new ToolRegistry()
      await loadAllTools(reg)
      setToolRegistryForAgents(reg)
      await loadYamlAgents()
    })()
  }
  return benchBootstrapPromise
}

/**
 * P11.18 · Ablation toggles for `eval:yc -- --no-critic / --no-debate /
 * --no-rag` etc. Each flag flips a process-level gate that the
 * BusinessLangGraph subgraph honors at invocation time, so the same
 * runner instance produces ablated outputs without re-bootstrapping.
 *
 * `noRag` is enforced runner-side (empty knowledgeEvidence) since
 * KB injection is by-argument, not env-gated.
 */
export interface StarlinkRunnerOptions {
  /** Skip critic subgraph entirely (returns empty conflicts). */
  noCritic?: boolean
  /** Force-disable debate even if DEBATE_ENABLED=true. */
  noDebate?: boolean
  /** Strip workspace_knowledge before passing to streamConversation. */
  noRag?: boolean
  /** Variant tag stamped on the run (used for ablation reports). */
  variantTag?: string
}

export async function runStarlink(
  c: BenchmarkCase,
  options: StarlinkRunnerOptions = {}
): Promise<BenchmarkRun> {
  const startedAt = new Date()
  const t0 = Date.now()
  const variant = options.variantTag ?? 'full'
  const traceId = `bench-${c.case_id}-${variant}-${t0}`

  process.env.ORCHESTRATION_MODE = 'registry'
  process.env.HITL_ENABLED = 'false'
  // Benchmark runs must be controlled and offline with respect to live
  // workspace state. The YC cases already pass seed KB snippets through
  // `knowledgeEvidence`; allowing agents to call live KB / memory tools makes
  // the ablation depend on Postgres availability and can introduce timeouts.
  process.env.BENCHMARK_DISABLE_LIVE_KB = 'true'
  process.env.BENCHMARK_DISABLE_MEMORY_TOOLS = 'true'
  process.env.BENCHMARK_DISABLE_PERSISTENCE = 'true'
  process.env.BENCHMARK_DISABLE_STREAM_HEARTBEAT = 'true'
  process.env.HANDOFF_LOG_PERSIST = 'false'
  process.env.LANGGRAPH_CHECKPOINTER_ENABLED = 'false'
  process.env.MEMORY_READ_ENABLED = 'false'
  process.env.MEMORY_WRITE_ENABLED = 'false'
  // Per-call ablation gates via AsyncLocalStorage so concurrent runs
  // don't race on shared process.env.
  await ensureBenchmarkBootstrapped()

  const service = new BusinessLangGraphService()
  const bmcNodes: unknown[] = []
  let err: string | undefined

  const knowledgeEvidence = options.noRag
    ? []
    : (c.input.workspace_knowledge ?? []).map((k) => ({
        docId: k.doc_id,
        snippet: k.content,
        score: 1
      }))

  try {
    const streamResult = await ablationContext.run(
      {
        noCritic: options.noCritic === true,
        noDebate: options.noDebate === true
      },
      async () => {
        const localNodes: unknown[] = []
        let localErr: string | undefined
        const gen = service.streamConversation({
          workspaceId: `bench-${c.case_id}-${variant}`,
          userId: 'benchmark-runner',
          question: c.input.question,
          traceId,
          knowledgeEvidence: knowledgeEvidence as Parameters<typeof service.streamConversation>[0]['knowledgeEvidence']
        })
        for await (const update of gen) {
          if (update.type === 'delta' && update.delta.nodes) {
            for (const n of update.delta.nodes) {
              const meta = (n as { data?: { meta?: { macraType?: string; domain?: string } } })
                ?.data?.meta
              if (!meta) continue
              if (meta.macraType === 'cc-bmc-card' || (meta.macraType && meta.domain)) {
                localNodes.push({
                  ...n,
                  domain: meta.domain,
                  content: ((n as { data?: { content?: string } }).data?.content) ?? ''
                })
              }
            }
          }
          if (update.type === 'status' && update.status === 'failed') {
            localErr = update.message ?? 'unknown failure'
          }
        }
        return { bmcNodes: localNodes, err: localErr }
      }
    )
    bmcNodes.push(...streamResult.bmcNodes)
    err = streamResult.err
  } catch (e) {
    err = (e as Error).message
  }

  const handoffs = releaseHandoffLogger(traceId)
  const perAgentContribution = computePerAgentContribution(handoffs)
  const endedAt = new Date()

  return {
    case_id: c.case_id,
    // For ablation runs, embed the variant in the runner field so the
    // judge report can group/compare variants by string match.
    runner: variant === 'full' ? 'starlink' : `starlink-${variant}` as 'starlink',
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: Date.now() - t0,
    output: {
      bmc_nodes: bmcNodes,
      handoff_count: handoffs.length,
      handoffs,
      per_agent_contribution: perAgentContribution
    } as BenchmarkRun['output'] & { handoffs: typeof handoffs },
    error: err
  }
}
