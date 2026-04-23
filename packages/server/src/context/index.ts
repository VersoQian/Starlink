import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { ConversationStore } from '../application/conversation-store.js'
import { TaskEventStore } from '../application/task-event-store.js'
import { createConversationEventBus } from '../application/conversation-event-bus.js'
import { createConversationRuntimeRepository } from '../application/conversation-runtime-repository.js'
import { ToolRegistry } from '../tool-registry/registry.js'
import { loadAllTools } from '../tool-registry/loader.js'
import { FlowStore } from '../application/flow-store.js'
import { ExecutionStore } from '../application/execution-store.js'
import { GraphCompiler } from '../engine/graph-compiler.js'
import { GraphExecutor } from '../engine/graph-executor.js'

export type GraphQLContext = {
  conversationStore: ConversationStore
  taskEventStore: TaskEventStore
  userId: string
  toolRegistry?: ToolRegistry
  flowStore?: FlowStore
  executionStore?: ExecutionStore
  graphCompiler?: GraphCompiler
  graphExecutor?: GraphExecutor
}

const conversationEventBus = createConversationEventBus()
const conversationRuntimeRepository = createConversationRuntimeRepository()
const toolRegistry = new ToolRegistry()
const conversationStore = new ConversationStore({
  eventBus: conversationEventBus,
  runtimeRepository: conversationRuntimeRepository,
  toolRegistry
})
const taskEventStore = new TaskEventStore()

// Flow infrastructure (initialized lazily)
const flowStore = new FlowStore()
const executionStore = new ExecutionStore()
const graphCompiler = new GraphCompiler()
const graphExecutor = new GraphExecutor(toolRegistry)

let toolsLoaded = false

async function ensureToolsLoaded(): Promise<void> {
  if (!toolsLoaded) {
    try {
      await loadAllTools(toolRegistry)
    } catch (err) {
      console.warn('[context] Failed to load tools:', err)
    }
    toolsLoaded = true
  }
}

export async function createContext(
  { req }: ExpressContextFunctionArgument
): Promise<GraphQLContext> {
  await ensureToolsLoaded()
  const userId = (req.headers['x-user-id'] as string | undefined) ?? 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    userId,
    toolRegistry,
    flowStore,
    executionStore,
    graphCompiler,
    graphExecutor
  }
}

export async function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext> {
  await ensureToolsLoaded()
  const userId =
    (typeof connectionParams?.['x-user-id'] === 'string' && connectionParams['x-user-id']) || 'anonymous'
  return {
    conversationStore,
    taskEventStore,
    userId,
    toolRegistry,
    flowStore,
    executionStore,
    graphCompiler,
    graphExecutor
  }
}

export function getTaskEventStore() {
  return taskEventStore
}

export function getToolRegistry() {
  return toolRegistry
}

export async function shutdownContextServices() {
  await taskEventStore.close()
  await conversationStore.close()
}
