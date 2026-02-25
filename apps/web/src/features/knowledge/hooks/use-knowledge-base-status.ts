'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KnowledgeBaseStatus } from '@/types/knowledge'

const KNOWLEDGE_BASE_STATUS_QUERY = /* GraphQL */ `
  query KnowledgeBaseStatus($kbId: ID!) {
    knowledgeBaseStatus(kbId: $kbId) {
      knowledgeBase {
        id
        name
        status
        createdAt
        updatedAt
        publishedAt
      }
      tasks {
        id
        kbId
        type
        status
        payload
        error
        createdAt
        updatedAt
      }
    }
  }
`

export function useKnowledgeBaseStatus(kbId: string): UseQueryResult<KnowledgeBaseStatus> {
  return useQuery({
    queryKey: ['knowledge-base-status', kbId],
    enabled: kbId.length > 0,
    refetchInterval: 5000,
    queryFn: async () => {
      const client = getGraphQLClient()
      const response = await client.request<{ knowledgeBaseStatus: KnowledgeBaseStatus }>(
        KNOWLEDGE_BASE_STATUS_QUERY,
        { kbId }
      )
      return response.knowledgeBaseStatus
    }
  })
}
