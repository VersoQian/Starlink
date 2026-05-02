'use client'

/**
 * DataSourceNode — Editorial Boardroom v2 (2026-05-02).
 *
 * KB documents / external references that agents cite. Visual marker
 * is a small Database icon (NOT cyan-tinted) and a "SOURCE" mono
 * kicker — reads as "footnote on a page", not as a glowing data
 * widget.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { Database, Link2, ShieldCheck } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const HANDLE_BASE =
  'h-2 w-2 !border-[0.5px] !border-paper/40 !bg-ink-ash2'

const CONFIDENCE_BAND: Record<'high' | 'medium' | 'low', { label: string; width: string }> = {
  high:   { label: 'HIGH', width: '100%' },
  medium: { label: 'MID',  width: '66%'  },
  low:    { label: 'LOW',  width: '33%'  },
}

export const DataSourceNode = memo(function DataSourceNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const nodeData = macraNode || (data as MacraNodeData)

  const confidence = nodeData?.metadata?.confidence as 'high' | 'medium' | 'low' | undefined
  const confidenceStyle = confidence ? CONFIDENCE_BAND[confidence] : null
  const tags = nodeData?.metadata?.tags ?? []

  return (
    <>
      <Handle type="target" position={Position.Left} className={HANDLE_BASE} />

      <article className="relative w-[340px] bg-ink-ash1 border-[1px] border-ink-ash3/30 hover:border-ink-ash2/60 transition-colors">
        {/* Header — kicker SOURCE + Database icon + agent badge */}
        <header className="flex items-baseline gap-3 px-4 pt-3 pb-2 border-b-[0.5px] border-ink-ash3/30">
          <Database className="h-3.5 w-3.5 text-paper-ash3 shrink-0 self-center" strokeWidth={1.5} />
          <span className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
            SOURCE
          </span>
          {nodeData?.metadata?.agent_signature ? (
            <span className="ml-auto font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 truncate">
              via {nodeData.metadata.agent_signature}
            </span>
          ) : null}
        </header>

        {/* Title — Fraunces */}
        <div className="px-4 pt-3 pb-2">
          <h3
            className="font-display font-[700] text-[15px] tracking-[0.02em] leading-tight text-paper truncate"
            title={nodeData?.label || ''}
          >
            {nodeData?.label || '数据源节点'}
          </h3>
          <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 mt-1">
            可信资料与研究输入
          </p>
        </div>

        {/* Body */}
        <div className="px-4 pb-3 space-y-3 border-t-[1px] border-ink-ash2/40 pt-3">
          <div className="prose prose-sm prose-invert font-body text-[13px] leading-[1.55] text-paper/85 max-h-52 max-w-measure-cell overflow-y-auto">
            <ReactMarkdown>{nodeData?.content || '*等待数据源描述*'}</ReactMarkdown>
          </div>

          {/* Source URL/path — single hairline left border, mono */}
          {nodeData?.metadata?.source ? (
            <div className="flex items-baseline gap-2 font-instr text-[11px] text-paper border-l-[1.5px] border-ink-ash3/40 pl-2 py-1">
              <Link2 className="h-3 w-3 shrink-0 text-ink-ash4 self-center" strokeWidth={1.5} />
              <span className="truncate">{nodeData.metadata.source}</span>
            </div>
          ) : null}

          {/* Confidence */}
          {confidenceStyle ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between font-instr text-[10px] uppercase tracking-kicker">
                <span className="text-paper-ash3">可信度</span>
                <span className="text-paper">{confidenceStyle.label}</span>
              </div>
              <div className="h-1 bg-ink-ash2/40 overflow-hidden">
                <div
                  className="h-full bg-paper-ash3 transition-all"
                  style={{ width: confidenceStyle.width }}
                />
              </div>
            </div>
          ) : null}

          {/* Tags */}
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="border-[0.5px] border-ink-ash3/40 px-1.5 py-0.5 font-instr text-[10px] uppercase tracking-kicker text-paper-ash3"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Verified marker — single quiet line */}
          {nodeData?.metadata?.source ? (
            <div className="flex items-center gap-1.5 font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
              <ShieldCheck className="h-3 w-3 text-paper-ash3" strokeWidth={1.5} />
              <span>已验证数据来源</span>
            </div>
          ) : null}
        </div>
      </article>

      <Handle type="source" position={Position.Right} className={HANDLE_BASE} />
    </>
  )
})
