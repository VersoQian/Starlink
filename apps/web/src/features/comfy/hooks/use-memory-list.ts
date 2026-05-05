'use client'

/**
 * P2 · Memory drawer GraphQL hooks.
 *
 * Three queries cover the three tabs of the Memory drawer:
 *   - useMyMemories:    user-scoped memory rows (per-tab kind filter)
 *   - useMyKnowledgeEvidence: KB chunk citations reverse-lookup
 *
 * Plus one mutation:
 *   - useCorrectMemoryItem: archive / edit content / leave feedback
 *
 * All queries are user-scoped server-side (resolver enforces ctx.userId);
 * the frontend doesn't pass userId — it's derived from the authenticated
 * session.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'

export interface MemoryItem {
  id: string
  workspaceId: string
  userId: string | null
  scope: string
  kind: string
  title: string
  content: string
  sourceType: string
  sourceId: string | null
  importance: number
  confidence: number
  tags: string[]
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
  archivedAt: string | null
}

export interface KnowledgeEvidenceRef {
  memoryItemId: string
  workspaceId: string
  docId: string
  snippet: string | null
  score: number | null
  citedAt: string
  sourceTitle: string
}

const MY_MEMORIES_QUERY = /* GraphQL */ `
  query MyMemories($workspaceId: ID, $kind: String, $query: String, $limit: Int) {
    myMemories(workspaceId: $workspaceId, kind: $kind, query: $query, limit: $limit) {
      id
      workspaceId
      userId
      scope
      kind
      title
      content
      sourceType
      sourceId
      importance
      confidence
      tags
      metadata
      createdAt
      updatedAt
      lastUsedAt
      archivedAt
    }
  }
`

const MY_KB_EVIDENCE_QUERY = /* GraphQL */ `
  query MyKnowledgeEvidence($workspaceId: ID, $limit: Int) {
    myKnowledgeEvidence(workspaceId: $workspaceId, limit: $limit) {
      memoryItemId
      workspaceId
      docId
      snippet
      score
      citedAt
      sourceTitle
    }
  }
`

const CORRECT_MEMORY_MUTATION = /* GraphQL */ `
  mutation CorrectMemoryItem($input: CorrectMemoryItemInput!) {
    correctMemoryItem(input: $input) {
      id
      workspaceId
      userId
      scope
      kind
      title
      content
      tags
      metadata
      updatedAt
      archivedAt
    }
  }
`

export function useMyMemories(opts: {
  workspaceId?: string | null
  kind?: string | null
  query?: string | null
  limit?: number | null
  enabled?: boolean
}): UseQueryResult<MemoryItem[]> {
  return useQuery({
    queryKey: [
      'memory',
      'my',
      opts.workspaceId ?? null,
      opts.kind ?? null,
      opts.query ?? null,
      opts.limit ?? 50
    ],
    enabled: opts.enabled !== false,
    queryFn: async () => {
      const client = getGraphQLClient()
      const response = await client.request<{ myMemories: MemoryItem[] }>(MY_MEMORIES_QUERY, {
        workspaceId: opts.workspaceId ?? null,
        kind: opts.kind ?? null,
        query: opts.query ?? null,
        limit: opts.limit ?? 50
      })
      return response.myMemories
    }
  })
}

export function useMyKnowledgeEvidence(opts: {
  workspaceId?: string | null
  limit?: number | null
  enabled?: boolean
}): UseQueryResult<KnowledgeEvidenceRef[]> {
  return useQuery({
    queryKey: ['memory', 'kb-evidence', opts.workspaceId ?? null, opts.limit ?? 100],
    enabled: opts.enabled !== false,
    queryFn: async () => {
      const client = getGraphQLClient()
      const response = await client.request<{ myKnowledgeEvidence: KnowledgeEvidenceRef[] }>(
        MY_KB_EVIDENCE_QUERY,
        {
          workspaceId: opts.workspaceId ?? null,
          limit: opts.limit ?? 100
        }
      )
      return response.myKnowledgeEvidence
    }
  })
}

export function useCorrectMemoryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      itemId: string
      newContent?: string
      archive?: boolean
      feedback?: string
    }) => {
      const client = getGraphQLClient()
      const response = await client.request<{ correctMemoryItem: MemoryItem }>(
        CORRECT_MEMORY_MUTATION,
        { input }
      )
      return response.correctMemoryItem
    },
    onSuccess: () => {
      // Invalidate all memory queries so the drawer re-renders with the
      // updated row (or hides archived rows).
      queryClient.invalidateQueries({ queryKey: ['memory'] })
    }
  })
}
