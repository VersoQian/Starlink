'use client'

import type { NodeProps } from 'reactflow'
import type { CanvasNodeData } from '@/types/graph'
import { NodeCard } from './node-card'

type DocumentNodeData = Extract<CanvasNodeData, { type: 'document' }>

const footerIcons = ['📎', '@', '🌐']

export function DocumentNode({ data }: NodeProps<DocumentNodeData>) {
  const summary = data.summary ?? ''
  const points = data.points && data.points.length > 0 ? data.points : summary ? summary.split(/\n+/) : []

  return (
    <div data-testid="canvas-node-document">
      <NodeCard
        icon="📄"
        title={data.title}
        subtitle={data.references ? `引用：${data.references}` : undefined}
        width={480}
        footer={
          <div className="flex items-center gap-3">
            {footerIcons.map((icon) => (
              <span key={icon} className="text-lg">
                {icon}
              </span>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {summary && (
            <p className="rounded-2xl bg-[#F5F6FF] px-5 py-4 text-sm leading-relaxed text-slate-700 shadow-inner">
              {summary}
            </p>
          )}
          {points.length > 0 && (
            <ol className="space-y-3 rounded-2xl bg-white px-2 py-2 text-sm text-slate-700">
              {points.slice(0, 3).map((point, index) => (
                <li key={index} className="flex gap-3 rounded-2xl px-3 py-2 hover:bg-[#F4F5FF]">
                  <span className="mt-0.5 text-base font-semibold text-[#9B87F5]">{index + 1}</span>
                  <span className="flex-1 leading-relaxed">{point}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </NodeCard>
    </div>
  )
}
