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
            kbId: string;
        }, ctx: GraphQLContext) => Promise<import("../application/task-event-store.js").TaskStatusSnapshot[]>;
        knowledgeBases: () => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase[]>;
        knowledgeBaseStatus: (_: unknown, args: {
            kbId: string;
        }) => Promise<{
            knowledgeBase: import("../services/kb-task-service.js").GatewayKnowledgeBase;
            tasks: import("../services/kb-task-service.js").GatewayKbTask[];
        }>;
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
        createKnowledgeBase: () => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        publishKnowledgeBase: (_: unknown, args: {
            kbId: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKnowledgeBase>;
        addKnowledgeSeed: (_: unknown, args: {
            kbId: string;
            text: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
        importKnowledgeUrl: (_: unknown, args: {
            kbId: string;
            url: string;
        }) => Promise<import("../services/kb-task-service.js").GatewayKbTask>;
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
