import GraphQLJSON from 'graphql-type-json';
import type { FlowDefinition } from '@starlink/shared';
import type { GraphQLContext } from '../context/index.js';
export declare const resolvers: {
    JSON: typeof GraphQLJSON;
    Query: {
        workspaceGraph: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<{
            workspaceId: string;
            nodes: {
                type: "note" | "document" | "task" | "reference" | "image" | "web";
                id: string;
                position: {
                    x: number;
                    y: number;
                };
                data: {
                    type: "note";
                    title: string;
                    content: string;
                    status?: string | undefined;
                    subtitle?: string | undefined;
                    bullets?: string[] | undefined;
                    variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                    footerText?: string | undefined;
                    category?: string | undefined;
                    subCategory?: string | undefined;
                    meta?: Record<string, unknown> | undefined;
                } | {
                    type: "document";
                    title: string;
                    summary: string;
                    references: number;
                    points?: string[] | undefined;
                } | {
                    type: "task";
                    status: "todo" | "in-progress" | "done";
                    title: string;
                    assignee?: string | undefined;
                    dueDate?: string | undefined;
                } | {
                    type: "reference";
                    title: string;
                    source: string;
                    location: string;
                } | {
                    type: "image";
                    title: string;
                    url: string;
                } | {
                    type: "web";
                    title: string;
                    url: string;
                    description?: string | undefined;
                };
            }[];
            edges: {
                source: string;
                id: string;
                target: string;
                label?: string | null | undefined;
            }[];
        }>;
        conversation: (_: unknown, args: {
            id: string;
        }, ctx: GraphQLContext) => Promise<{
            metadata: {
                createdAt: string;
                updatedAt: string;
                status: "idle" | "running" | "paused" | "failed" | "completed";
                id: string;
                latestQuestion?: string | undefined;
            };
            graph: {
                workspaceId: string;
                nodes: {
                    type: "note" | "document" | "task" | "reference" | "image" | "web";
                    id: string;
                    position: {
                        x: number;
                        y: number;
                    };
                    data: {
                        type: "note";
                        title: string;
                        content: string;
                        status?: string | undefined;
                        subtitle?: string | undefined;
                        bullets?: string[] | undefined;
                        variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                        footerText?: string | undefined;
                        category?: string | undefined;
                        subCategory?: string | undefined;
                        meta?: Record<string, unknown> | undefined;
                    } | {
                        type: "document";
                        title: string;
                        summary: string;
                        references: number;
                        points?: string[] | undefined;
                    } | {
                        type: "task";
                        status: "todo" | "in-progress" | "done";
                        title: string;
                        assignee?: string | undefined;
                        dueDate?: string | undefined;
                    } | {
                        type: "reference";
                        title: string;
                        source: string;
                        location: string;
                    } | {
                        type: "image";
                        title: string;
                        url: string;
                    } | {
                        type: "web";
                        title: string;
                        url: string;
                        description?: string | undefined;
                    };
                }[];
                edges: {
                    source: string;
                    id: string;
                    target: string;
                    label?: string | null | undefined;
                }[];
            };
            knowledgeEvidence: {
                docId: string;
                score: number;
                snippet: string;
                metadata?: Record<string, unknown> | undefined;
            }[];
            citations: {
                cardId: string;
                fieldName: "title" | "content" | "summary";
                spans: {
                    textStart: number;
                    textEnd: number;
                    refs: {
                        docId: string;
                        snippetId: string;
                        evidenceId: string;
                    }[];
                }[];
            }[];
        } | null>;
        conversationSessions: (_: unknown, args: {
            workspaceId: string;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<{
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
            heartbeatAt?: string | null | undefined;
            ownerPid?: string | null | undefined;
            failureReason?: string | null | undefined;
        }[]>;
        conversationMessages: (_: unknown, args: {
            workspaceId: string;
            conversationId: string;
            limit?: number | null;
        }, ctx: GraphQLContext) => Promise<{
            content: string;
            id: string;
            workspaceId: string;
            metadata: Record<string, unknown>;
            conversationId: string;
            createdAt: string;
            userId: string | null;
            role: "user" | "assistant" | "system" | "tool";
        }[]>;
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
        }, ctx: GraphQLContext) => Promise<{
            title: string;
            content: string;
            id: string;
            workspaceId: string;
            confidence: number;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }[]>;
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
        }, ctx: GraphQLContext) => Promise<{
            title: string;
            content: string;
            id: string;
            workspaceId: string;
            confidence: number;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }[]>;
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
            sessions: import("@starlink/shared").ConversationSession[];
            messages: import("@starlink/shared").ConversationMessage[];
            memoryItems: import("@starlink/shared").MemoryItem[];
            knowledgeBases: Array<Record<string, unknown>>;
            knowledgeDocuments: Array<Record<string, unknown>>;
        }>;
        workspaceContextSnapshot: (_: unknown, args: {
            workspaceId: string;
            conversationId?: string | null;
            query: string;
            kbId?: string | null;
        }, ctx: GraphQLContext) => Promise<{
            workspaceId: string;
            conversationId: string | null;
            query: string;
            builtAt: string;
            canvasSummary: {
                nodeCount: number;
                edgeCount: number;
                highlights: string[];
            };
            recentMessages: {
                content: string;
                id: string;
                workspaceId: string;
                metadata: Record<string, unknown>;
                conversationId: string;
                createdAt: string;
                userId: string | null;
                role: "user" | "assistant" | "system" | "tool";
            }[];
            memories: {
                title: string;
                content: string;
                id: string;
                workspaceId: string;
                confidence: number;
                metadata: Record<string, unknown>;
                createdAt: string;
                updatedAt: string;
                userId: string | null;
                scope: "user" | "workspace" | "agent";
                kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
                sourceType: string;
                sourceId: string | null;
                importance: number;
                tags: string[];
                lastUsedAt: string | null;
                archivedAt: string | null;
            }[];
            knowledgeEvidence: {
                docId: string;
                score: number;
                snippet: string;
                metadata?: Record<string, unknown> | undefined;
            }[];
            promptBlock: string;
        }>;
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
        }, ctx: GraphQLContext) => Promise<({
            type: "graph/appended";
            conversationId: string;
            payload: {
                workspaceId: string;
                nodes: {
                    type: "note" | "document" | "task" | "reference" | "image" | "web";
                    id: string;
                    position: {
                        x: number;
                        y: number;
                    };
                    data: {
                        type: "note";
                        title: string;
                        content: string;
                        status?: string | undefined;
                        subtitle?: string | undefined;
                        bullets?: string[] | undefined;
                        variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                        footerText?: string | undefined;
                        category?: string | undefined;
                        subCategory?: string | undefined;
                        meta?: Record<string, unknown> | undefined;
                    } | {
                        type: "document";
                        title: string;
                        summary: string;
                        references: number;
                        points?: string[] | undefined;
                    } | {
                        type: "task";
                        status: "todo" | "in-progress" | "done";
                        title: string;
                        assignee?: string | undefined;
                        dueDate?: string | undefined;
                    } | {
                        type: "reference";
                        title: string;
                        source: string;
                        location: string;
                    } | {
                        type: "image";
                        title: string;
                        url: string;
                    } | {
                        type: "web";
                        title: string;
                        url: string;
                        description?: string | undefined;
                    };
                }[];
                edges: {
                    source: string;
                    id: string;
                    target: string;
                    label?: string | null | undefined;
                }[];
            };
        } | {
            type: "graph/diff";
            conversationId: string;
            payload: {
                nodes?: {
                    type: "note" | "document" | "task" | "reference" | "image" | "web";
                    id: string;
                    position: {
                        x: number;
                        y: number;
                    };
                    data: {
                        type: "note";
                        title: string;
                        content: string;
                        status?: string | undefined;
                        subtitle?: string | undefined;
                        bullets?: string[] | undefined;
                        variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                        footerText?: string | undefined;
                        category?: string | undefined;
                        subCategory?: string | undefined;
                        meta?: Record<string, unknown> | undefined;
                    } | {
                        type: "document";
                        title: string;
                        summary: string;
                        references: number;
                        points?: string[] | undefined;
                    } | {
                        type: "task";
                        status: "todo" | "in-progress" | "done";
                        title: string;
                        assignee?: string | undefined;
                        dueDate?: string | undefined;
                    } | {
                        type: "reference";
                        title: string;
                        source: string;
                        location: string;
                    } | {
                        type: "image";
                        title: string;
                        url: string;
                    } | {
                        type: "web";
                        title: string;
                        url: string;
                        description?: string | undefined;
                    };
                }[] | undefined;
                edges?: {
                    source: string;
                    id: string;
                    target: string;
                    label?: string | null | undefined;
                }[] | undefined;
                removedNodeIds?: string[] | undefined;
                removedEdgeIds?: string[] | undefined;
            };
        } | {
            type: "evidence/updated";
            conversationId: string;
            payload: {
                docId: string;
                score: number;
                snippet: string;
                metadata?: Record<string, unknown> | undefined;
            }[];
        } | {
            type: "card/cited";
            conversationId: string;
            payload: {
                cardId: string;
                citation: {
                    cardId: string;
                    fieldName: "title" | "content" | "summary";
                    spans: {
                        textStart: number;
                        textEnd: number;
                        refs: {
                            docId: string;
                            snippetId: string;
                            evidenceId: string;
                        }[];
                    }[];
                };
                groundingRate: number;
            };
        } | {
            type: "status";
            status: "idle" | "running" | "paused" | "failed" | "completed";
            conversationId: string;
            message?: string | undefined;
        } | {
            type: "phase.changed";
            conversationId: string;
            payload: {
                workspaceId: string;
                phase: "planning" | "execution" | "review" | "decision";
                occurredAt: string;
                reason?: string | null | undefined;
            };
        } | {
            type: "seminar.turn.completed";
            conversationId: string;
            payload: {
                title: string;
                summary: string;
                workspaceId: string;
                phase: "planning" | "execution" | "review" | "decision";
                occurredAt: string;
                agentId: string;
                agentName: string;
                nodeId: string;
            };
        } | {
            type: "seminar.decision.made";
            conversationId: string;
            payload: {
                workspaceId: string;
                decision: string;
                phase: "decision";
                occurredAt: string;
            };
        } | {
            type: "seminar.decision.requested";
            conversationId: string;
            payload: {
                workspaceId: string;
                decision: string;
                phase: "decision";
                occurredAt: string;
            };
        } | {
            type: "agent/subagent-progress";
            conversationId: string;
            payload: {
                ns: string[];
                nodeName: string;
                payloadKeys: string[];
            };
        })[]>;
        kbTaskStatus: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<{
            workspaceId: string;
            taskId: string;
            kbId: string;
            status: import("@starlink/shared").TaskEvent["status"];
            taskType: import("@starlink/shared").TaskEvent["payload"]["taskType"];
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
        knowledgeBaseSearch: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            query: string;
            topK?: number | null;
        }, ctx: GraphQLContext) => Promise<{
            docId: string;
            snippet: string;
            score: number;
            metadata: {
                snippetId: string;
            };
        }[]>;
        workspaces: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            type: string;
            status: "archived" | "error" | "draft" | "active" | "provisioning";
            workspaceId: string;
            updatedAt: string;
            name: string;
            focus: string;
            ownerId: string;
            ownerName: string;
            members: {
                id: string;
                name: string;
                permissions: string[];
                role?: string | undefined;
            }[];
            viewerPermissions: string[];
            canManage: boolean;
        }[]>;
        workspaceAssets: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<{
            status: "archived" | "error" | "processing" | "draft" | "ready" | "published";
            title: string;
            workspaceId: string;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            version: number;
            assetId: string;
            assetType: string;
            sourceModule: string;
            createdBy: string;
            content?: unknown;
            sourceTaskId?: string | null | undefined;
        }[]>;
        workspaceMetadataHistory: (_: unknown, args: {
            workspaceId: string;
        }, ctx: GraphQLContext) => Promise<{
            summary: string;
            workspaceId: string;
            version: number;
            historyId: string;
            changedBy: string;
            changedAt: string;
        }[]>;
        availableTools: (_: unknown, __: unknown, ctx: GraphQLContext) => {
            name: string;
            label: string;
            description: string;
            category: import("@starlink/shared").ToolCategory;
            icon: string;
            color: string;
            inputSchema: import("@starlink/shared").ToolInputSchema;
            outputSchema: import("@starlink/shared").ToolOutputSchema;
            inputPorts: import("@starlink/shared").PortDefinition[];
            outputPorts: import("@starlink/shared").PortDefinition[];
            runtime: import("@starlink/shared").ToolRuntimeConfig;
        }[];
        toolByName: (_: unknown, args: {
            name: string;
        }, ctx: GraphQLContext) => {
            name: string;
            label: string;
            description: string;
            category: import("@starlink/shared").ToolCategory;
            icon: string;
            color: string;
            inputSchema: import("@starlink/shared").ToolInputSchema;
            outputSchema: import("@starlink/shared").ToolOutputSchema;
            inputPorts: import("@starlink/shared").PortDefinition[];
            outputPorts: import("@starlink/shared").PortDefinition[];
            runtime: import("@starlink/shared").ToolRuntimeConfig;
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
            status: import("@starlink/shared").ExecutionStatus;
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
            status: import("@starlink/shared").ExecutionStatus;
            inputs: Record<string, unknown>;
            state: Record<string, unknown> | null;
            error: string | null;
        }[]>;
    };
    Mutation: {
        startConversation: (_: unknown, args: {
            workspaceId: string;
            question: string;
            kbId?: string | null;
            headless?: boolean | null;
        }, ctx: GraphQLContext) => Promise<{
            metadata: {
                createdAt: string;
                updatedAt: string;
                status: "idle" | "running" | "paused" | "failed" | "completed";
                id: string;
                latestQuestion?: string | undefined;
            };
            graph: {
                workspaceId: string;
                nodes: {
                    type: "note" | "document" | "task" | "reference" | "image" | "web";
                    id: string;
                    position: {
                        x: number;
                        y: number;
                    };
                    data: {
                        type: "note";
                        title: string;
                        content: string;
                        status?: string | undefined;
                        subtitle?: string | undefined;
                        bullets?: string[] | undefined;
                        variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                        footerText?: string | undefined;
                        category?: string | undefined;
                        subCategory?: string | undefined;
                        meta?: Record<string, unknown> | undefined;
                    } | {
                        type: "document";
                        title: string;
                        summary: string;
                        references: number;
                        points?: string[] | undefined;
                    } | {
                        type: "task";
                        status: "todo" | "in-progress" | "done";
                        title: string;
                        assignee?: string | undefined;
                        dueDate?: string | undefined;
                    } | {
                        type: "reference";
                        title: string;
                        source: string;
                        location: string;
                    } | {
                        type: "image";
                        title: string;
                        url: string;
                    } | {
                        type: "web";
                        title: string;
                        url: string;
                        description?: string | undefined;
                    };
                }[];
                edges: {
                    source: string;
                    id: string;
                    target: string;
                    label?: string | null | undefined;
                }[];
            };
            knowledgeEvidence: {
                docId: string;
                score: number;
                snippet: string;
                metadata?: Record<string, unknown> | undefined;
            }[];
            citations: {
                cardId: string;
                fieldName: "title" | "content" | "summary";
                spans: {
                    textStart: number;
                    textEnd: number;
                    refs: {
                        docId: string;
                        snippetId: string;
                        evidenceId: string;
                    }[];
                }[];
            }[];
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
            content: string;
            id: string;
            workspaceId: string;
            metadata: Record<string, unknown>;
            conversationId: string;
            createdAt: string;
            userId: string | null;
            role: "user" | "assistant" | "system" | "tool";
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
            title: string;
            content: string;
            id: string;
            workspaceId: string;
            confidence: number;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
            title: string;
            content: string;
            id: string;
            workspaceId: string;
            confidence: number;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }>;
        extractConversationMemory: (_: unknown, args: {
            conversationId: string;
        }, ctx: GraphQLContext) => Promise<{
            title: string;
            content: string;
            id: string;
            workspaceId: string;
            confidence: number;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas" | "user-skill";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }[]>;
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
        }, ctx: GraphQLContext) => Promise<{
            type: "note" | "document" | "task" | "reference" | "image" | "web";
            id: string;
            position: {
                x: number;
                y: number;
            };
            data: {
                type: "note";
                title: string;
                content: string;
                status?: string | undefined;
                subtitle?: string | undefined;
                bullets?: string[] | undefined;
                variant?: "primary" | "list" | "insight" | "timeline-step" | "timeline-dimension" | "timeline-action" | undefined;
                footerText?: string | undefined;
                category?: string | undefined;
                subCategory?: string | undefined;
                meta?: Record<string, unknown> | undefined;
            } | {
                type: "document";
                title: string;
                summary: string;
                references: number;
                points?: string[] | undefined;
            } | {
                type: "task";
                status: "todo" | "in-progress" | "done";
                title: string;
                assignee?: string | undefined;
                dueDate?: string | undefined;
            } | {
                type: "reference";
                title: string;
                source: string;
                location: string;
            } | {
                type: "image";
                title: string;
                url: string;
            } | {
                type: "web";
                title: string;
                url: string;
                description?: string | undefined;
            };
        }>;
        connectNodes: (_: unknown, args: {
            workspaceId: string;
            input: {
                id?: string;
                source: string;
                target: string;
                label?: string | null;
            };
        }, ctx: GraphQLContext) => Promise<{
            source: string;
            id: string;
            target: string;
            label?: string | null | undefined;
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
            status: "archived" | "error" | "processing" | "draft" | "ready" | "published";
            title: string;
            workspaceId: string;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            version: number;
            assetId: string;
            assetType: string;
            sourceModule: string;
            createdBy: string;
            content?: unknown;
            sourceTaskId?: string | null | undefined;
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
            status: "archived" | "error" | "processing" | "draft" | "ready" | "published";
            title: string;
            workspaceId: string;
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            version: number;
            assetId: string;
            assetType: string;
            sourceModule: string;
            createdBy: string;
            content?: unknown;
            sourceTaskId?: string | null | undefined;
        }>;
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
            status: import("@starlink/shared").ExecutionStatus;
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
        }, ctx: GraphQLContext) => Promise<{
            type: string;
            status: "archived" | "error" | "draft" | "active" | "provisioning";
            workspaceId: string;
            updatedAt: string;
            name: string;
            focus: string;
            ownerId: string;
            ownerName: string;
            members: {
                id: string;
                name: string;
                permissions: string[];
                role?: string | undefined;
            }[];
            viewerPermissions: string[];
            canManage: boolean;
        }>;
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
                workspaceId?: string | null;
            };
        }, context: GraphQLContext) => Promise<{
            scaffold: string;
            content: string;
            source: "error" | "llm" | "scripted";
            latencyMs: number | undefined;
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
        }, context: GraphQLContext) => Promise<{
            source: "error" | "llm" | "scripted";
            extracted: {
                content: string;
                label: string;
                kind: "core-idea" | "customer-pain" | "value-angle" | "hypothesis" | "validation-channel" | "revenue" | "risk" | "evidence" | "reflection";
            };
            nextQuestion: string;
            nextStep: "validation" | "meta" | "done" | "core-idea" | "customer-pain" | "value-angle" | "hypothesis" | "revenue" | "risk";
            latencyMs?: number | undefined;
        }>;
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
        }, ctx: GraphQLContext) => Promise<{
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
            heartbeatAt?: string | null | undefined;
            ownerPid?: string | null | undefined;
            failureReason?: string | null | undefined;
        } | null>;
        mentionAgent: (_: unknown, args: {
            input: {
                workspaceId: string;
                conversationId?: string | null;
                agentId: string;
                message: string;
            };
        }, ctx: GraphQLContext) => Promise<import("../services/mention-router.js").MentionResult>;
    };
    Subscription: {
        flowExecutionProgress: {
            subscribe: (_: unknown, args: {
                executionId: string;
            }) => import("graphql-subscriptions/dist/pubsub-async-iterable-iterator.js").PubSubAsyncIterableIterator<unknown>;
            resolve: (payload: {
                flowExecutionProgress: unknown;
            }) => unknown;
        };
        conversationProgress: {
            subscribe: (_: unknown, args: {
                workspaceId: string;
                conversationId?: string | null;
            }, ctx: GraphQLContext) => Promise<AsyncIterable<{
                conversationProgress: import("@starlink/shared").ConversationEvent;
            }>>;
            resolve: (payload: {
                conversationProgress: unknown;
            }) => unknown;
        };
    };
};
