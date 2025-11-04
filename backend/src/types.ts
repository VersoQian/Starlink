import { ImportStatus, ImportTaskType, KbStatus, DocumentSourceType } from '@prisma/client'

export type ApiResponse<T> = {
  data: T
}

export interface KbStatusPayload {
  knowledgeBase: {
    id: string
    name: string
    status: KbStatus
    aiChunkingEnabled: boolean
    createdAt: string
    updatedAt: string
    publishedAt?: string | null
  }
  tasks: Array<{
    id: string
    type: ImportTaskType
    status: ImportStatus
    payload: Record<string, unknown>
    error?: string | null
    createdAt: string
    updatedAt: string
  }>
}

export interface UsagePayload {
  usedTokens: number
  limitTokens: number
}

export interface UploadResult {
  path: string
  title: string
  mime: string
  size: number
  sourceType: DocumentSourceType
}
