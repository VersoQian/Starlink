import type { CanvasEdge, CanvasGraph, WorkspaceMetadataUpdateInput, CanvasNode, CommunityPostInput, ConversationEvent, PracticeSessionInput, WorkspaceDirectoryItem, WorkspaceMetadataHistoryEntry, WorkspaceAsset } from '@starlink/shared';
import { BusinessLangGraphService } from '../services/business-langgraph.js';
import type { ConversationEventBus, ConversationEventFilter } from './conversation-event-bus.js';
import type { ConversationRecord, ConversationRuntimeRepository } from './conversation-runtime-repository.js';
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
    private readonly businessLangGraphService;
    private readonly pendingDecisionTimeouts;
    private readonly pendingDecisionResolvers;
    private readonly hitlEnabled;
    private readonly hitlApprovalTimeoutMs;
    constructor({ eventBus, runtimeRepository, businessLangGraphService }: ConversationStoreDeps);
    startConversation(workspaceId: string, userId: string, question: string): Promise<ConversationRecord>;
    getConversation(id: string, userId?: string): Promise<ConversationRecord | null>;
    listConversationRuntimeEvents(workspaceId: string, userId: string, conversationId?: string): Promise<ConversationEvent[]>;
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
    private publishEvent;
    private waitForDecisionApproval;
    private assertPermissionFromMetadata;
    private assertWorkspacePermission;
    private assertConversationBelongsToWorkspace;
}
