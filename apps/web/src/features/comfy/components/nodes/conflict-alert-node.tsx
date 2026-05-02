'use client'

/**
 * ConflictAlertNode — Editorial Boardroom v2 (2026-05-02).
 *
 * The ONE node type that earns a press-red border on the canvas.
 * Press-red is reserved across the whole v2 system for "needs human
 * decision" surfaces — debate active, HITL pending, AND conflicts
 * surfaced by the critic. Severity differentiation is now via
 * stroke weight + a single mono kicker label, not via 3 different
 * gradient palettes (rose / amber / yellow in v1).
 *
 *   high   → 1.5 px press border + "HIGH" kicker
 *   medium → 1 px   press border + "MID"  kicker
 *   low    → 0.5 px press border + "LOW"  kicker (almost invisible —
 *           by design; low severity shouldn't draw the eye)
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const SEVERITY_LABEL = {
  high:   'HIGH',
  medium: 'MID',
  low:    'LOW',
} as const

const SEVERITY_BORDER = {
  high:   'border-[1.5px] border-press',
  medium: 'border-[1px]   border-press/70',
  low:    'border-[0.5px] border-press/40',
} as const

const CONFLICT_TYPE_LABELS: Record<NonNullable<MacraNodeData['conflictType']>, string> = {
  'resource-goal':       '资源-目标冲突',
  'compliance-business': '合规-业务冲突',
  'channel-product':     '渠道-产品冲突',
  other:                 '其他冲突',
}

const HANDLE_BASE =
  'h-2 w-2 !border-[0.5px] !border-paper/40 !bg-ink-ash2'

export const ConflictAlertNode = memo(function ConflictAlertNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const nodeData = macraNode || (data as MacraNodeData)

  const severity = nodeData?.severity || 'medium'
  const conflictType = nodeData?.conflictType
  const conflictLabel = conflictType ? CONFLICT_TYPE_LABELS[conflictType] : null

  return (
    <>
      <Handle type="target" position={Position.Top}    className={HANDLE_BASE} />

      <article
        className={[
          'relative w-[320px] bg-ink-ash1 font-body text-paper',
          'transition-[border-color,opacity] duration-100 ease-out',
          SEVERITY_BORDER[severity],
        ].join(' ')}
      >
        {/* Header — press kicker + label + conflict type */}
        <header className="flex items-baseline gap-2 px-4 pt-3 pb-2 border-b-[0.5px] border-ink-ash3/30">
          <AlertTriangle className="h-3.5 w-3.5 text-press shrink-0" strokeWidth={1.75} />
          <span className="font-instr text-[10px] uppercase tracking-kicker text-press">
            CONFLICT · {SEVERITY_LABEL[severity]}
          </span>
          {conflictLabel ? (
            <span className="ml-auto font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 truncate">
              {conflictLabel}
            </span>
          ) : null}
        </header>

        {/* Title — Fraunces */}
        <div className="px-4 pt-3 pb-2">
          <h3
            className="font-display font-[700] text-[15px] tracking-[0.02em] leading-tight text-paper"
            title={nodeData?.label || ''}
          >
            {nodeData?.label || '冲突警示'}
          </h3>
        </div>

        {/* Body — markdown content */}
        <div className="px-4 pb-3 border-t-[1px] border-ink-ash2/40">
          <div className="prose prose-sm prose-invert font-body text-[12px] leading-[1.55] text-paper/85 max-h-52 max-w-measure-cell overflow-y-auto pt-3">
            <ReactMarkdown>{nodeData?.content || '*暂无冲突详情*'}</ReactMarkdown>
          </div>
        </div>

        {/* Footer — detected by */}
        {nodeData?.metadata?.agent_signature ? (
          <footer className="flex items-baseline gap-2 px-4 pt-2 pb-2 border-t-[0.5px] border-ink-ash3/30 font-instr text-[10px] uppercase tracking-kicker">
            <span className="text-ink-ash4">DETECTED BY</span>
            <span className="text-byline-critic">{nodeData.metadata.agent_signature}</span>
          </footer>
        ) : null}
      </article>

      <Handle type="source" position={Position.Bottom} className={HANDLE_BASE} />
    </>
  )
})
