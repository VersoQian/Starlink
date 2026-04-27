'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { Database, Link2, ShieldCheck, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const CONFIDENCE_STYLES = {
  high: { label: '高可靠', width: '100%' },
  medium: { label: '中可靠', width: '66%' },
  low: { label: '低可靠', width: '33%' }
}

export const DataSourceNode = memo(function DataSourceNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const nodeData = macraNode || (data as MacraNodeData)

  const confidence = nodeData?.metadata?.confidence
  const confidenceStyle = confidence ? CONFIDENCE_STYLES[confidence] : null
  const tags = nodeData?.metadata?.tags ?? []

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: '#22d3ee',
          border: '2px solid rgb(2 6 23)'
        }}
      />

      <div
        className="group relative w-[340px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl transition-colors hover:border-white/[0.16]"
        style={{ boxShadow: 'inset 3px 0 0 0 #22d3ee' }}
      >
        <div className="relative border-b border-white/[0.06] bg-cyan-400/[0.06] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
                <Database className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-semibold text-white">
                  {nodeData?.label || '数据源节点'}
                </h3>
                <p className="mt-0.5 text-[11px] text-cyan-300/80">可信资料与研究输入</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {nodeData?.metadata?.agent_signature && (
                <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-medium text-cyan-200">
                  {nodeData.metadata.agent_signature}
                </span>
              )}
              <Sparkles className="h-3 w-3 text-cyan-300" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="prose prose-sm prose-invert max-h-52 max-w-none overflow-y-auto rounded-md border border-white/[0.06] bg-slate-950/40 p-3 text-slate-200">
            <ReactMarkdown>{nodeData?.content || '*等待数据源描述*'}</ReactMarkdown>
          </div>

          {nodeData?.metadata?.source && (
            <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-cyan-400/[0.06] px-3 py-2 text-[11px] text-cyan-100">
              <Link2 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{nodeData.metadata.source}</span>
            </div>
          )}

          {confidenceStyle && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">可信度</span>
                <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-200">
                  {confidenceStyle.label}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: confidenceStyle.width }}
                />
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="rounded border border-cyan-400/25 bg-cyan-400/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-cyan-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {nodeData?.metadata?.source && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3 w-3 text-cyan-300" strokeWidth={1.75} />
              <span>已验证数据来源</span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: '#22d3ee',
          border: '2px solid rgb(2 6 23)'
        }}
      />
    </>
  )
})
