import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Annotation, StateGraph, START, END } from '@langchain/langgraph'

import {
  makeProfileGetter,
  profileToDescriptor,
  registerAgent
} from '../../capabilities/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const getProfile = makeProfileGetter(join(here, 'agent.yaml'))

const ModeratorPassthroughState = Annotation.Root({
  _: Annotation<string>({ reducer: (_a, b) => b, default: () => '' })
})

function buildPassthroughSubgraph() {
  return new StateGraph(ModeratorPassthroughState)
    .addNode('noop', async () => ({ _: 'moderator-passthrough' }))
    .addEdge(START, 'noop')
    .addEdge('noop', END)
    .compile()
}

export const ready: Promise<void> = (async () => {
  const profile = await getProfile()
  registerAgent(profileToDescriptor(profile, () => buildPassthroughSubgraph()))
})()
