import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'

import {
  makeProfileGetter,
  profileToAdvisorDescriptor,
  registerAdvisor,
  type RelevanceScorer
} from '../../capabilities/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const getProfile = makeProfileGetter(join(here, 'agent.yaml'))

interface OpponentRelevantState {
  roundNumber?: number
  conflicts?: Array<{ relatedAgents?: string[]; severity?: string }>
}

const relevanceScorer: RelevanceScorer<OpponentRelevantState> = (state) => {
  if (!state.conflicts) return 0
  const productDisputed = state.conflicts.some(
    (c) =>
      c.severity === 'high' &&
      (c.relatedAgents ?? []).some((a) => a.toLowerCase().includes('product'))
  )
  return productDisputed ? 1 : 0
}

const PassthroughState = Annotation.Root({
  challenges: Annotation<unknown[]>({ reducer: (_a, b) => b, default: () => [] })
})

function buildPassthroughSubgraph() {
  return new StateGraph(PassthroughState)
    .addNode('noop', async () => ({ challenges: [] }))
    .addEdge(START, 'noop')
    .addEdge('noop', END)
    .compile()
}

export const ready: Promise<void> = (async () => {
  const profile = await getProfile()
  registerAdvisor(
    profileToAdvisorDescriptor<OpponentRelevantState>(
      profile,
      () => buildPassthroughSubgraph(),
      relevanceScorer
    )
  )
})()
