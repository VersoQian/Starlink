import type { BenchmarkCase, BenchmarkRun } from '../types.js'
import { releaseHandoffLogger } from '../../infrastructure/handoff-log/index.js'
import { BusinessLangGraphService } from '../../services/business-langgraph.js'
import { ToolRegistry } from '../../tool-registry/registry.js'
import { loadAllTools } from '../../tool-registry/loader.js'
import { setToolRegistryForAgents } from '../../agents/shared/register-helpers.js'
import { loadYamlAgents } from '../../agents/index.js'
import { computePerAgentContribution } from '../eval/per-agent-contribution.js'

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

export async function runStarlink(c: BenchmarkCase): Promise<BenchmarkRun> {
  const startedAt = new Date()
  const t0 = Date.now()
  const traceId = `bench-${c.case_id}-${t0}`

  process.env.ORCHESTRATION_MODE = 'registry'
  process.env.HITL_ENABLED = 'false'

  await ensureBenchmarkBootstrapped()

  const service = new BusinessLangGraphService()
  const bmcNodes: unknown[] = []
  let err: string | undefined

  try {
    const stream = service.streamConversation({
      workspaceId: `bench-${c.case_id}`,
      userId: 'benchmark-runner',
      question: c.input.question,
      traceId,
      knowledgeEvidence: (c.input.workspace_knowledge ?? []).map((k) => ({
        docId: k.doc_id,
        snippet: k.content,
        score: 1
      })) as Parameters<typeof service.streamConversation>[0]['knowledgeEvidence']
    })

    for await (const update of stream) {
      if (update.type === 'delta' && update.delta.nodes) {
        for (const n of update.delta.nodes) {
          // GraphBuilder.addMacraNode produces canvas nodes with macraType
          // and domain stuffed inside data.meta — the original CC-BMC card
          // shape lives one level deeper than the canvas wrapper.
          const meta = (n as { data?: { meta?: { macraType?: string; domain?: string } } })
            ?.data?.meta
          if (!meta) continue
          if (meta.macraType === 'cc-bmc-card' || (meta.macraType && meta.domain)) {
            bmcNodes.push({
              ...n,
              // Project a flat shape the metrics expect ({ domain, content, ... }).
              domain: meta.domain,
              content: ((n as { data?: { content?: string } }).data?.content) ?? ''
            })
          }
        }
      }
      if (update.type === 'status' && update.status === 'failed') {
        err = update.message ?? 'unknown failure'
      }
    }
  } catch (e) {
    err = (e as Error).message
  }

  const handoffs = releaseHandoffLogger(traceId)
  const perAgentContribution = computePerAgentContribution(handoffs)
  const endedAt = new Date()

  return {
    case_id: c.case_id,
    runner: 'starlink',
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: Date.now() - t0,
    output: {
      bmc_nodes: bmcNodes,
      handoff_count: handoffs.length,
      per_agent_contribution: perAgentContribution
    },
    error: err
  }
}
