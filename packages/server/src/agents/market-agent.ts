import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { createAuditLogger, type KnowledgeEvidence } from '@starlink/shared'
import {
  AGENT_TYPES,
  MARKET_DOMAINS,
  createLLMModel,
  extractAndParseJSON,
  normalizeDomainNodes,
  readModelText,
  type BusinessModel,
  type MacraNodeData
} from '../services/business-langgraph.js'
import { registerAgent, type AgentDescriptor } from '../capabilities/index.js'

/**
 * MarketAgent — v2 subgraph skeleton (Week 1 Day 3-4).
 *
 * Scope of this first cut:
 * - Self-contained LangGraph subgraph (single generate-draft node)
 * - Registers a capability descriptor into agentRegistry at import time
 * - Runs in parallel with the legacy BusinessLangGraphService.runMarketAgent;
 *   the top-level orchestrator is NOT yet wired to this subgraph
 *
 * Deliberately deferred to Day 5:
 * - workspaceContext / crossContext / revisionSuffix prompt builders
 *   (still owned by the legacy service)
 * - citation parsing (applyCitationParsing lives on the class)
 * - Integration with the top-level supervisor graph
 */

const auditLogger = createAuditLogger('packages/server:agents:market-agent')

// ============== Private State（subset of BusinessState）==============

export const MarketAgentState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  roundNumber: Annotation<number>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence[]>(),
  marketNodes: Annotation<MacraNodeData[]>()
})

export type MarketAgentStateType = typeof MarketAgentState.State

// ============== Node: generate-draft ==============

export async function runMarketAgentNode(
  state: MarketAgentStateType,
  model: BusinessModel | null
): Promise<Partial<MarketAgentStateType>> {
  const startedAt = Date.now()

  if (!model) {
    auditLogger.warn({
      action: 'agents.market-agent.skipped',
      requestId: state.traceId,
      workflowId: state.workspaceId,
      userId: state.userId,
      metadata: { reason: 'model-not-configured' }
    })
    return { marketNodes: [] }
  }

  const knowledgeContext = renderKnowledgeContext(state.knowledgeEvidence ?? [])
  const prompt = `你是 Market_Agent（市场分析专家），负责生成 CC-BMC 商业模型画布中的三个维度：

1. **客户细分** (CUSTOMER_SEGMENTS)：目标客户群体、用户画像、市场规模
2. **渠道通路** (CHANNELS)：如何触达客户、线上/线下渠道、分发策略
3. **客户关系** (CUSTOMER_RELATIONSHIPS)：如何维系客户、服务模式、用户粘性

用户问题：${state.question}${knowledgeContext}

请生成 3 个 cc-bmc-card 节点（JSON 数组格式），每个节点包含：
- id: 自动生成
- type: "cc-bmc-card"
- domain: "客户细分" | "渠道通路" | "客户关系"
- label: 简短标题（10 字以内）
- content: 详细分析（Markdown 格式，包含数据、趋势、建议）
- metadata: { agent_signature: "Market_Agent", confidence: "high" | "medium" | "low", source: "数据来源", tags: ["标签"] }
`

  try {
    const response = await model.invoke([
      new SystemMessage(prompt),
      new HumanMessage(state.question)
    ])
    const content = readModelText(response)
    const nodes = extractAndParseJSON(content, 'agents.market-agent')

    if (nodes.length === 0) {
      return { marketNodes: [] }
    }

    const validated = normalizeDomainNodes(nodes, {
      allowedDomains: MARKET_DOMAINS,
      agentType: AGENT_TYPES.MARKET,
      round: state.roundNumber
    })

    auditLogger.info({
      action: 'agents.market-agent.completed',
      requestId: state.traceId,
      workflowId: state.workspaceId,
      userId: state.userId,
      durationMs: Date.now() - startedAt,
      metadata: { round: state.roundNumber, nodeCount: validated.length }
    })

    return { marketNodes: validated }
  } catch (error) {
    auditLogger.error({
      action: 'agents.market-agent.failed',
      requestId: state.traceId,
      workflowId: state.workspaceId,
      userId: state.userId,
      durationMs: Date.now() - startedAt,
      metadata: { error: String(error) },
      error
    })
    return { marketNodes: [] }
  }
}

function renderKnowledgeContext(evidence: KnowledgeEvidence[]): string {
  if (!evidence.length) return ''
  const list = evidence
    .slice(0, 6)
    .map((e, i) => {
      const body = (e as { content?: string; title?: string }).content
        ?? (e as { title?: string }).title
        ?? ''
      return `${i + 1}. ${body}`
    })
    .join('\n')
  return `\n\n参考资料（来自知识库）：\n${list}\n`
}

// ============== Subgraph builder ==============

export function buildMarketAgentSubgraph(model: BusinessModel | null) {
  return new StateGraph(MarketAgentState)
    .addNode('generate-draft', async (state: MarketAgentStateType) =>
      runMarketAgentNode(state, model)
    )
    .addEdge(START, 'generate-draft')
    .addEdge('generate-draft', END)
    .compile()
}

// ============== Descriptor & Registration ==============

export const marketAgentDescriptor: AgentDescriptor = {
  id: 'market-agent',
  name: 'Market Agent',
  role: 'generator',
  capabilities: [
    { kind: 'generate', dimension: 'CUSTOMER_SEGMENTS' },
    { kind: 'generate', dimension: 'CHANNELS' },
    { kind: 'generate', dimension: 'CUSTOMER_RELATIONSHIPS' }
  ],
  runtime: {
    timeout: 30_000,
    retries: 1,
    cacheable: false
  },
  buildSubgraph: () => buildMarketAgentSubgraph(createLLMModel())
}

registerAgent(marketAgentDescriptor)
