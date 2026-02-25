'use client'

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KnowledgeBaseSummary } from '@/types/knowledge'

const PUBLISH_KNOWLEDGE_BASE_MUTATION = /* GraphQL */ `
  mutation PublishKnowledgeBase($kbId: ID!) {
    publishKnowledgeBase(kbId: $kbId) {
      id
      name
      status
      createdAt
      updatedAt
      publishedAt
    }
  }
`

export function usePublishKnowledgeBase(): UseMutationResult<
  KnowledgeBaseSummary,
  Error,
  { kbId: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ kbId }) => {
      const client = getGraphQLClient()
      const response = await client.request<{ publishKnowledgeBase: KnowledgeBaseSummary }>(
        PUBLISH_KNOWLEDGE_BASE_MUTATION,
        { kbId }
      )
      return response.publishKnowledgeBase
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge-base-status'] })
    }
  })
}
