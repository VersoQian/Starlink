'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { AlertTriangle, Zap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const SEVERITY_CONFIG = {
  high: {
    label: '高风险',
    gradient: 'from-rose-500 to-red-500',
    accent: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.6)',
    icon: Zap
  },
  medium: {
    label: '中风险',
    gradient: 'from-amber-400 to-orange-500',
    accent: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.5)',
    icon: AlertTriangle
  },
  low: {
    label: '低风险',
    gradient: 'from-yellow-300 to-amber-400',
    accent: '#facc15',
    glow: 'rgba(250, 204, 21, 0.45)',
    icon: AlertTriangle
  }
}

const CONFLICT_TYPE_LABELS: Record<NonNullable<MacraNodeData['conflictType']>, string> = {
  'resource-goal': '资源-目标冲突',
  'compliance-business': '合规-业务冲突',
  'channel-product': '渠道-产品冲突',
  other: '其他冲突'
}

export const ConflictAlertNode = memo(function ConflictAlertNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const nodeData = macraNode || (data as MacraNodeData)

  const severity = nodeData?.severity || 'medium'
  const config = SEVERITY_CONFIG[severity]
  const Icon = config.icon
  const conflictType = nodeData?.conflictType
  const conflictLabel = conflictType ? CONFLICT_TYPE_LABELS[conflictType] : null

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 10,
          height: 10,
          background: config.accent,
          border: '2px solid rgb(2 6 23)'
        }}
      />

      <div
        className="group relative w-[320px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl transition-colors hover:border-white/[0.16]"
        style={{ boxShadow: `inset 3px 0 0 0 ${config.accent}` }}
      >
        <div
          className="relative border-b border-white/[0.06] px-4 py-3"
          style={{ background: `${config.accent}10` }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
              style={{ background: `${config.accent}18`, color: config.accent }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-white">
                  {nodeData?.label || '冲突警示'}
                </h3>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                  style={{ background: `${config.accent}18`, color: config.accent }}
                >
                  {config.label}
                </span>
              </div>
              {conflictLabel && (
                <p className="mt-0.5 text-[11px] text-slate-400">{conflictLabel}</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="prose prose-sm prose-invert max-h-52 max-w-none overflow-y-auto rounded-md border border-white/[0.06] bg-slate-950/40 p-3 text-slate-200">
            <ReactMarkdown>{nodeData?.content || '*暂无冲突详情*'}</ReactMarkdown>
          </div>

          {nodeData?.metadata?.agent_signature && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>检测者</span>
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: `${config.accent}15`, color: config.accent }}
              >
                {nodeData.metadata.agent_signature}
              </span>
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 10,
          height: 10,
          background: config.accent,
          border: '2px solid rgb(2 6 23)'
        }}
      />
    </>
  )
})
