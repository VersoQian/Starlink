/**
 * Synthesizer (Generator) · Phase 2.5 P1.2.4 · Real LLM-driven subgraph.
 *
 * The legacy rule-based runSynthesizer in business-langgraph.ts is still
 * authoritative for agentAvatars / edges / crossContext. This YAML synthesizer
 * runs as a *parallel LLM perspective*: given the three BMC dimensions, it
 * proposes additional consistency observations + relationship edges between
 * BMC nodes via withStructuredOutput.
 *
 * Subgraph topology:
 *   START → synthesize → END
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

import {
  makeProfileGetter,
  profileToDescriptor,
  registerAgent
} from '../../capabilities/index.js'
import { createLLMModelFor } from '../../services/llm-factory.js'
import {
  type MacraNodeData,
  type BusinessModel
} from '../../services/business-langgraph.js'

// ============== Output schema ==============

export const SynthesizerOutputSchema = z.object({
  insights: z.array(z.string()).default([]),
  suggestedEdges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string()
      })
    )
    .default([])
})

export type SynthesizerOutput = z.infer<typeof SynthesizerOutputSchema>

// ============== State ==============

export const SynthesizerSubgraphState = Annotation.Root({
  traceId: Annotation<string>(),
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  roundNumber: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  marketNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] }),
  productNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] }),
  financeNodes: Annotation<MacraNodeData[]>({ reducer: (_a, b) => b, default: () => [] }),
  insights: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),
  suggestedEdges: Annotation<Array<{ from: string; to: string; label: string }>>({
    reducer: (_a, b) => b,
    default: () => []
  })
})

export type SynthesizerSubgraphStateType = typeof SynthesizerSubgraphState.State

// ============== Profile ==============

const here = dirname(fileURLToPath(import.meta.url))
const getProfile = makeProfileGetter(join(here, 'agent.yaml'))

// ============== Helpers ==============

function summarizeNodesForPrompt(nodes: MacraNodeData[], dimension: string): string {
  if (!nodes.length) return `### ${dimension}\n（无节点）`
  const lines = nodes.map((n) => {
    const dom = n.domain ? `[${n.domain}] ` : ''
    return `- ${n.id} ${dom}${n.label}: ${n.content.slice(0, 120)}`
  })
  return `### ${dimension}\n${lines.join('\n')}`
}

// ============== Nodes ==============

function makeSynthesizeNode(model: BusinessModel | null, systemPrompt: string) {
  return async (
    state: SynthesizerSubgraphStateType
  ): Promise<Partial<SynthesizerSubgraphStateType>> => {
    const totalNodes =
      state.marketNodes.length + state.productNodes.length + state.financeNodes.length
    if (totalNodes === 0 || !model) {
      return { insights: [], suggestedEdges: [] }
    }

    try {
      const structured = model.withStructuredOutput(SynthesizerOutputSchema, {
        name: 'SynthesizerOutput',
        strict: true
      })

      const nodesSummary = [
        summarizeNodesForPrompt(state.marketNodes, 'Market 维度'),
        summarizeNodesForPrompt(state.productNodes, 'Product 维度'),
        summarizeNodesForPrompt(state.financeNodes, 'Finance 维度')
      ].join('\n\n')

      const prompt =
        systemPrompt +
        `\n\n## 三维度 BMC 节点\n${nodesSummary}\n\n` +
        `## 任务\n` +
        `1. 在 \`insights\` 中给出 1-3 条跨维度一致性观察（每条 1-2 句话）\n` +
        `2. 在 \`suggestedEdges\` 中给出 BMC 节点间的关系边，from/to 必须使用上面列出的节点 id，label 为关系标签（≤8 字）\n` +
        `3. 没有发现观察或边时返回空数组，不要编造`

      const response = await structured.invoke([
        new SystemMessage(prompt),
        new HumanMessage(state.question || '请整合以上 BMC 三维度的输出。')
      ])

      return {
        insights: response.insights ?? [],
        suggestedEdges: response.suggestedEdges ?? []
      }
    } catch {
      return { insights: [], suggestedEdges: [] }
    }
  }
}

// ============== Subgraph builder ==============

export function buildSynthesizerSubgraph(
  model: BusinessModel | null,
  systemPrompt: string
) {
  const synthesize = makeSynthesizeNode(model, systemPrompt)
  return new StateGraph(SynthesizerSubgraphState)
    .addNode('synthesize', synthesize)
    .addEdge(START, 'synthesize')
    .addEdge('synthesize', END)
    .compile()
}

// ============== Registration ==============

export const ready: Promise<void> = (async () => {
  const profile = await getProfile()
  const model = createLLMModelFor(profile)
  const compiled = buildSynthesizerSubgraph(model, profile.system_prompt)
  registerAgent(profileToDescriptor(profile, () => compiled))
})()
