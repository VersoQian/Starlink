'use client'

import { useMemo, useState } from 'react'
import { Bot, ChevronDown, ChevronUp, Network, Radar, Sparkles } from 'lucide-react'
import type { WorkspaceGraphResponse } from '@/types/graph'
import { buildAgentWorkspaceSnapshot } from '@/features/workspace/lib/agent-runtime'
import {
  type ConversationRuntimeEvent,
  useConversationRuntime
} from '@/features/workspace/hooks'
import { useComfyStore } from '../store'

type AgentRuntimePanelProps = {
  workspaceId: string
}

export function AgentRuntimePanel({ workspaceId }: AgentRuntimePanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mode, setMode] = useState<'current' | 'all'>('current')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const nodes = useComfyStore((state) => state.nodes)
  const edges = useComfyStore((state) => state.edges)
  const openDetailPanel = useComfyStore((state) => state.openDetailPanel)
  const roundNumber = useComfyStore((state) => state.roundNumber)
  const maxRounds = useComfyStore((state) => state.maxRounds)
  const runtime = useConversationRuntime(workspaceId)

  const graph = useMemo<WorkspaceGraphResponse>(() => ({
    workspaceId,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: 'note',
      position: node.position,
      data: node.data as WorkspaceGraphResponse['nodes'][number]['data']
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : undefined
    }))
  }), [edges, nodes, workspaceId])

  const snapshot = useMemo(() => buildAgentWorkspaceSnapshot(graph), [graph])

  const conversations = useMemo(() => {
    const grouped = new Map<string, { id: string; updatedAt: string; latestPhase: string | null }>()

    for (const event of runtime.events) {
      const occurredAt = getEventOccurredAt(event)
      const current = grouped.get(event.conversationId)
      if (!current || occurredAt > current.updatedAt) {
        grouped.set(event.conversationId, {
          id: event.conversationId,
          updatedAt: occurredAt,
          latestPhase: event.type === 'phase.changed' ? event.payload.phase : current?.latestPhase ?? null
        })
      } else if (event.type === 'phase.changed') {
        current.latestPhase = event.payload.phase
      }
    }

    return [...grouped.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [runtime.events])

  const activeConversationId = useMemo(() => {
    if (mode === 'all') return null
    if (selectedConversationId && conversations.some((item) => item.id === selectedConversationId)) {
      return selectedConversationId
    }
    return runtime.latestConversationId ?? conversations[0]?.id ?? null
  }, [conversations, mode, runtime.latestConversationId, selectedConversationId])

  const filteredEvents = useMemo(
    () => runtime.events.filter((event) => !activeConversationId || event.conversationId === activeConversationId),
    [activeConversationId, runtime.events]
  )

  const filteredTurns = useMemo(
    () => filteredEvents.filter((event): event is Extract<ConversationRuntimeEvent, { type: 'seminar.turn.completed' }> => event.type === 'seminar.turn.completed'),
    [filteredEvents]
  )

  const filteredPhase = useMemo(() => {
    const phases = filteredEvents.filter((event): event is Extract<ConversationRuntimeEvent, { type: 'phase.changed' }> => event.type === 'phase.changed')
    return phases[phases.length - 1]?.payload.phase ?? null
  }, [filteredEvents])

  const filteredDecision = useMemo(() => {
    const decisions = filteredEvents.filter((event): event is Extract<ConversationRuntimeEvent, { type: 'seminar.decision.made' }> => event.type === 'seminar.decision.made')
    return decisions[decisions.length - 1]?.payload.decision ?? null
  }, [filteredEvents])

  const sessionAgentViews = useMemo(() => {
    const turnsByAgent = new Map<string, typeof filteredTurns>()
    for (const turn of filteredTurns) {
      const current = turnsByAgent.get(turn.payload.agentId) ?? []
      current.push(turn)
      turnsByAgent.set(turn.payload.agentId, current)
    }

    const activeAgentIds = new Set(filteredTurns.map((turn) => turn.payload.agentId))

    return snapshot.agents.map((agent) => {
      const agentTurns = turnsByAgent.get(agent.id) ?? []
      const sessionStageCounts = {
        planning: 0,
        execution: 0,
        review: 0,
        decision: 0
      }

      for (const turn of agentTurns) {
        sessionStageCounts[turn.payload.phase] += 1
      }

      const latestTurn = agentTurns[agentTurns.length - 1] ?? null
      const latestContribution = latestTurn
        ? agent.contributions.find((item) => item.nodeId === latestTurn.payload.nodeId) ?? agent.latestContribution
        : mode === 'all'
          ? agent.latestContribution
          : null

      const sessionRelatedAgents = mode === 'all'
        ? agent.relatedAgents
        : agent.relatedAgents.filter((item) => activeAgentIds.has(item.agentId))

      const sessionContributionCount = mode === 'all'
        ? agent.contributions.length
        : agentTurns.length

      return {
        ...agent,
        sessionContributionCount,
        sessionLatestContribution: latestContribution,
        sessionRelatedAgents,
        sessionStageCounts
      }
    })
  }, [filteredTurns, mode, snapshot.agents])

  const filteredLinkCount = useMemo(() => {
    if (mode === 'all') return snapshot.linkedAgentPairs
    const pairs = new Set<string>()
    for (const agent of sessionAgentViews) {
      for (const related of agent.sessionRelatedAgents) {
        pairs.add([agent.id, related.agentId].sort().join('::'))
      }
    }
    return pairs.size
  }, [mode, sessionAgentViews, snapshot.linkedAgentPairs])

  const timelineItems = useMemo(() => {
    return filteredEvents
      .map((event) => {
        if (event.type === 'phase.changed') {
          return {
            key: `${event.type}:${event.payload.occurredAt}`,
            label: `阶段切换为 ${event.payload.phase}`,
            detail: event.payload.reason ?? 'system',
            occurredAt: event.payload.occurredAt
          }
        }

        if (event.type === 'seminar.turn.completed') {
          return {
            key: `${event.type}:${event.payload.nodeId}:${event.payload.occurredAt}`,
            label: `${event.payload.agentName} 完成一轮分析`,
            detail: event.payload.title,
            occurredAt: event.payload.occurredAt
          }
        }

        if (event.type === 'seminar.decision.requested') {
          return {
            key: `${event.type}:${event.payload.occurredAt}`,
            label: '等待决策确认',
            detail: event.payload.decision,
            occurredAt: event.payload.occurredAt
          }
        }

        if (event.type === 'seminar.decision.made') {
          return {
            key: `${event.type}:${event.payload.occurredAt}`,
            label: '形成最终决策',
            detail: event.payload.decision,
            occurredAt: event.payload.occurredAt
          }
        }

        return null
      })
      .filter((item): item is { key: string; label: string; detail: string; occurredAt: string } => item !== null)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  }, [filteredEvents])

  if (snapshot.agents.length === 0) {
    return null
  }

  const runtimePhaseText = filteredPhase
    ? `当前阶段 ${filteredPhase}`
    : runtime.isLoading
      ? '恢复运行历史…'
      : '等待运行事件'

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white title-font">Agent Runtime</h4>
            <p className="mt-0.5 text-[11px] text-slate-400">{runtimePhaseText}</p>
          </div>
        </div>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Agents</p>
              <p className="mt-1 font-semibold text-white">{snapshot.agents.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Links</p>
              <p className="mt-1 font-semibold text-white">{filteredLinkCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Turns</p>
              <p className="mt-1 font-semibold text-white">{filteredTurns.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Round</p>
              <p className="mt-1 font-semibold text-white">{roundNumber}/{maxRounds}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-slate-950/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Session Scope</p>
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode('current')}
                  className={`rounded-full px-2.5 py-1 transition ${mode === 'current' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  当前会话
                </button>
                <button
                  type="button"
                  onClick={() => setMode('all')}
                  className={`rounded-full px-2.5 py-1 transition ${mode === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  全部历史
                </button>
              </div>
            </div>

            {mode === 'current' && conversations.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {conversations.slice(0, 4).map((conversation) => {
                  const isActive = activeConversationId === conversation.id
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        isActive
                          ? 'border-cyan-400/50 bg-cyan-400/15 text-white'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {conversation.id.slice(0, 8)} · {conversation.latestPhase ?? 'pending'}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
              <span>
                {mode === 'all'
                  ? `覆盖 ${conversations.length} 次会话`
                  : activeConversationId
                    ? `会话 ${activeConversationId.slice(0, 8)}`
                    : '尚无会话记录'}
              </span>
              {filteredDecision && (
                <span className="max-w-[14rem] truncate text-slate-300">决策: {filteredDecision}</span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Timeline</p>
              <span className="text-[11px] text-slate-500">{timelineItems.length} steps</span>
            </div>

            <div className="mt-3 space-y-2">
              {timelineItems.length > 0 ? (
                timelineItems.slice(-6).map((item, index) => (
                  <div key={item.key} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] font-semibold text-cyan-200">
                        {index + 1}
                      </span>
                      {index < timelineItems.slice(-6).length - 1 && (
                        <span className="mt-1 h-5 w-px bg-white/10" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">{item.label}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-400">{item.detail}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-[11px] text-slate-500">
                  当前范围内还没有可回放的运行步骤。
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {sessionAgentViews.map((agent) => {
              const liveTurns = agent.sessionContributionCount
              return (
                <div key={agent.id} className="rounded-2xl border border-white/10 bg-slate-950/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{agent.name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{agent.role}</p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                      style={{ backgroundColor: agent.accent }}
                    >
                      {agent.sessionContributionCount} 条
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full border border-white/10 px-2 py-1">
                      主域 {agent.primaryDomain ?? '未标注'}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1">
                      实时回合 {liveTurns}
                    </span>
                    <span className="rounded-full border border-white/10 px-2 py-1">
                      协作 {agent.sessionRelatedAgents.length}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Radar className="h-3.5 w-3.5 text-cyan-300" />
                        <span>阶段分布</span>
                      </div>
                      <p className="mt-1 text-slate-300">
                        规 {agent.sessionStageCounts.planning} · 执 {agent.sessionStageCounts.execution} · 质 {agent.sessionStageCounts.review} · 决 {agent.sessionStageCounts.decision}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Network className="h-3.5 w-3.5 text-emerald-300" />
                        <span>协作对象</span>
                      </div>
                      <p className="mt-1 text-slate-300">
                        {agent.sessionRelatedAgents.length > 0
                          ? agent.sessionRelatedAgents.slice(0, 2).map((item) => item.agentName).join(' · ')
                          : '暂无'}
                      </p>
                    </div>
                  </div>

                  {agent.sessionLatestContribution && (
                    <button
                      type="button"
                      onClick={() => openDetailPanel(agent.sessionLatestContribution!.nodeId)}
                      className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:bg-white/10"
                    >
                      <div>
                        <p className="text-[11px] text-slate-500">最新产出</p>
                        <p className="mt-1 text-sm text-white">{agent.sessionLatestContribution.title}</p>
                      </div>
                      <Sparkles className="h-4 w-4 text-amber-300" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

function getEventOccurredAt(event: ConversationRuntimeEvent) {
  return event.payload.occurredAt
}
