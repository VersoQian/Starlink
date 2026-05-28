import GraphQLJSON from 'graphql-type-json';
import type { FlowDefinition } from '@starlink/shared';
import type { GraphQLContext } from '../context/index.js';
import type { CanvasNode } from '@starlink/shared';
export declare const resolvers: {
    JSON: any;
    Query: {
        workspaceGraph: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<CanvasGraph>;
        conversation: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            metadata: any;
            graph: CanvasGraph;
            knowledgeEvidence: KnowledgeEvidence[];
            citations: CardCitation[];
        } | null>;
        conversationSessions: (_: unknown, args: {
            workspaceId: string;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<any[]>;
        conversationMessages: (_: unknown, args: {
            workspaceId: string;
            conversationId: string;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<any[]>;
        cardsReferencingEvidence: (_: unknown, args: {
            conversationId: string;
            evidenceId: string;
        }, ctx: GraphQLContext) => Promise<string[]>;
        workspaceMemories: (_: unknown, args: {
            workspaceId: string;
            query?: string | null;
            scope?: string | null;
            kind?: string | null;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<any[]>;
        /**
         * P2 · myMemories — user-scoped memory list. Always filters by
         * ctx.userId (no override possible). Returns rows where:
         *   - user_id = ctx.userId
         *   - archived_at IS NULL
         *   - workspace_id = $args.workspaceId   (when provided)
         *     OR scope='user' AND workspace_id IS NULL  (cross-workspace
         *     personal user-skill rows, when workspaceId omitted)
         *   - kind = $args.kind   (when provided)
         */
        myMemories: (_: unknown, args: {
            workspaceId?: string | null;
            kind?: string | null;
            query?: string | null;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<any[]>;
        /**
         * P2 · myKnowledgeEvidence — reverse-lookup of "AI cited which KB
         * chunks for me, where". Scans memory_items.metadata->>'knowledgeEvidence'
         * JSONB for rows owned by ctx.userId.
         */
        myKnowledgeEvidence: (_: unknown, args: {
            workspaceId?: string | null;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<{
            memoryItemId: string;
            workspaceId: string;
            docId: string;
            snippet: string | null;
            score: number | null;
            citedAt: string;
            sourceTitle: string;
        }[]>;
        /**
         * F6 · Data portability (GDPR Art. 20 / PIPL Art. 45).
         *
         * Rate limit: 1 per 5 minutes per user — exports are expensive
         * (full table scan on memory_items + sessions + messages) and
         * users rarely need to export more than once per session.
         */
        exportMyData: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            schemaVersion: number;
            exportedAt: string;
            userId: string;
            sessions: GraphQLJSON[];
            messages: GraphQLJSON[];
            memoryItems: GraphQLJSON[];
            knowledgeBases: Array<Record<string, unknown>>;
            knowledgeDocuments: Array<Record<string, unknown>>;
        }>;
        workspaceContextSnapshot: (_: unknown, args: {
            workspaceId: string;
            conversationId?: string | null;
            query: string;
            kbId?: string | null;
        }, ctx: GraphQLContext) => Promise<any>;
        /**
         * Runtime event backfill for WS subscription gap-fill.
         *
         * Client-side flow for gap-free delivery across reconnects:
         *   1. Open WS, subscribe to `conversationProgress(workspaceId, conversationId)`.
         *   2. Track the highest 1-based index seen so far (`lastSeenCursor`). The Nth event
         *      received corresponds to cursor N. Persist this in client state.
         *   3. On WS disconnect → reconnect:
         *        a. Re-open subscription (buffer arriving live events client-side).
         *        b. Issue `query conversationRuntimeEvents(workspaceId, conversationId,
         *           sinceCursor: lastSeenCursor)` — returns only events with index > sinceCursor.
         *        c. Merge backfilled events ahead of buffered live ones, dedupe by content
         *           (event-bus is best-effort; duplicates are possible during the handoff window).
         *        d. Resume normal live processing; bump `lastSeenCursor` for each new event.
         *
         * Note: cursor is positional within the workspace event ring buffer (capped by
         *       CONVERSATION_RUNTIME_EVENT_LIMIT, default 400). If a client is offline long
         *       enough for events to roll out of the buffer, sinceCursor=0 is implicitly the
         *       safe-but-lossy fallback. A future extension may switch to monotonic IDs.
         */
        conversationRuntimeEvents: (_: unknown, args: {
            workspaceId: string;
            conversationId?: string | null;
            sinceCursor?: number | null;
        }, ctx: GraphQLContext) => Promise<ConversationEvent[]>;
        kbTaskStatus: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<{
            workspaceId: string;
            taskId: string;
            kbId: string;
            status: GraphQLJSON["status"];
            taskType: GraphQLJSON["payload"]["taskType"];
            error?: string;
            updatedAt: string;
            lastEventId: string;
        }[]>;
        knowledgeBases: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase[]>;
        knowledgeBaseAgentBindings: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").KbAgentBinding[]>;
        knowledgeBaseDocuments: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKbDocument[]>;
        knowledgeBaseStatus: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<{
            knowledgeBase: import("../services/kb-task-service.js").GatewayKnowledgeBase;
            tasks: import("../services/kb-task-service.js").GatewayKbTask[];
        }>;
        /**
         * P12 · single-chunk lookup. The Evidence drawer calls this when
         * the user clicks a [[ref:docId#chunk-N]] citation: it parses N
         * out of the snippetId and asks for that exact chunk's content.
         */
        kbChunkLookup: (_: unknown, args: {
            workspaceId: string;
            docId: string;
            chunkIndex?: number | null;
        }, ctx: GraphQLContext) => Promise<{
            docId: string;
            chunkIndex: number;
            content: string;
            docTitle: string | null;
            kbId: string;
            kbName: string | null;
        } | null>;
        knowledgeBaseSearch: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            query: string;
            topK?: number | null;
        }, ctx: GraphQLContext) => Promise<{
            docId: any;
            snippet: any;
            score: any;
            metadata: any;
        }[]>;
        workspaces: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<any[]>;
        workspaceAssets: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<any[]>;
        workspaceMetadataHistory: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<any[]>;
        availableTools: (_: unknown, __: unknown, ctx: GraphQLContext) => {
            name: any;
            label: any;
            description: any;
            category: any;
            icon: any;
            color: any;
            inputSchema: any;
            outputSchema: any;
            inputPorts: any;
            outputPorts: any;
            runtime: any;
        }[];
        toolByName: (_: unknown, args: {
            name: string;
        }, ctx: GraphQLContext) => {
            name: any;
            label: any;
            description: any;
            category: any;
            icon: any;
            color: any;
            inputSchema: any;
            outputSchema: any;
            inputPorts: any;
            outputPorts: any;
            runtime: any;
        } | null;
        flows: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        }[]>;
        flow: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        } | null>;
        flowTemplates: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        }[]>;
        flowExecution: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            startedAt: string;
            completedAt: string | null;
            nodeStates: import("../application/execution-store.js").NodeStateRecord[];
            id: string;
            flowId: string;
            status: GraphQLJSON;
            inputs: Record<string, unknown>;
            state: Record<string, unknown> | null;
            error: string | null;
        } | null>;
        flowExecutions: (_: unknown, args: {
            flowId: string;
        }, ctx: GraphQLContext) => Promise<{
            startedAt: string;
            completedAt: string | null;
            nodeStates: never[];
            id: string;
            flowId: string;
            status: GraphQLJSON;
            inputs: Record<string, unknown>;
            state: Record<string, unknown> | null;
            error: string | null;
        }[]>;
    };
    /**
     * P11.16 · CanvasGraph.citations field resolver. Aggregates citations
     * from each node's data.meta.citations on every query so workspace
     * reload (close tab → reopen) restores EvidenceDrawer state without
     * needing a separate citations table. Pure derivation — no DB write,
     * no schema migration; just walks the already-persisted nodes.
     */
    CanvasGraph: {
        citations: (parent: {
            nodes?: CanvasNode[];
        }) => CardCitation[];
    };
    Mutation: {
        startConversation: (_: unknown, args: {
            workspaceId: string;
            question: string;
            kbId?: string | null;
            headless?: boolean | null;
        }, ctx: GraphQLContext) => Promise<{
            metadata: any;
            graph: CanvasGraph;
            knowledgeEvidence: KnowledgeEvidence[];
            citations: CardCitation[];
        }>;
        clearWorkspaceCanvas: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
        approveDecision: (_: unknown, args: {
            conversationId: string;
            decision?: string | null;
        }, ctx: GraphQLContext) => Promise<boolean>;
        /**
         * Phase 2.6 · HITL resume.
         *
         * Validates the decision string ([ACCEPTED] / [EDIT_PLAN][<dim>]:<body> /
         * [REJECTED]) and routes through `conversationStore.approveDecision`,
         * which (a) resolves the in-memory awaiter so the streaming `for await`
         * loop continues and (b) dual-writes to the PG HITL store for cross-
         * instance / post-restart visibility.
         *
         * The parsed directive is also picked up by the conversation-store's
         * stream loop (after `waitForDecisionApproval` returns) and forwarded to
         * `BusinessLangGraphService.setHitlResumeDirective`, where the supervisor
         * consumes it on the next revision round to either halt the critic loop
         * or scope revision to a single BMC dimension's owning agent.
         */
        resumeConversation: (_: unknown, args: {
            conversationId: string;
            decision: string;
        }, ctx: GraphQLContext) => Promise<{
            ok: boolean;
            decisionKind: string;
            message?: string;
        }>;
        appendConversationMessage: (_: unknown, args: {
            input: {
                conversationId: string;
                workspaceId: string;
                role: string;
                content: string;
                metadata?: Record<string, unknown> | null;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        /**
         * P3 · refreshUserSkills — demand-mode extraction trigger.
         *
         * Bypasses the usual throttle/tier selection so a user clicking
         * "立即更新画像" in the Memory drawer gets immediate feedback. The
         * extractor's own dedup + confidence-update logic prevents double-
         * counting when this is called repeatedly in quick succession.
         */
        /**
         * Sprint 1.1 · KB-aware wizard pre-read.
         *
         * Authorization: workspace.read (KB visibility filter inside the
         * service respects per-user private/workspace/global rules).
         *
         * Rate-limited 1/30s/user — fan-out search + 1 LLM call costs ~5K
         * tokens; users normally fire once at wizard start.
         */
        prefillWizardFromKb: (_: unknown, args: {
            workspaceId: string;
            kbId?: string | null;
        }, ctx: GraphQLContext) => Promise<import("../services/wizard-prefill-service.js").WizardPrefillResult>;
        refreshUserSkills: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<number>;
        /**
         * P2 · correctMemoryItem — user-driven correction of an inferred
         * memory row. Three actions in priority order:
         *   1. archive=true → soft-delete (sets archived_at)
         *   2. newContent != null → update content; refreshes updatedAt;
         *      stores user-correction marker in metadata so future
         *      extractor passes don't auto-overwrite it
         *   3. feedback != null → append to metadata.userFeedback array
         *      (used as reinforcement signal by user-skill-extractor)
         *
         * Authorization: caller must own the row. Cross-user attempts
         * throw FORBIDDEN.
         */
        correctMemoryItem: (_: unknown, args: {
            input: {
                itemId: string;
                newContent?: string | null;
                archive?: boolean | null;
                feedback?: string | null;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        createMemoryItem: (_: unknown, args: {
            input: {
                workspaceId: string;
                scope?: string | null;
                kind?: string | null;
                title: string;
                content: string;
                sourceType?: string | null;
                sourceId?: string | null;
                importance?: number | null;
                confidence?: number | null;
                tags?: string[] | null;
                metadata?: Record<string, unknown> | null;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        extractConversationMemory: (_: unknown, args: {
            conversationId: string;
        }, ctx: GraphQLContext) => Promise<any[]>;
        addNode: (_: unknown, args: {
            workspaceId: string;
            input: {
                id?: string;
                type: string;
                position: {
                    x: number;
                    y: number;
                };
                data: unknown;
            };
        }, ctx: GraphQLContext) => Promise<CanvasNode>;
        connectNodes: (_: unknown, args: {
            workspaceId: string;
            input: {
                id?: string;
                source: string;
                target: string;
                label?: string | null;
            };
        }, ctx: GraphQLContext) => Promise<CanvasEdge>;
        createKnowledgeBase: (_: unknown, args: {
            workspaceId: string;
            name?: string | null;
            visibility?: string | null;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        publishKnowledgeBase: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        /**
         * F1 · Update a KB's visibility. Only the owner may invoke (enforced
         * inside updateKnowledgeBaseVisibility — throws FORBIDDEN otherwise).
         * Cascades to kb_chunks so vector search RLS + WHERE filters reflect
         * the new state immediately.
         */
        /**
         * F4 · Bind a KB to an agent for auto-search. Authorization:
         * workspace.write enforced upstream; KB ownership for 'private'
         * KBs enforced inside bindKbToAgent (throws FORBIDDEN).
         */
        bindKbToAgent: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            agentId: string;
            autoSearch?: boolean | null;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").KbAgentBinding>;
        unbindKbFromAgent: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            agentId: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
        /**
         * F7 · Delete a single KB document. Cascades to chunks via FK.
         * Owner-check for private KBs is enforced inside
         * deleteKnowledgeBaseDocument.
         */
        deleteKnowledgeBaseDocument: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            docId: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
        updateKnowledgeBaseVisibility: (_: unknown, args: {
            kbId: string;
            visibility: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        addKnowledgeSeed: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            text: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
        addKnowledgeFile: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            fileName: string;
            contentType: string;
            content: string;
            isBase64?: boolean | null;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
        importKnowledgeUrl: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            url: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
        saveCommunityPost: (_: unknown, args: {
            input: {
                workspaceId: string;
                title: string;
                body: string;
                tags: string[];
                authorName: string;
                authorRole?: string | null;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        savePracticeSession: (_: unknown, args: {
            input: {
                workspaceId: string;
                scenarioId: string;
                scenarioTitle?: string | null;
                messages: Array<{
                    id: string;
                    role: string;
                    content: string;
                    timestamp: number;
                    feedback?: string | null;
                }>;
                insights?: Array<{
                    title: string;
                    detail: string;
                }>;
                resources?: Array<{
                    title: string;
                    url?: string | null;
                }>;
                quickReplies?: string[];
                lastUpdated?: string | null;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        createFlow: (_: unknown, args: {
            workspaceId: string;
            name: string;
            definition: FlowDefinition;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        }>;
        updateFlow: (_: unknown, args: {
            id: string;
            name?: string;
            definition?: FlowDefinition;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        }>;
        deleteFlow: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
        saveAsTemplate: (_: unknown, args: {
            flowId: string;
            name: string;
        }, ctx: GraphQLContext) => Promise<{
            id: string;
            workspaceId: string;
            name: string;
            description: string | null;
            definition: unknown;
            isTemplate: boolean;
            version: number;
            createdAt: string;
            updatedAt: string;
        }>;
        executeFlow: (_: unknown, args: {
            flowId: string;
            inputs?: Record<string, unknown>;
        }, ctx: GraphQLContext) => Promise<{
            startedAt: string;
            completedAt: null;
            nodeStates: never[];
            id: string;
            flowId: string;
            status: GraphQLJSON;
            inputs: Record<string, unknown>;
            state: Record<string, unknown> | null;
            error: string | null;
        }>;
        cancelExecution: (_: unknown, args: {
            executionId: string;
        }, ctx: GraphQLContext) => Promise<boolean>;
        updateWorkspaceMetadata: (_: unknown, args: {
            input: {
                workspaceId: string;
                name: string;
                type: string;
                focus: string;
                ownerId: string;
                ownerName: string;
                members: Array<{
                    id: string;
                    name: string;
                    role?: string | null;
                    permissions: string[];
                }>;
            };
        }, ctx: GraphQLContext) => Promise<any>;
        reflectOnIdeation: (_: unknown, args: {
            input: {
                event: {
                    type: string;
                    kind?: string | null;
                    label?: string | null;
                    fromKind?: string | null;
                    toKind?: string | null;
                };
                canvas: {
                    nodes: Array<{
                        id: string;
                        kind: string;
                        label: string;
                        content: string;
                    }>;
                    edgeCount: number;
                    nodeCountByKind: Record<string, number>;
                };
                recentChat: Array<{
                    role: string;
                    content: string;
                }>;
                firedMetaIds: string[];
                priorScaffolds?: string[] | null;
                userTurnCount?: number | null;
                workspaceId?: string | null;
            };
        }, context: GraphQLContext) => Promise<{
            scaffold: string;
            content: any;
            source: any;
            latencyMs: any;
        }>;
        processIdeationWizardStep: (_: unknown, args: {
            input: {
                step: string;
                userAnswer: string;
                canvas: {
                    nodes: Array<{
                        id: string;
                        kind: string;
                        label: string;
                        content: string;
                    }>;
                    edgeCount: number;
                };
                recentChat: Array<{
                    role: string;
                    content: string;
                }>;
                workspaceId?: string | null;
            };
        }, context: GraphQLContext) => Promise<WizardStepResponse>;
        /**
         * Cancel a stale 'running' session. Authorization: caller must own
         * the session (userId match) — we don't allow one user to cancel
         * another user's session even within the same workspace.
         *
         * The session is marked 'failed' with the supplied reason (or a
         * default user-cancellation message). Heartbeat-driven reaper would
         * eventually do this for us when the gateway crashed, but exposing
         * the explicit mutation lets the UI offer "clear stuck session"
         * without waiting for the next reaper tick.
         */
        cancelStaleSession: (_: unknown, args: {
            sessionId: string;
            reason?: string | null;
        }, ctx: GraphQLContext) => Promise<any>;
        mentionAgent: (_: unknown, args: {
            input: {
                workspaceId: string;
                conversationId?: string | null;
                agentId: string;
                message: string;
                priorChat?: string[] | null;
            };
        }, ctx: GraphQLContext) => Promise<import("../services/mention-router.js").MentionResult>;
    };
    Subscription: {
        flowExecutionProgress: {
            subscribe: (_: unknown, args: {
                executionId: string;
            }) => any;
            resolve: (payload: {
                flowExecutionProgress: unknown;
            }) => unknown;
        };
        conversationProgress: {
            subscribe: (_: unknown, args: {
                workspaceId: string;
                conversationId?: string | null;
            }, ctx: GraphQLContext) => Promise<AsyncIterable<{
                conversationProgress: GraphQLJSON;
            }>>;
            resolve: (payload: {
                conversationProgress: unknown;
            }) => unknown;
        };
        reportWriterStream: {
            subscribe: (_: unknown, args: {
                workspaceId: string;
                message?: string | null;
            }, ctx: GraphQLContext) => AsyncGenerator<{
                reportWriterStream: {
                    timestampIso: string;
                };
            }, void, unknown>;
            resolve: (payload: {
                reportWriterStream: unknown;
            }) => unknown;
        };
    };
};
