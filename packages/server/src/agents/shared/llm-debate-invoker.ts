/**
 * Phase 4.1 · Real LLM DebateAgentInvoker (replaces scaffoldDebateInvoker).
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAuditLogger } from '@starlink/shared'
import { LLMClient } from '../../services/llm-client.js'
import { makeProfileGetter } from '../../capabilities/profile-loader.js'
import type { AgentId } from '../../infrastructure/handoff-log/handoff-types.js'
import type {
  DebateAgentInvoker,
  DebateTurn,
  DebateVerdict
} from './debate-orchestrator.js'

const auditLogger = createAuditLogger('packages/server:agents:llm-debate-invoker')

const here = dirname(fileURLToPath(import.meta.url))
const agentsDir = join(here, '..')

const profileGetters = new Map<AgentId, ReturnType<typeof makeProfileGetter>>()

function getProfileFor(agentId: AgentId): ReturnType<typeof makeProfileGetter> {
  let g = profileGetters.get(agentId)
  if (!g) {
    const path = join(agentsDir, agentId, 'agent.yaml')
    g = makeProfileGetter(path)
    profileGetters.set(agentId, g)
  }
  return g
}

function renderPriorTurns(turns: DebateTurn[]): string {
  if (turns.length === 0) return '（这是第一轮）'
  return turns
    .map(
      (t, i) =>
        `轮次 ${t.round}  [${i + 1}]  ${t.speaker} → ${t.addressee}  (${t.kind})\n  ${t.message}${
          t.citations && t.citations.length ? `\n  证据: ${t.citations.join(', ')}` : ''
        }`
    )
    .join('\n\n')
}

function buildTurnPrompt(args: {
  systemPrompt: string
  speaker: AgentId
  addressee: AgentId
  priorTurns: DebateTurn[]
  disputedNodeIds: string[]
  dimension?: string
}): { system: string; user: string } {
  const system =
    args.systemPrompt +
    '\n\n---\n' +
    `当前正处于对抗性辩论（Phase 4.1）：\n` +
    `- 你的角色：${args.speaker}\n` +
    `- 对手：${args.addressee}\n` +
    (args.dimension ? `- 争议维度：${args.dimension}\n` : '') +
    `- 争议节点 IDs：${args.disputedNodeIds.join(', ') || '（无具体节点）'}\n\n` +
    `以往回合：\n${renderPriorTurns(args.priorTurns)}\n\n` +
    `请输出**纯 JSON**（不要 markdown 代码块）：\n` +
    `{\n` +
    `  "kind": "claim" | "rebuttal" | "concession" | "question",\n` +
    `  "target_node_id": "如果针对某个节点，填 id；否则省略",\n` +
    `  "message": "你的陈述（≤200 字）",\n` +
    `  "citations": ["知识库 doc_id 或 URL，若可引用"]\n` +
    `}`

  const user = `请作为 ${args.speaker} 发表本轮发言。`
  return { system, user }
}

function buildVerdictPrompt(args: {
  moderatorPrompt: string
  turns: DebateTurn[]
}): { system: string; user: string } {
  const system =
    args.moderatorPrompt +
    '\n\n---\n' +
    `请根据以下完整辩论记录做出裁决：\n\n${renderPriorTurns(args.turns)}\n\n` +
    `输出**纯 JSON**（不要 markdown 代码块）：\n` +
    `{\n` +
    `  "convergedAfterRounds": ${Math.ceil(args.turns.length / 2)},\n` +
    `  "outcome": { "kind": "consensus" | "opponent-wins" | "escalate" | "max-rounds-reached" },\n` +
    `  "reasoning": "1-3 句整体评议",\n` +
    `  "nodeOutcomes": [{ "nodeId": "...", "status": "ratified|invalidated|edited|pending" }]\n` +
    `}`

  const user = `请输出裁决 JSON。`
  return { system, user }
}

export class LlmDebateInvoker implements DebateAgentInvoker {
  constructor(private readonly client: LLMClient = new LLMClient()) {}

  async nextTurn(params: {
    speaker: AgentId
    addressee: AgentId
    dimension?: string
    priorTurns: DebateTurn[]
    disputedNodeIds: string[]
  }): Promise<DebateTurn> {
    const round = Math.floor(params.priorTurns.length / 2) + 1
    const buildFallback = (reason: string): DebateTurn => ({
      round,
      speaker: params.speaker,
      addressee: params.addressee,
      kind: params.priorTurns.length === 0 ? 'claim' : 'rebuttal',
      targetNodeId: params.disputedNodeIds[0],
      message: `[fallback:${reason}] ${params.speaker} could not produce turn content`,
      citations: []
    })

    try {
      const profile = await getProfileFor(params.speaker)()
      const { system, user } = buildTurnPrompt({
        systemPrompt: profile.system_prompt,
        speaker: params.speaker,
        addressee: params.addressee,
        priorTurns: params.priorTurns,
        disputedNodeIds: params.disputedNodeIds,
        dimension: params.dimension
      })
      const response = await this.client.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
      const content = response.content ?? ''
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) {
        auditLogger.warn({
          action: 'llm-debate-invoker.nextTurn.no-json',
          metadata: {
            speaker: params.speaker,
            addressee: params.addressee,
            round,
            contentPreview: content.slice(0, 120)
          }
        })
        return buildFallback('no-json')
      }
      const parsed = JSON.parse(match[0]) as {
        kind?: string
        target_node_id?: string
        message?: string
        citations?: string[]
      }
      const kind = (['claim', 'rebuttal', 'concession', 'question'] as const).includes(
        parsed.kind as never
      )
        ? (parsed.kind as DebateTurn['kind'])
        : (params.priorTurns.length === 0 ? 'claim' : 'rebuttal')

      return {
        round,
        speaker: params.speaker,
        addressee: params.addressee,
        kind,
        targetNodeId: parsed.target_node_id ?? params.disputedNodeIds[0],
        message: parsed.message ?? `[fallback:empty-message] ${params.speaker}`,
        citations: Array.isArray(parsed.citations) ? parsed.citations : []
      }
    } catch (error) {
      const reason = error instanceof SyntaxError ? 'parse-error' : 'llm-error'
      auditLogger.warn({
        action: 'llm-debate-invoker.nextTurn.failed',
        metadata: {
          speaker: params.speaker,
          addressee: params.addressee,
          round,
          reason,
          message: error instanceof Error ? error.message : String(error)
        }
      })
      return buildFallback(reason)
    }
  }

  async judge(params: { moderator: AgentId; turns: DebateTurn[] }): Promise<DebateVerdict> {
    const buildFallback = (reason: string): DebateVerdict => ({
      convergedAfterRounds: Math.ceil(params.turns.length / 2),
      outcome: { kind: 'max-rounds-reached', decision: 'partial' },
      reasoning: `[fallback:${reason}] moderator profile load or LLM parse failed`,
      nodeOutcomes: []
    })
    const fallback = buildFallback('unknown')

    try {
      const profile = await getProfileFor(params.moderator)()
      const { system, user } = buildVerdictPrompt({
        moderatorPrompt: profile.system_prompt,
        turns: params.turns
      })
      const response = await this.client.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
      const content = response.content ?? ''
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) {
        auditLogger.warn({
          action: 'llm-debate-invoker.judge.no-json',
          metadata: {
            moderator: params.moderator,
            turnCount: params.turns.length,
            contentPreview: content.slice(0, 120)
          }
        })
        return buildFallback('no-json')
      }
      const parsed = JSON.parse(match[0]) as Partial<DebateVerdict> & {
        outcome?: Record<string, unknown>
      }

      let outcome: DebateVerdict['outcome'] = fallback.outcome
      const rawOutcome = parsed.outcome as { kind?: string } | undefined
      if (rawOutcome?.kind === 'consensus') {
        outcome = {
          kind: 'consensus',
          ratifiedNodes:
            (rawOutcome as { ratifiedNodes?: string[] }).ratifiedNodes ?? []
        }
      } else if (rawOutcome?.kind === 'opponent-wins') {
        outcome = {
          kind: 'opponent-wins',
          invalidatedNodes:
            (rawOutcome as { invalidatedNodes?: string[] }).invalidatedNodes ?? []
        }
      } else if (rawOutcome?.kind === 'escalate') {
        outcome = {
          kind: 'escalate',
          reason: (rawOutcome as { reason?: string }).reason ?? ''
        }
      } else if (rawOutcome?.kind === 'max-rounds-reached') {
        const d = (rawOutcome as { decision?: string }).decision
        outcome = {
          kind: 'max-rounds-reached',
          decision:
            (['accept', 'reject', 'partial'] as const).includes(d as never)
              ? (d as 'accept' | 'reject' | 'partial')
              : 'partial'
        }
      }

      return {
        convergedAfterRounds:
          typeof parsed.convergedAfterRounds === 'number'
            ? parsed.convergedAfterRounds
            : fallback.convergedAfterRounds,
        outcome,
        reasoning: parsed.reasoning ?? fallback.reasoning,
        nodeOutcomes: Array.isArray(parsed.nodeOutcomes) ? parsed.nodeOutcomes : []
      }
    } catch (error) {
      const reason = error instanceof SyntaxError ? 'parse-error' : 'llm-error'
      auditLogger.warn({
        action: 'llm-debate-invoker.judge.failed',
        metadata: {
          moderator: params.moderator,
          turnCount: params.turns.length,
          reason,
          message: error instanceof Error ? error.message : String(error)
        }
      })
      return buildFallback(reason)
    }
  }
}

export const defaultLlmDebateInvoker = new LlmDebateInvoker()
