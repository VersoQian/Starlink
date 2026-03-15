import GraphQLJSON from 'graphql-type-json';
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
                snippet: string;
                score: number;
                metadata?: Record<string, unknown> | undefined;
            }[];
        } | null>;
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
        }) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase[]>;
        knowledgeBaseStatus: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }) => Promise<{
            knowledgeBase: import("../services/kb-task-service.js").GatewayKnowledgeBase;
            tasks: import("../services/kb-task-service.js").GatewayKbTask[];
        }>;
        workspaces: (_: unknown, __: unknown, ctx: GraphQLContext) => Promise<{
            type: string;
            status: "error" | "draft" | "active" | "archived" | "provisioning";
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
            status: "error" | "processing" | "draft" | "ready" | "archived" | "published";
            title: string;
            workspaceId: string;
            createdAt: string;
            updatedAt: string;
            metadata: Record<string, unknown>;
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
    };
    Mutation: {
        startConversation: (_: unknown, args: {
            workspaceId: string;
            question: string;
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
                snippet: string;
                score: number;
                metadata?: Record<string, unknown> | undefined;
            }[];
        }>;
        approveDecision: (_: unknown, args: {
            conversationId: string;
            decision?: string | null;
        }, ctx: GraphQLContext) => Promise<boolean>;
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
        }) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        publishKnowledgeBase: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        addKnowledgeSeed: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            text: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
        importKnowledgeUrl: (_: unknown, args: {
            workspaceId: string;
            kbId: string;
            url: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
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
            status: "error" | "processing" | "draft" | "ready" | "archived" | "published";
            title: string;
            workspaceId: string;
            createdAt: string;
            updatedAt: string;
            metadata: Record<string, unknown>;
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
            status: "error" | "processing" | "draft" | "ready" | "archived" | "published";
            title: string;
            workspaceId: string;
            createdAt: string;
            updatedAt: string;
            metadata: Record<string, unknown>;
            version: number;
            assetId: string;
            assetType: string;
            sourceModule: string;
            createdBy: string;
            content?: unknown;
            sourceTaskId?: string | null | undefined;
        }>;
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
            status: "error" | "draft" | "active" | "archived" | "provisioning";
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
        conversationProgress: {
            subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => AsyncIterable<{
                conversationProgress: import("@starlink/shared").ConversationEvent;
            }>;
            resolve: (payload: {
                conversationProgress: unknown;
            }) => unknown;
        };
    };
};
