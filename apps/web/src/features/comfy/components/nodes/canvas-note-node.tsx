'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import ReactMarkdown from 'react-markdown'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import type { CanvasNodeData } from '@/types/graph'

const renderContent = (data: CanvasNodeData) => {
  switch (data.type) {
    case 'note':
      return (
        <>
          <div className="prose prose-invert prose-sm max-w-none text-slate-300">
            <ReactMarkdown>{data.content}</ReactMarkdown>
          </div>
          {data.bullets && data.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {data.bullets.map((bullet, index) => (
                <li key={index}>{bullet}</li>
              ))}
            </ul>
          )}
          {data.footerText && <p className="mt-3 text-xs text-slate-400">{data.footerText}</p>}
        </>
      )
    case 'document':
      return (
        <>
          <p className="text-sm text-slate-300">{data.summary}</p>
          {data.points && data.points.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {data.points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          )}
        </>
      )
    case 'task':
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p>状态: {data.status}</p>
          {data.assignee && <p>负责人: {data.assignee}</p>}
          {data.dueDate && <p>截止: {data.dueDate}</p>}
        </div>
      )
    case 'reference':
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <p>来源: {data.source}</p>
          <p>位置: {data.location}</p>
        </div>
      )
    case 'web':
      return (
        <div className="space-y-2 text-sm text-slate-300">
          {data.description && <p>{data.description}</p>}
          <a
            href={data.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-400 underline"
          >
            {data.url}
          </a>
        </div>
      )
    case 'image':
      return (
        <div className="space-y-2 text-sm text-slate-300">
          <a href={data.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">
            查看图片
          </a>
        </div>
      )
    default:
      return null
  }
}

export const CanvasNoteNode = memo(function CanvasNoteNode({ data }: NodeProps<CanvasNodeData>) {
  const title = 'title' in data ? data.title : '画布节点'

  return (
    <>
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500 border-2 border-zinc-900" />
      <Card className="w-96 bg-comfy-node border-comfy-nodeBorder shadow-lg comfy-node">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-zinc-100">{title}</CardTitle>
        </CardHeader>
        <CardContent>{renderContent(data)}</CardContent>
      </Card>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-zinc-900" />
    </>
  )
})
