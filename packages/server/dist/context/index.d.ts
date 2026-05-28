import type { ExpressContextFunctionArgument } from '@apollo/server/express4';
import { ConversationStore } from '../application/conversation-store.js';
import { MemoryCaptureService } from '../application/memory-capture.js';
import { MemoryRetrievalService } from '../application/memory-retrieval.js';
import { MemoryConsolidator } from '../application/memory-consolidator.js';
import { MemoryReaper } from '../application/memory-reaper.js';
import { UserSkillConsolidator } from '../services/user-skill-consolidator.js';
import { TaskEventStore } from '../application/task-event-store.js';
import { ToolRegistry } from '../tool-registry/registry.js';
import { FlowStore } from '../application/flow-store.js';
import { ExecutionStore } from '../application/execution-store.js';
import { GraphCompiler } from '../engine/graph-compiler.js';
import { GraphExecutor } from '../engine/graph-executor.js';
import { UserSkillExtractor } from '../services/user-skill-extractor.js';
import { WizardPrefillService } from '../services/wizard-prefill-service.js';
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
    /** Sprint 1.1 · KB-aware wizard prefill service (prefillWizardFromKb). */
    wizardPrefillService?: WizardPrefillService;
};
export declare const sharedMemoryCaptureService: MemoryCaptureService;
export declare const sharedMemoryRetrievalService: MemoryRetrievalService;
export declare const sharedUserSkillConsolidator: UserSkillConsolidator;
export declare const sharedMemoryConsolidator: MemoryConsolidator;
export declare const sharedMemoryReaper: MemoryReaper;
export declare function createContext({ req }: ExpressContextFunctionArgument): Promise<GraphQLContext>;
export declare function createWsContext(connectionParams?: Record<string, unknown>): Promise<GraphQLContext>;
export declare function getTaskEventStore(): TaskEventStore;
export declare function getToolRegistry(): ToolRegistry;
export declare function shutdownContextServices(): Promise<void>;
