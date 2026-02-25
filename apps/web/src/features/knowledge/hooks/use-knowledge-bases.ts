'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KnowledgeBaseSummary } from '@/types/knowledge'

const KNOWLEDGE_BASES_QUERY = /* GraphQL */ `
  query KnowledgeBases {
    knowledgeBases {
      id
      name
      status
      createdAt
      updatedAt
      publishedAt
    }
  }
`

export function useKnowledgeBases(): UseQueryResult<KnowledgeBaseSummary[]> {
  return useQuery({
    queryKey: ['knowledge-bases'],
    refetchInterval: 10000,
    queryFn: async () => {
      const client = getGraphQLClient()
      const response = await client.request<{ knowledgeBases: KnowledgeBaseSummary[] }>(KNOWLEDGE_BASES_QUERY)
      return response.knowledgeBases
    }
  })
}
