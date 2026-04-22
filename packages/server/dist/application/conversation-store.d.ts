import type { CanvasEdge, CanvasGraph, WorkspaceMetadataUpdateInput, CanvasNode, CommunityPostInput, ConversationEvent, ConversationMessage, MemoryItem, PracticeSessionInput, WorkspaceDirectoryItem, WorkspaceMetadataHistoryEntry, WorkspaceAsset, WorkspaceContextSnapshot } from '@starlink/shared';
import { BusinessLangGraphService } from '../services/business-langgraph.js';
import type { ConversationEventBus, ConversationEventFilter } from './conversation-event-bus.js';
import type { ConversationRecord, ConversationRuntimeRepository } from './conversation-runtime-repository.js';
import { type AppendMessageInput, type UpsertMemoryInput } from './conversation-memory-store.js';
export type ConversationStoreDeps = {
    eventBus: ConversationEventBus;
    runtimeRepository: ConversationRuntimeRepository;
    businessLangGraphService?: BusinessLangGraphService;
};
export declare class ConversationStore {
    private readonly eventBus;
    private readonly runtimeRepository;
    private readonly sessionStore;
    private readonly graphStore;
    private readonly assetStore;
    private readonly eventStore;
    private readonly memoryStore;
    private readonly contextBuilder;
    private readonly businessLangGraphService;
    private readonly pendingDecisionTimeouts;
    private readonly pendingDecisionResolvers;
    private readonly hitlEnabled;
    private readonly hitlApprovalTimeoutMs;
    constructor({ eventBus, runtimeRepository, businessLangGraphService }: ConversationStoreDeps);
    startConversation(workspaceId: string, userId: string, question: string, kbId?: string): Promise<ConversationRecord>;
    getConversation(id: string, userId?: string): Promise<ConversationRecord | null>;
    listConversationRuntimeEvents(workspaceId: string, userId: string, conversationId?: string): Promise<ConversationEvent[]>;
    listConversationSessions(workspaceId: string, userId: string, limit?: number): Promise<{
        status: "running" | "failed" | "completed" | "archived";
        title: string;
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        latestQuestion: string | null;
        userId: string;
        contextSnapshot: Record<string, unknown>;
        completedAt: string | null;
    }[]>;
    listConversationMessages(workspaceId: string, userId: string, conversationId: string, limit?: number): Promise<ConversationMessage[]>;
    listWorkspaceMemories(workspaceId: string, userId: string, options?: {
        query?: string | null;
        scope?: string | null;
        kind?: string | null;
        limit?: number | null;
    }): Promise<MemoryItem[]>;
    buildWorkspaceContextSnapshot(workspaceId: string, userId: string, query: string, options?: {
        conversationId?: string | null;
        kbId?: string | null;
    }): Promise<WorkspaceContextSnapshot>;
    appendConversationMessage(input: Omit<AppendMessageInput, 'role'> & {
        role: string;
    }, userId: string): Promise<ConversationMessage>;
    createMemoryItem(input: Omit<UpsertMemoryInput, 'scope' | 'kind'> & {
        scope?: string | null;
        kind?: string | null;
    }, userId: string): Promise<MemoryItem>;
    extractConversationMemory(conversationId: string, userId: string): Promise<MemoryItem[]>;
    assertWorkspaceAccess(workspaceId: string, userId: string, requiredPermission: 'workspace.read' | 'workspace.write' | 'workspace.publish' | 'workspace.manage'): Promise<void>;
    assertConversationScope(workspaceId: string, userId: string, conversationId?: string): Promise<void>;
    getGraph(workspaceId: string, userId?: string): Promise<CanvasGraph>;
    listWorkspaces(userId: string): Promise<WorkspaceDirectoryItem[]>;
    listWorkspaceHistory(workspaceId: string, userId: string): Promise<WorkspaceMetadataHistoryEntry[]>;
    updateWorkspace(input: WorkspaceMetadataUpdateInput, userId: string): Promise<WorkspaceDirectoryItem>;
    listWorkspaceAssets(workspaceId: string, userId: string): Promise<WorkspaceAsset[]>;
    saveCommunityPost(input: CommunityPostInput, userId: string): Promise<WorkspaceAsset>;
    savePracticeSession(input: PracticeSessionInput, userId: string): Promise<WorkspaceAsset>;
    addNode(workspaceId: string, userId: string, input: {
        id?: string;
        type: string;
        position: {
            x: number;
            y: number;
        };
        data: unknown;
    }): Promise<CanvasNode>;
    connectNodes(workspaceId: string, userId: string, input: {
        id?: string;
        source: string;
        target: string;
        label?: string | null;
    }): Promise<CanvasEdge>;
    getEventIterator(filter: ConversationEventFilter): AsyncIterable<{
        conversationProgress: ConversationEvent;
    }>;
    close(): Promise<void>;
    approveDecision(conversationId: string, userId: string, decision?: string): Promise<boolean>;
    private runConversationStream;
    private persistConversationCompletion;
    private persistConversationFailure;
    private publishEvent;
    private waitForDecisionApproval;
    private assertPermissionFromMetadata;
    private assertWorkspacePermission;
    private assertConversationBelongsToWorkspace;
    private assertConversationBelongsToWorkspaceOrSession;
}
