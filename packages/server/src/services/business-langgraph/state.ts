/**
 * LangGraph state definition + supporting types/schemas for the
 * business-langgraph orchestrator.
 *
 * Extracted from business-langgraph.ts (Stage 4d cleanup, 2026-05-04).
 * Includes the BusinessState Annotation root, MacraNodeData schema, intent
 * classification schema, supervisor directive shape, cross-agent context,
 * stream-update union, and the seeded-state helpers used to bootstrap a
 * graph from an existing canvas.
 *
 * Pure data — no I/O, no logging, no class. Importable from anywhere
 * without dragging the orchestrator into the dependency graph.
 */

import { z } from 'zod'
import { Annotation } from '@langchain/langgraph'
import type {
  CanvasEdge,
  CanvasGraph,
  CanvasNode,
  KnowledgeEvidence
} from '@starlink/shared'
import type { Handoff } from '../../infrastructure/handoff-log/index.js'
import type { RoutingDecision } from '../routing-schema.js'
import { CC_BMC_DOMAINS, AGENT_TYPES } from './constants.js'

// ============== MacraNodeData Schema（用于验证 LLM 输出） ==============
export const MacraNodeDataSchema = z.object({
  id: z.string(),
  type: z.enum(['cc-bmc-card', 'agent-avatar', 'insight-note', 'conflict-alert', 'data-source', 'report-card']),
  label: z.string().max(50),
  content: z.string(),
  domain: z.enum(Object.values(CC_BMC_DOMAINS) as [string, ...string[]]).optional(),
  metadata: z.object({
    agent_signature: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
    confidence: z.enum(['high', 'medium', 'low']).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    stage: z.enum(['planning', 'execution', 'review', 'decision']).optional()
  }).passthrough(),
  agentType: z.enum(Object.values(AGENT_TYPES) as [string, ...string[]]).optional(),
  isInteractive: z.boolean().optional(),
  severity: z.enum(['high', 'medium', 'low']).optional(),
  conflictType: z.enum(['resource-goal', 'compliance-business', 'channel-product', 'other']).optional()
})

export type MacraNodeData = z.infer<typeof MacraNodeDataSchema>

// ============== Intent 分类 ==============
export const IntentSchema = z.object({
  intent: z.enum(['generate_bmc', 'analyze', 'detect_conflicts', 'general', 'deep_research']),
  reasoning: z.string()
})

export type Intent = z.infer<typeof IntentSchema>

// ============== Supervisor Directive ==============
export type SupervisorDirective = {
  activeAgents: string[]       // 本轮需要执行的 Agent 节点名称（legacy 格式）
  guidance: string             // 给 Agent 的修正指导
  conflictSummary: string      // 上一轮的冲突摘要
  /** Phase C+: structured routing decisions from runSupervisorRegistry. */
  decisions?: RoutingDecision[]
}

// ============== Cross Context（Agent 间共享上下文） ==============
export type CrossContext = {
  marketSummary: string
  productSummary: string
  financeSummary: string
  consistencyNotes: string     // Synthesizer 的一致性报告（详细版）
  /**
   * Phase 2.6 · synthesizer TL;DR — 1-3 句的核心结论，渲染成"核心结论"卡片
   * 在 BMC 9 卡前/旁边显示，避免用户被详细分析淹没。`consistencyNotes`
   * 仍承载完整的跨维度推理、风险、一致性详情。
   */
  consistencySummary: string
}

export const EMPTY_CROSS_CONTEXT: CrossContext = {
  marketSummary: '',
  productSummary: '',
  financeSummary: '',
  consistencyNotes: '',
  consistencySummary: ''
}

// ============== Conflict with related agents ==============
export type CriticConflict = MacraNodeData & {
  relatedAgents?: string[]     // 需要修正的 Agent 类型
}

// ============== Seeded business state ==============
export type SeededBusinessState = {
  marketNodes: MacraNodeData[]
  productNodes: MacraNodeData[]
  financeNodes: MacraNodeData[]
  agentAvatars: MacraNodeData[]
  conflicts: CriticConflict[]
  edges: CanvasEdge[]
}

export const EMPTY_SEEDED_STATE: SeededBusinessState = {
  marketNodes: [],
  productNodes: [],
  financeNodes: [],
  agentAvatars: [],
  conflicts: [],
  edges: []
}

// ============== LangGraph State ==============
export const BusinessState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  contextPrompt: Annotation<string>(),
  intent: Annotation<Intent | null>(),
  roundNumber: Annotation<number>(),
  supervisorDirective: Annotation<SupervisorDirective | null>(),
  crossContext: Annotation<CrossContext>(),
  knowledgeEvidence: Annotation<KnowledgeEvidence[]>(),
  generalNodes: Annotation<MacraNodeData[]>(),
  marketNodes: Annotation<MacraNodeData[]>(),
  productNodes: Annotation<MacraNodeData[]>(),
  financeNodes: Annotation<MacraNodeData[]>(),
  agentAvatars: Annotation<MacraNodeData[]>(),
  conflicts: Annotation<CriticConflict[]>(),
  edges: Annotation<CanvasEdge[]>()
})

export type BusinessStateType = typeof BusinessState.State

// ============== Stream Update 类型 ==============
export type GraphDelta = {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
  removedNodeIds?: string[]
  removedEdgeIds?: string[]
}

export type BusinessStreamUpdate =
  | { type: 'init'; graph: CanvasGraph; knowledgeEvidence?: KnowledgeEvidence[] }
  | { type: 'delta'; delta: GraphDelta }
  | { type: 'status'; status: 'completed' | 'failed'; message?: string }
  | { type: 'interrupt'; decision: string; conflicts: MacraNodeData[] }
  | { type: 'handoff'; handoff: Handoff }
  /**
   * Subgraph progress event — emitted when a registered agent subgraph
   * yields an internal state update (ToolNode invocation, intermediate
   * LLM call, etc) BEFORE the subgraph's final output reaches the parent
   * graph as a node-level update. Only fires when `subgraphs: true` is
   * passed to graph.stream() (Fix #2 of LangGraph hygiene pass).
   *
   * - `ns` is the LangGraph namespace path: each entry is
   *   `<parentNode>:<subgraphCheckpointId>`.
   * - `nodeName` is the subgraph-internal node that produced the update
   *   (e.g. 'call-llm', 'tools', 'parse' for the BMC ReAct subgraph).
   * - `payloadKeys` lists which top-level keys of the subgraph state
   *   were updated; the values themselves are NOT forwarded to keep
   *   the stream payload bounded (full state lives in the subgraph
   *   checkpoint anyway).
   *
   * Frontend can render "market-agent is calling web-search…" by reading
   * `ns[0]` (parent node = 'marketAgent') + `nodeName` ('tools').
   */
  | {
      type: 'subagent-progress'
      ns: string[]
      nodeName: string
      payloadKeys: string[]
    }
