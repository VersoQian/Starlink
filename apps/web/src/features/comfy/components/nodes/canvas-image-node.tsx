'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import type { CanvasNodeData } from '@/types/graph'

type ImageNodeData = Extract<CanvasNodeData, { type: 'image' }>

export function CanvasImageNode({ data }: NodeProps<ImageNodeData>) {
  if (data.type !== 'image') return null

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-purple-500 border-2 border-zinc-900" />
      <Card className="w-80 bg-comfy-node border-comfy-nodeBorder shadow-lg comfy-node">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-100">{data.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-zinc-700">
            <img src={data.url} alt={data.title} className="w-full object-cover" />
          </div>
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-blue-400 underline"
          >
            打开原图
          </a>
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-purple-500 border-2 border-zinc-900" />
    </>
  )
}
