'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import type { KbTaskStatus } from '@/types/knowledge'

const KB_TASK_STATUS_QUERY = /* GraphQL */ `
  query KbTaskStatus($kbId: ID!) {
    kbTaskStatus(kbId: $kbId) {
      taskId
      kbId
      status
      taskType
      error
      updatedAt
      lastEventId
    }
  }
`

export function useKbTaskStatus(kbId: string): UseQueryResult<KbTaskStatus[]> {
  return useQuery({
    queryKey: ['kb-task-status', kbId],
    enabled: kbId.length > 0,
    refetchInterval: 5000,
    queryFn: async () => {
      const client = getGraphQLClient()
      const response = await client.request<{ kbTaskStatus: KbTaskStatus[] }>(KB_TASK_STATUS_QUERY, { kbId })
      return response.kbTaskStatus
    }
  })
}
