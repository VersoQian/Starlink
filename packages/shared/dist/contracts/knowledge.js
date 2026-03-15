import { z } from 'zod';
import { taskStatusSchema, taskTypeSchema } from './task-events.js';
const isoDateTimeString = z.string().datetime();
export const kbStatusSchema = z.enum(['draft', 'processing', 'ready']);
export const knowledgeBaseSchema = z.object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    name: z.string().min(1),
    status: kbStatusSchema,
    createdAt: isoDateTimeString,
    updatedAt: isoDateTimeString,
    publishedAt: isoDateTimeString.nullable().optional()
});
export const knowledgeTaskPayloadSchema = z.record(z.unknown());
export const knowledgeTaskSchema = z.object({
    id: z.string().min(1),
    workspaceId: z.string().min(1),
    kbId: z.string().min(1),
    type: taskTypeSchema,
    status: taskStatusSchema,
    payload: knowledgeTaskPayloadSchema.optional(),
    error: z.string().nullable().optional(),
    createdAt: isoDateTimeString,
    updatedAt: isoDateTimeString
});
export const kbTaskStatusSnapshotSchema = z.object({
    taskId: z.string().min(1),
    workspaceId: z.string().min(1),
    kbId: z.string().min(1),
    status: taskStatusSchema,
    taskType: taskTypeSchema,
    error: z.string().nullable().optional(),
    updatedAt: isoDateTimeString,
    lastEventId: z.string().min(1)
});
export const knowledgeBaseListResponseSchema = z.object({
    knowledgeBases: z.array(knowledgeBaseSchema).optional()
});
export const knowledgeBaseStatusResponseSchema = z.object({
    knowledgeBase: knowledgeBaseSchema.optional(),
    tasks: z.array(knowledgeTaskSchema).optional()
});
