'use client'

import { use } from 'react'
import { FlowEditor } from '@/features/flow-editor'

export default function FlowPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = use(params)
  return <FlowEditor workspaceId={workspaceId} />
}
