'use client'

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KnowledgeTask } from '@/types/knowledge'

const ADD_KNOWLEDGE_SEED_MUTATION = /* GraphQL */ `
  mutation AddKnowledgeSeed($kbId: ID!, $text: String!) {
    addKnowledgeSeed(kbId: $kbId, text: $text) {
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

export function useAddKnowledgeSeed(): UseMutationResult<
  KnowledgeTask,
  Error,
  { kbId: string; text: string }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ kbId, text }) => {
      const client = getGraphQLClient()
      const response = await client.request<{ addKnowledgeSeed: KnowledgeTask }>(
        ADD_KNOWLEDGE_SEED_MUTATION,
        { kbId, text }
      )
      return response.addKnowledgeSeed
    },
    onSuccess: async (task) => {
      await queryClient.invalidateQueries({ queryKey: ['kb-task-status', task.kbId] })
      await queryClient.invalidateQueries({ queryKey: ['knowledge-base-status', task.kbId] })
    }
  })
}
