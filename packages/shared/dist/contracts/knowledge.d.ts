import { z } from 'zod';
export declare const kbStatusSchema: z.ZodEnum<["draft", "processing", "ready"]>;
export declare const knowledgeBaseSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["draft", "processing", "ready"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    publishedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status: "processing" | "draft" | "ready";
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    publishedAt?: string | null | undefined;
}, {
    status: "processing" | "draft" | "ready";
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    publishedAt?: string | null | undefined;
}>;
export declare const knowledgeTaskPayloadSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const knowledgeTaskSchema: z.ZodObject<{
    id: z.ZodString;
    workspaceId: z.ZodString;
    kbId: z.ZodString;
    type: z.ZodEnum<["seed", "file", "url"]>;
    status: z.ZodEnum<["pending", "processing", "succeeded", "failed"]>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "url" | "file" | "seed";
    status: "failed" | "pending" | "processing" | "succeeded";
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    kbId: string;
    payload?: Record<string, unknown> | undefined;
    error?: string | null | undefined;
}, {
    type: "url" | "file" | "seed";
    status: "failed" | "pending" | "processing" | "succeeded";
    id: string;
    workspaceId: string;
    createdAt: string;
    updatedAt: string;
    kbId: string;
    payload?: Record<string, unknown> | undefined;
    error?: string | null | undefined;
}>;
export declare const kbTaskStatusSnapshotSchema: z.ZodObject<{
    taskId: z.ZodString;
    workspaceId: z.ZodString;
    kbId: z.ZodString;
    status: z.ZodEnum<["pending", "processing", "succeeded", "failed"]>;
    taskType: z.ZodEnum<["seed", "file", "url"]>;
    error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    updatedAt: z.ZodString;
    lastEventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "failed" | "pending" | "processing" | "succeeded";
    workspaceId: string;
    updatedAt: string;
    taskType: "url" | "file" | "seed";
    taskId: string;
    kbId: string;
    lastEventId: string;
    error?: string | null | undefined;
}, {
    status: "failed" | "pending" | "processing" | "succeeded";
    workspaceId: string;
    updatedAt: string;
    taskType: "url" | "file" | "seed";
    taskId: string;
    kbId: string;
    lastEventId: string;
    error?: string | null | undefined;
}>;
export declare const knowledgeBaseListResponseSchema: z.ZodObject<{
    knowledgeBases: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["draft", "processing", "ready"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        publishedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }, {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    knowledgeBases?: {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }[] | undefined;
}, {
    knowledgeBases?: {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }[] | undefined;
}>;
export declare const knowledgeBaseStatusResponseSchema: z.ZodObject<{
    knowledgeBase: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["draft", "processing", "ready"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        publishedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }, {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    }>>;
    tasks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workspaceId: z.ZodString;
        kbId: z.ZodString;
        type: z.ZodEnum<["seed", "file", "url"]>;
        status: z.ZodEnum<["pending", "processing", "succeeded", "failed"]>;
        payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        error: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "url" | "file" | "seed";
        status: "failed" | "pending" | "processing" | "succeeded";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        kbId: string;
        payload?: Record<string, unknown> | undefined;
        error?: string | null | undefined;
    }, {
        type: "url" | "file" | "seed";
        status: "failed" | "pending" | "processing" | "succeeded";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        kbId: string;
        payload?: Record<string, unknown> | undefined;
        error?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    knowledgeBase?: {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    } | undefined;
    tasks?: {
        type: "url" | "file" | "seed";
        status: "failed" | "pending" | "processing" | "succeeded";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        kbId: string;
        payload?: Record<string, unknown> | undefined;
        error?: string | null | undefined;
    }[] | undefined;
}, {
    knowledgeBase?: {
        status: "processing" | "draft" | "ready";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        name: string;
        publishedAt?: string | null | undefined;
    } | undefined;
    tasks?: {
        type: "url" | "file" | "seed";
        status: "failed" | "pending" | "processing" | "succeeded";
        id: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
        kbId: string;
        payload?: Record<string, unknown> | undefined;
        error?: string | null | undefined;
    }[] | undefined;
}>;
export declare const knowledgeSearchResultSchema: z.ZodObject<{
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
export declare const knowledgeSearchResponseSchema: z.ZodObject<{
    results: z.ZodOptional<z.ZodArray<z.ZodObject<{
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
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    results?: {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
}, {
    results?: {
        docId: string;
        score: number;
        snippet: string;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
export type KbStatus = z.infer<typeof kbStatusSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type KnowledgeTask = z.infer<typeof knowledgeTaskSchema>;
export type KbTaskStatusSnapshot = z.infer<typeof kbTaskStatusSnapshotSchema>;
export type KnowledgeSearchResult = z.infer<typeof knowledgeSearchResultSchema>;
