'use client'

import { useQuery } from '@tanstack/react-query'
import type { TimelineIteration } from '@/types/timeline'

export function useTimelineHistory(tenantId: string, taskId?: string) {
  return useQuery<{ iterations: TimelineIteration[] }>({
    queryKey: ['timeline-history', tenantId, taskId],
    queryFn: async () => {
      if (!taskId) {
        return { iterations: [] }
      }
      const response = await fetch(`/api/timeline/${encodeURIComponent(taskId)}?tenantId=${encodeURIComponent(tenantId)}`)
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || '获取时间线失败')
      }
      return (await response.json()) as { iterations: TimelineIteration[] }
    },
    enabled: Boolean(taskId)
  })
}
