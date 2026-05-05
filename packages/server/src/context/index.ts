import type { ExpressContextFunctionArgument } from '@apollo/server/express4'
import { GraphQLError } from 'graphql'
import { ConversationStore } from '../application/conversation-store.js'
import { ConversationMemoryStore } from '../application/conversation-memory-store.js'
import { TaskEventStore } from '../application/task-event-store.js'
import { createConversationEventBus } from '../application/conversation-event-bus.js'
import { createConversationRuntimeRepository } from '../application/conversation-runtime-repository.js'
import { ToolRegistry } from '../tool-registry/registry.js'
import { loadAllTools } from '../tool-registry/loader.js'
import { ensureYamlAgentsLoaded } from '../agents/index.js'
import { setToolRegistryForAgents } from '../agents/shared/register-helpers.js'
import { FlowStore } from '../application/flow-store.js'
import { ExecutionStore } from '../application/execution-store.js'
import { GraphCompiler } from '../engine/graph-compiler.js'
import { GraphExecutor } from '../engine/graph-executor.js'
import { UserSkillExtractor } from '../services/user-skill-extractor.js'
import {
  createWorkspaceMemoryStore,
  setWorkspaceMemoryStore
} from '../infrastructure/memory/workspace-memory-store.js'
import {
  AuthError,
  authenticateConnectionParams,
  authenticateExpress
} from '../middleware/auth.js'

export type GraphQLContext = {
  conversationStore: ConversationStore
  taskEventStore: TaskEventStore
  userId: string
  /** From auth middleware: list of workspace IDs the caller may access, or 'all' (admin/dev). */
  allowedWorkspaceIds: string[] | 'all'
  toolRegistry?: ToolRegistry
  flowStore?: FlowStore
  executionStore?: ExecutionStore
  graphCompiler?: GraphCompiler
  graphExecutor?: GraphExecutor
  /** P3 · UserSkillExtractor exposed for demand-mode mutation (refreshUserSkills). */
  userSkillExtractor?: UserSkillExtractor
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

// Audit C1/C2: bridge the BusinessLangGraph workspace-memory-store to the
// PG-backed ConversationMemoryStore so cross-conversation BMC summaries
// survive restart and are searchable via pgvector. Both stores share the
// same `pool` (infrastructure/db/pool.ts), so constructing a second
// ConversationMemoryStore here is just a thin wrapper — no extra
// connections, no duplicated DDL.
const sharedConversationMemoryStore = new ConversationMemoryStore()
setWorkspaceMemoryStore(
  createWorkspaceMemoryStore({ conversationMemoryStore: sharedConversationMemoryStore })
)

// P3 · Single shared UserSkillExtractor instance (per process). The
// extractor's call counter (Map<userId, count>) is in-memory; a single
// instance keeps cold-start eager mode + throttled mode counters
// consistent across both GraphQL resolvers and the BusinessLangGraph
// fire-and-forget call site.
const sharedUserSkillExtractor = new UserSkillExtractor({
  memoryStore: sharedConversationMemoryStore
})

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
      setToolRegistryForAgents(toolRegistry)
    } catch (err) {
      console.warn('[context] Failed to load tools:', err)
    }
    toolsLoaded = true
  }
}

let yamlAgentsLoaded = false
async function ensureAgentsLoaded(): Promise<void> {
  if (!yamlAgentsLoaded) {
    try {
      await ensureYamlAgentsLoaded()
    } catch (err) {
      console.warn('[context] Failed to load YAML agents:', err)
    }
    yamlAgentsLoaded = true
  }
}

export async function createContext(
  { req }: ExpressContextFunctionArgument
): Promise<GraphQLContext> {
  await ensureToolsLoaded()
  await ensureAgentsLoaded()
  let identity
  try {
    identity = authenticateExpress(req)
  } catch (err) {
    if (err instanceof AuthError) {
      throw new GraphQLError(err.message, {
        extensions: { code: 'UNAUTHENTICATED', http: { status: err.statusCode } }
      })
    }
    throw err
  }
  return {
    conversationStore,
    taskEventStore,
    userId: identity.userId,
    allowedWorkspaceIds: identity.allowedWorkspaceIds,
    toolRegistry,
    flowStore,
    executionStore,
    graphCompiler,
    graphExecutor,
    userSkillExtractor: sharedUserSkillExtractor
  }
}

export async function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext> {
  await ensureToolsLoaded()
  await ensureAgentsLoaded()
  let identity
  try {
    identity = authenticateConnectionParams(connectionParams)
  } catch (err) {
    if (err instanceof AuthError) {
      throw new GraphQLError(err.message, {
        extensions: { code: 'UNAUTHENTICATED' }
      })
    }
    throw err
  }
  return {
    conversationStore,
    taskEventStore,
    userId: identity.userId,
    allowedWorkspaceIds: identity.allowedWorkspaceIds,
    toolRegistry,
    flowStore,
    executionStore,
    graphCompiler,
    graphExecutor,
    userSkillExtractor: sharedUserSkillExtractor
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
