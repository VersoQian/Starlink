import { z } from 'zod';
export declare const conversationStatusSchema: z.ZodEnum<["idle", "running", "paused", "failed", "completed"]>;
export declare const seminarPhaseSchema: z.ZodEnum<["planning", "execution", "review", "decision"]>;
export declare const phaseChangedPayloadSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    phase: z.ZodEnum<["planning", "execution", "review", "decision"]>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    phase: "planning" | "execution" | "review" | "decision";
    occurredAt: string;
    reason?: string | null | undefined;
}, {
    workspaceId: string;
    phase: "planning" | "execution" | "review" | "decision";
    occurredAt: string;
    reason?: string | null | undefined;
}>;
export declare const seminarTurnCompletedPayloadSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    phase: z.ZodEnum<["planning", "execution", "review", "decision"]>;
    agentId: z.ZodString;
    agentName: z.ZodString;
    nodeId: z.ZodString;
    title: z.ZodString;
    summary: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    summary: string;
    workspaceId: string;
    phase: "planning" | "execution" | "review" | "decision";
    occurredAt: string;
    agentId: string;
    agentName: string;
    nodeId: string;
}, {
    title: string;
    summary: string;
    workspaceId: string;
    phase: "planning" | "execution" | "review" | "decision";
    occurredAt: string;
    agentId: string;
    agentName: string;
    nodeId: string;
}>;
export declare const seminarDecisionPayloadSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    phase: z.ZodLiteral<"decision">;
    decision: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    decision: string;
    phase: "decision";
    occurredAt: string;
}, {
    workspaceId: string;
    decision: string;
    phase: "decision";
    occurredAt: string;
}>;
export declare const seminarDecisionRequestedPayloadSchema: z.ZodObject<{
    workspaceId: z.ZodString;
    phase: z.ZodLiteral<"decision">;
    decision: z.ZodString;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workspaceId: string;
    decision: string;
    phase: "decision";
    occurredAt: string;
}, {
    workspaceId: string;
    decision: string;
    phase: "decision";
    occurredAt: string;
}>;
export declare const knowledgeEvidenceSchema: z.ZodObject<{
    docId: z.ZodString;
    snippet: z.ZodString;
    score: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    docId: string;
    score: number;
    snippet: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    docId: string;
    score: number;
    snippet: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export declare const conversationEventSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"graph/appended">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        workspaceId: z.ZodString;
        nodes: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["note", "document", "task", "reference", "image", "web"]>;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            data: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"note">;
                title: z.ZodString;
                content: z.ZodString;
                subtitle: z.ZodOptional<z.ZodString>;
                bullets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                variant: z.ZodOptional<z.ZodEnum<["primary", "list", "insight", "timeline-step", "timeline-dimension", "timeline-action"]>>;
                footerText: z.ZodOptional<z.ZodString>;
                category: z.ZodOptional<z.ZodString>;
                subCategory: z.ZodOptional<z.ZodString>;
                status: z.ZodOptional<z.ZodString>;
                meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, "strip", z.ZodTypeAny, {
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
            }, {
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
            }>, z.ZodObject<{
                type: z.ZodLiteral<"document">;
                title: z.ZodString;
                summary: z.ZodString;
                references: z.ZodNumber;
                points: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                type: "document";
                title: string;
                summary: string;
                references: number;
                points?: string[] | undefined;
            }, {
                type: "document";
                title: string;
                summary: string;
                references: number;
                points?: string[] | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"task">;
                title: z.ZodString;
                assignee: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                status: z.ZodEnum<["todo", "in-progress", "done"]>;
            }, "strip", z.ZodTypeAny, {
                type: "task";
                status: "todo" | "in-progress" | "done";
                title: string;
                assignee?: string | undefined;
                dueDate?: string | undefined;
            }, {
                type: "task";
                status: "todo" | "in-progress" | "done";
                title: string;
                assignee?: string | undefined;
                dueDate?: string | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"reference">;
                title: z.ZodString;
                source: z.ZodString;
                location: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "reference";
                title: string;
                source: string;
                location: string;
            }, {
                type: "reference";
                title: string;
                source: string;
                location: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"image">;
                title: z.ZodString;
                url: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "image";
                title: string;
                url: string;
            }, {
                type: "image";
                title: string;
                url: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"web">;
                title: z.ZodString;
                url: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: "web";
                title: string;
                url: string;
                description?: string | undefined;
            }, {
                type: "web";
                title: string;
                url: string;
                description?: string | undefined;
            }>]>;
        }, "strip", z.ZodTypeAny, {
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
        }, {
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
        }>, "many">;
        edges: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodString;
            target: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<["bmc-structure", "llm-insight", "user-drawn", "revision"]>>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            id: string;
            target: string;
            label?: string | null | undefined;
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }, {
            source: string;
            id: string;
            target: string;
            label?: string | null | undefined;
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[];
    }, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[];
    };
}, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[];
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"graph/diff">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        nodes: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            type: z.ZodEnum<["note", "document", "task", "reference", "image", "web"]>;
            position: z.ZodObject<{
                x: z.ZodNumber;
                y: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                x: number;
                y: number;
            }, {
                x: number;
                y: number;
            }>;
            data: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"note">;
                title: z.ZodString;
                content: z.ZodString;
                subtitle: z.ZodOptional<z.ZodString>;
                bullets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                variant: z.ZodOptional<z.ZodEnum<["primary", "list", "insight", "timeline-step", "timeline-dimension", "timeline-action"]>>;
                footerText: z.ZodOptional<z.ZodString>;
                category: z.ZodOptional<z.ZodString>;
                subCategory: z.ZodOptional<z.ZodString>;
                status: z.ZodOptional<z.ZodString>;
                meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, "strip", z.ZodTypeAny, {
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
            }, {
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
            }>, z.ZodObject<{
                type: z.ZodLiteral<"document">;
                title: z.ZodString;
                summary: z.ZodString;
                references: z.ZodNumber;
                points: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                type: "document";
                title: string;
                summary: string;
                references: number;
                points?: string[] | undefined;
            }, {
                type: "document";
                title: string;
                summary: string;
                references: number;
                points?: string[] | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"task">;
                title: z.ZodString;
                assignee: z.ZodOptional<z.ZodString>;
                dueDate: z.ZodOptional<z.ZodString>;
                status: z.ZodEnum<["todo", "in-progress", "done"]>;
            }, "strip", z.ZodTypeAny, {
                type: "task";
                status: "todo" | "in-progress" | "done";
                title: string;
                assignee?: string | undefined;
                dueDate?: string | undefined;
            }, {
                type: "task";
                status: "todo" | "in-progress" | "done";
                title: string;
                assignee?: string | undefined;
                dueDate?: string | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"reference">;
                title: z.ZodString;
                source: z.ZodString;
                location: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "reference";
                title: string;
                source: string;
                location: string;
            }, {
                type: "reference";
                title: string;
                source: string;
                location: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"image">;
                title: z.ZodString;
                url: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                type: "image";
                title: string;
                url: string;
            }, {
                type: "image";
                title: string;
                url: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"web">;
                title: z.ZodString;
                url: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: "web";
                title: string;
                url: string;
                description?: string | undefined;
            }, {
                type: "web";
                title: string;
                url: string;
                description?: string | undefined;
            }>]>;
        }, "strip", z.ZodTypeAny, {
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
        }, {
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
        }>, "many">>;
        edges: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            source: z.ZodString;
            target: z.ZodString;
            label: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            kind: z.ZodOptional<z.ZodEnum<["bmc-structure", "llm-insight", "user-drawn", "revision"]>>;
        }, "strip", z.ZodTypeAny, {
            source: string;
            id: string;
            target: string;
            label?: string | null | undefined;
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }, {
            source: string;
            id: string;
            target: string;
            label?: string | null | undefined;
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }>, "many">>;
        removedNodeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        removedEdgeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[] | undefined;
        removedNodeIds?: string[] | undefined;
        removedEdgeIds?: string[] | undefined;
    }, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[] | undefined;
        removedNodeIds?: string[] | undefined;
        removedEdgeIds?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[] | undefined;
        removedNodeIds?: string[] | undefined;
        removedEdgeIds?: string[] | undefined;
    };
}, {
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
            kind?: "bmc-structure" | "llm-insight" | "user-drawn" | "revision" | undefined;
        }[] | undefined;
        removedNodeIds?: string[] | undefined;
        removedEdgeIds?: string[] | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"evidence/updated">;
    conversationId: z.ZodString;
    payload: z.ZodArray<z.ZodObject<{
        docId: z.ZodString;
        snippet: z.ZodString;
        score: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }, {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "evidence/updated";
    conversationId: string;
    payload: {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }[];
}, {
    type: "evidence/updated";
    conversationId: string;
    payload: {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"card/cited">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        cardId: z.ZodString;
        citation: z.ZodObject<{
            cardId: z.ZodString;
            fieldName: z.ZodEnum<["title", "content", "summary"]>;
            spans: z.ZodArray<z.ZodObject<{
                textStart: z.ZodNumber;
                textEnd: z.ZodNumber;
                refs: z.ZodArray<z.ZodObject<{
                    evidenceId: z.ZodString;
                    docId: z.ZodString;
                    snippetId: z.ZodString;
                }, "strip", z.ZodTypeAny, {
                    docId: string;
                    snippetId: string;
                    evidenceId: string;
                }, {
                    docId: string;
                    snippetId: string;
                    evidenceId: string;
                }>, "many">;
            }, "strip", z.ZodTypeAny, {
                textStart: number;
                textEnd: number;
                refs: {
                    docId: string;
                    snippetId: string;
                    evidenceId: string;
                }[];
            }, {
                textStart: number;
                textEnd: number;
                refs: {
                    docId: string;
                    snippetId: string;
                    evidenceId: string;
                }[];
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
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
        }, {
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
        }>;
        groundingRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
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
    }, {
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
    }>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>, z.ZodObject<{
    type: z.ZodLiteral<"status">;
    conversationId: z.ZodString;
    status: z.ZodEnum<["idle", "running", "paused", "failed", "completed"]>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "status";
    status: "idle" | "running" | "paused" | "failed" | "completed";
    conversationId: string;
    message?: string | undefined;
}, {
    type: "status";
    status: "idle" | "running" | "paused" | "failed" | "completed";
    conversationId: string;
    message?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"phase.changed">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        workspaceId: z.ZodString;
        phase: z.ZodEnum<["planning", "execution", "review", "decision"]>;
        reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        reason?: string | null | undefined;
    }, {
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        reason?: string | null | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "phase.changed";
    conversationId: string;
    payload: {
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        reason?: string | null | undefined;
    };
}, {
    type: "phase.changed";
    conversationId: string;
    payload: {
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        reason?: string | null | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"seminar.turn.completed">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        workspaceId: z.ZodString;
        phase: z.ZodEnum<["planning", "execution", "review", "decision"]>;
        agentId: z.ZodString;
        agentName: z.ZodString;
        nodeId: z.ZodString;
        title: z.ZodString;
        summary: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        summary: string;
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        agentId: string;
        agentName: string;
        nodeId: string;
    }, {
        title: string;
        summary: string;
        workspaceId: string;
        phase: "planning" | "execution" | "review" | "decision";
        occurredAt: string;
        agentId: string;
        agentName: string;
        nodeId: string;
    }>;
}, "strip", z.ZodTypeAny, {
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
}, {
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
}>, z.ZodObject<{
    type: z.ZodLiteral<"seminar.decision.made">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        workspaceId: z.ZodString;
        phase: z.ZodLiteral<"decision">;
        decision: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    }, {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "seminar.decision.made";
    conversationId: string;
    payload: {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    };
}, {
    type: "seminar.decision.made";
    conversationId: string;
    payload: {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"seminar.decision.requested">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        workspaceId: z.ZodString;
        phase: z.ZodLiteral<"decision">;
        decision: z.ZodString;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    }, {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "seminar.decision.requested";
    conversationId: string;
    payload: {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    };
}, {
    type: "seminar.decision.requested";
    conversationId: string;
    payload: {
        workspaceId: string;
        decision: string;
        phase: "decision";
        occurredAt: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"agent/subagent-progress">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        /** LangGraph namespace path; entries are `<parentNode>:<subgraphCheckpointId>`. */
        ns: z.ZodArray<z.ZodString, "many">;
        /** Subgraph-internal node that produced the update (e.g. 'invoke-agent', 'parse'). */
        nodeName: z.ZodString;
        /** Top-level keys of the subgraph state that changed. */
        payloadKeys: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        ns: string[];
        nodeName: string;
        payloadKeys: string[];
    }, {
        ns: string[];
        nodeName: string;
        payloadKeys: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    type: "agent/subagent-progress";
    conversationId: string;
    payload: {
        ns: string[];
        nodeName: string;
        payloadKeys: string[];
    };
}, {
    type: "agent/subagent-progress";
    conversationId: string;
    payload: {
        ns: string[];
        nodeName: string;
        payloadKeys: string[];
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"persistence/warning">;
    conversationId: z.ZodString;
    payload: z.ZodObject<{
        severity: z.ZodDefault<z.ZodEnum<["warning", "error"]>>;
        source: z.ZodEnum<["canvas-graph", "conversation-summary", "conversation-completion"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        source: "canvas-graph" | "conversation-summary" | "conversation-completion";
        severity: "warning" | "error";
    }, {
        message: string;
        source: "canvas-graph" | "conversation-summary" | "conversation-completion";
        severity?: "warning" | "error" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "persistence/warning";
    conversationId: string;
    payload: {
        message: string;
        source: "canvas-graph" | "conversation-summary" | "conversation-completion";
        severity: "warning" | "error";
    };
}, {
    type: "persistence/warning";
    conversationId: string;
    payload: {
        message: string;
        source: "canvas-graph" | "conversation-summary" | "conversation-completion";
        severity?: "warning" | "error" | undefined;
    };
}>]>;
export declare const conversationMetadataSchema: z.ZodObject<{
    id: z.ZodString;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    status: z.ZodEnum<["idle", "running", "paused", "failed", "completed"]>;
    latestQuestion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "idle" | "running" | "paused" | "failed" | "completed";
    id: string;
    createdAt: Date;
    updatedAt: Date;
    latestQuestion?: string | undefined;
}, {
    status: "idle" | "running" | "paused" | "failed" | "completed";
    id: string;
    createdAt: Date;
    updatedAt: Date;
    latestQuestion?: string | undefined;
}>;
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;
export type SeminarPhase = z.infer<typeof seminarPhaseSchema>;
export type PhaseChangedPayload = z.infer<typeof phaseChangedPayloadSchema>;
export type SeminarTurnCompletedPayload = z.infer<typeof seminarTurnCompletedPayloadSchema>;
export type SeminarDecisionPayload = z.infer<typeof seminarDecisionPayloadSchema>;
export type SeminarDecisionRequestedPayload = z.infer<typeof seminarDecisionRequestedPayloadSchema>;
export type ConversationEvent = z.infer<typeof conversationEventSchema>;
export type ConversationMetadata = z.infer<typeof conversationMetadataSchema>;
export type KnowledgeEvidence = z.infer<typeof knowledgeEvidenceSchema>;
