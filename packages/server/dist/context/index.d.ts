import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { ConversationStore } from '../application/conversation-store.js';
import { TaskEventStore } from '../application/task-event-store.js';
import { ToolRegistry } from '../tool-registry/registry.js';
import { FlowStore } from '../application/flow-store.js';
import { ExecutionStore } from '../application/execution-store.js';
import { GraphCompiler } from '../engine/graph-compiler.js';
import { GraphExecutor } from '../engine/graph-executor.js';
import { UserSkillExtractor } from '../services/user-skill-extractor.js';
export type GraphQLContext = {
    conversationStore: ConversationStore;
    taskEventStore: TaskEventStore;
    userId: string;
    /** From auth middleware: list of workspace IDs the caller may access, or 'all' (admin/dev). */
    allowedWorkspaceIds: string[] | 'all';
    toolRegistry?: ToolRegistry;
    flowStore?: FlowStore;
    executionStore?: ExecutionStore;
    graphCompiler?: GraphCompiler;
    graphExecutor?: GraphExecutor;
    /** P3 · UserSkillExtractor exposed for demand-mode mutation (refreshUserSkills). */
    userSkillExtractor?: UserSkillExtractor;
};
export declare function createContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext>;
export declare function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext>;
export declare function getTaskEventStore(): TaskEventStore;
export declare function getToolRegistry(): ToolRegistry;
export declare function shutdownContextServices(): Promise<void>;
