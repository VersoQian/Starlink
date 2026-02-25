'use client'

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KnowledgeTask } from '@/types/knowledge'

const IMPORT_KNOWLEDGE_URL_MUTATION = /* GraphQL */ `
  mutation ImportKnowledgeUrl($kbId: ID!, $url: String!) {
    importKnowledgeUrl(kbId: $kbId, url: $url) {
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
`

export function useImportKnowledgeUrl(): UseMutationResult<
  KnowledgeTask,
  Error,
  { kbId: string; url: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ kbId, url }) => {
      const client = getGraphQLClient()
      const response = await client.request<{ importKnowledgeUrl: KnowledgeTask }>(
        IMPORT_KNOWLEDGE_URL_MUTATION,
        { kbId, url }
      )
      return response.importKnowledgeUrl
    },
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['kb-task-status', task.kbId] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge-base-status', task.kbId] })
    }
  })
}
