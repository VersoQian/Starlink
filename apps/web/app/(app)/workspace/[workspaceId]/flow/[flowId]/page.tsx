'use client'

import { use } from 'react'
import { FlowEditor } from '@/features/flow-editor'

export default function FlowEditPage({
  params,
}: {
  params: Promise<{ workspaceId: string; flowId: string }>
}) {
  const { workspaceId, flowId } = use(params)
  return <FlowEditor workspaceId={workspaceId} flowId={flowId} />
}
