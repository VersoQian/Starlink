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
                status: "idle" | "running" | "failed" | "completed";
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
        } | null>;
    };
    Mutation: {
        startConversation: (_: unknown, args: {
            workspaceId: string;
            question: string;
        }, ctx: GraphQLContext) => Promise<{
            metadata: {
                createdAt: string;
                updatedAt: string;
                status: "idle" | "running" | "failed" | "completed";
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
        }>;
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
    };
    Subscription: {
        conversationProgress: {
            subscribe: (_: unknown, __: unknown, ctx: GraphQLContext) => import("graphql-subscriptions/dist/pubsub-async-iterable-iterator.js").PubSubAsyncIterableIterator<{
                conversationProgress: import("@branching-chat/shared").ConversationEvent;
            }>;
            resolve: (payload: {
                conversationProgress: unknown;
            }) => unknown;
        };
    };
};
