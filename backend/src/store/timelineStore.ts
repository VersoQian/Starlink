import { nanoid } from 'nanoid'
import type { TimelineNode, AnalyzeAgentOutput } from '../langchain/analyzeAgent'

export type TimelineEdge = AnalyzeAgentOutput['edges'][number]

export type IterationRecord = {
  id: string
  tenantId: string
  taskId: string
  userId: string
  version: number
  summary: string
  createdAt: string
  nodes: TimelineNode[]
  edges: TimelineEdge[]
}

const store = new Map<string, IterationRecord[]>()

const buildKey = (tenantId: string, taskId: string) => `${tenantId}::${taskId}`

export function addIteration(record: {
  tenantId: string
  taskId: string
  userId: string
  summary: string
  nodes: TimelineNode[]
  edges: TimelineEdge[]
}): IterationRecord {
  const key = buildKey(record.tenantId, record.taskId)
  const existing = store.get(key) ?? []
  const iteration: IterationRecord = {
    id: nanoid(12),
    tenantId: record.tenantId,
    taskId: record.taskId,
    userId: record.userId,
    version: existing.length + 1,
    summary: record.summary,
    createdAt: new Date().toISOString(),
    nodes: record.nodes,
    edges: record.edges
  }
  store.set(key, [...existing, iteration])
  return iteration
}

export function listIterations(tenantId: string, taskId: string) {
  const key = buildKey(tenantId, taskId)
  return store.get(key) ?? []
}

export function getIteration(tenantId: string, taskId: string, iterationId: string) {
  const key = buildKey(tenantId, taskId)
  return (store.get(key) ?? []).find((item) => item.id === iterationId) ?? null
}

export function clearTimeline(tenantId: string, taskId: string) {
  const key = buildKey(tenantId, taskId)
  store.delete(key)
}
