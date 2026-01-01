'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import { type WorkspaceGraphResponse } from '@/types/graph'

const WORKSPACE_GRAPH_QUERY = /* GraphQL */ `
  query WorkspaceGraph($workspaceId: ID!) {
    workspaceGraph(workspaceId: $workspaceId) {
      workspaceId
      nodes {
        id
        type
        position {
          x
          y
        }
        data
      }
      edges {
        id
        source
        target
        label
      }
    }
  }
`

export function useWorkspaceGraph(workspaceId: string): UseQueryResult<WorkspaceGraphResponse> {
  return useQuery({
    queryKey: ['workspace-graph', workspaceId],
    queryFn: async () => {
      const client = getGraphQLClient()
      const data = await client.request<{ workspaceGraph: WorkspaceGraphResponse }>(WORKSPACE_GRAPH_QUERY, {
        workspaceId
      })
      return data.workspaceGraph
    }
  })
}
