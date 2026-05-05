'use client'

import { use } from 'react'
import { MacraAnalysisPage } from '@/features/macra'

export default function MacraPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = use(params)
  return <MacraAnalysisPage workspaceId={workspaceId} />
}
