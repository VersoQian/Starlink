'use client'

import type { NodeProps } from 'reactflow'
import type { CanvasNodeData } from '@/types/graph'
import { NodeCard } from './node-card'

type ReferenceNodeData = Extract<CanvasNodeData, { type: 'reference' }>

export function ReferenceNode({ data }: NodeProps<ReferenceNodeData>) {
  return (
    <div data-testid="canvas-node-reference">
      <NodeCard
        icon="🔖"
        title={data.title}
        subtitle={data.source}
        footer={<span className="text-xs text-[#7C80A9]">点击查看原文</span>}
      >
        <div className="space-y-2 rounded-2xl bg-[#EFF3FF] px-4 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-700">来源：{data.source}</p>
          <p className="text-slate-500">位置：{data.location}</p>
        </div>
      </NodeCard>
    </div>
  )
}
