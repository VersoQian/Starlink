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
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            confidence: number;
            tags: string[];
            lastUsedAt: string | null;
            archivedAt: string | null;
        }[]>;
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
                metadata: Record<string, unknown>;
                createdAt: string;
                updatedAt: string;
                userId: string | null;
                scope: "user" | "workspace" | "agent";
                kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas";
                sourceType: string;
                sourceId: string | null;
                importance: number;
                confidence: number;
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
        conversationRuntimeEvents: (_: unknown, args: {
            workspaceId: string;
            conversationId?: string | null;
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
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            confidence: number;
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
            metadata: Record<string, unknown>;
            createdAt: string;
            updatedAt: string;
            userId: string | null;
            scope: "user" | "workspace" | "agent";
            kind: "insight" | "summary" | "decision" | "preference" | "constraint" | "canvas";
            sourceType: string;
            sourceId: string | null;
            importance: number;
            confidence: number;
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
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        publishKnowledgeBase: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }, ctx: GraphQLContext) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        addKnowledgeSeed: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            text: string;
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
