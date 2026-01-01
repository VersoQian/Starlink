export type KnowledgeStage = 'uploaded' | 'processing' | 'ready' | 'published'

export type KnowledgeSourceType = 'file' | 'web' | 'ai-summary'

export type KnowledgeAction =
  | 'generate-summary'
  | 'create-nodes'
  | 'share-community'
  | 'publish-template'

export type KnowledgeEntry = {
  id: string
  title: string
  stage: KnowledgeStage
  tags: string[]
  type: KnowledgeSourceType
  summary: string
  updatedAt: string
  references: number
  owner: string
  source?: string
  nextActions?: KnowledgeAction[]
}

export type IngestionJob = {
  id: string
  fileName: string
  stage: KnowledgeStage | 'completed'
  progress: number
  submittedAt: string
  owner: string
}

export type InsightLog = {
  id: string
  entryId?: string
  question: string
  generatedAt: string
  summary: string
  actions: string[]
}
