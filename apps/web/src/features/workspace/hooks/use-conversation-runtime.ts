'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  subscribeConversationProgress,
  type ConversationProgressEvent
} from '@/shared/lib/conversation-sync-engine'

type RuntimePhase = 'planning' | 'execution' | 'review' | 'decision'

type PhaseChangedPayload = {
  workspaceId: string
  phase: RuntimePhase
  reason?: string | null
  occurredAt: string
}

type SeminarTurnPayload = {
  workspaceId: string
  phase: RuntimePhase
  agentId: string
  agentName: string
  nodeId: string
  title: string
  summary: string
  occurredAt: string
}

type SeminarDecisionPayload = {
  workspaceId: string
  phase: 'decision'
  decision: string
  occurredAt: string
}

export type ConversationRuntimeEvent =
  | {
      type: 'phase.changed'
      conversationId: string
      payload: PhaseChangedPayload
    }
  | {
      type: 'seminar.turn.completed'
      conversationId: string
      payload: SeminarTurnPayload
    }
  | {
      type: 'seminar.decision.made'
      conversationId: string
      payload: SeminarDecisionPayload
    }

export function useConversationRuntime(workspaceId: string) {
  const [events, setEvents] = useState<ConversationRuntimeEvent[]>([])

  useEffect(() => {
    setEvents([])

    const dispose = subscribeConversationProgress((event: ConversationProgressEvent) => {
      if (event.type === 'phase.changed') {
        const payload = event.payload as PhaseChangedPayload | undefined
        if (!payload || payload.workspaceId !== workspaceId) return
        setEvents((current) => current.concat({
          type: 'phase.changed',
          conversationId: event.conversationId,
          payload
        }))
        return
      }

      if (event.type === 'seminar.turn.completed') {
        const payload = event.payload as SeminarTurnPayload | undefined
        if (!payload || payload.workspaceId !== workspaceId) return
        setEvents((current) => current.concat({
          type: 'seminar.turn.completed',
          conversationId: event.conversationId,
          payload
        }))
        return
      }

      if (event.type === 'seminar.decision.made') {
        const payload = event.payload as SeminarDecisionPayload | undefined
        if (!payload || payload.workspaceId !== workspaceId) return
        setEvents((current) => current.concat({
          type: 'seminar.decision.made',
          conversationId: event.conversationId,
          payload
        }))
      }
    })

    return () => {
      dispose()
    }
  }, [workspaceId])

  const latestPhase = useMemo(() => {
    const phases = events.filter((item): item is Extract<ConversationRuntimeEvent, { type: 'phase.changed' }> => item.type === 'phase.changed')
    return phases[phases.length - 1]?.payload.phase ?? null
  }, [events])

  const seminarTurns = useMemo(
    () => events.filter((item): item is Extract<ConversationRuntimeEvent, { type: 'seminar.turn.completed' }> => item.type === 'seminar.turn.completed'),
    [events]
  )

  const latestDecision = useMemo(() => {
    const decisions = events.filter((item): item is Extract<ConversationRuntimeEvent, { type: 'seminar.decision.made' }> => item.type === 'seminar.decision.made')
    return decisions[decisions.length - 1]?.payload.decision ?? null
  }, [events])

  const latestConversationId = useMemo(
    () => events[events.length - 1]?.conversationId ?? null,
    [events]
  )

  return {
    events,
    latestPhase,
    seminarTurns,
    latestDecision,
    latestConversationId
  }
}
