'use client'

import { memo, useState } from 'react'
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
  const { getMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)
  const [isHovered, setIsHovered] = useState(false)

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
          background: `linear-gradient(135deg, ${config.accent}, ${config.accent}cc)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.glow}`
        }}
      />

      <div
        className="w-[340px] rounded-3xl overflow-hidden transition-all duration-500 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${config.accent}35`,
          boxShadow: isHovered
            ? `0 20px 60px -15px ${config.glow}, 0 0 0 1px ${config.accent}30, inset 0 1px 0 rgba(255,255,255,0.1)`
            : `0 10px 30px -10px ${config.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${config.accent}25, transparent 70%)`
          }}
        />

        <div
          className="relative px-5 py-4 border-b border-white/10"
          style={{
            background: `linear-gradient(135deg, ${config.accent}20, transparent)`
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${config.gradient} shadow-lg border-2 border-white/20`}
              style={{ boxShadow: `0 10px 30px ${config.glow}` }}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-white title-font">
                  {nodeData?.label || '冲突警示'}
                </h3>
                <span
                  className="px-3 py-1 rounded-full text-[11px] font-bold border"
                  style={{
                    background: `${config.accent}20`,
                    color: config.accent,
                    borderColor: `${config.accent}40`
                  }}
                >
                  {config.label}
                </span>
              </div>
              {conflictLabel && (
                <p className="text-xs text-slate-400 mt-1 mono-font">{conflictLabel}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-slate-200 bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner max-h-56 overflow-y-auto">
            <ReactMarkdown>{nodeData?.content || '*暂无冲突详情*'}</ReactMarkdown>
          </div>

          {nodeData?.metadata?.agent_signature && (
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="mono-font text-slate-400">检测者</span>
              <span
                className="px-3 py-1 rounded-lg text-[11px] font-bold border"
                style={{
                  background: `${config.accent}20`,
                  color: config.accent,
                  borderColor: `${config.accent}30`,
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                {nodeData.metadata.agent_signature}
              </span>
            </div>
          )}
        </div>

        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.accent}80, ${config.accent}60, transparent)`
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: `linear-gradient(135deg, ${config.accent}, ${config.accent}cc)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.glow}`
        }}
      />
    </>
  )
})
