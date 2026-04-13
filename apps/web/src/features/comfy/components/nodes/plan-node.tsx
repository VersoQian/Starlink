'use client'

import { memo, useCallback, useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import ReactMarkdown from 'react-markdown'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { ClipboardCheck, CheckCircle2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_STYLES = {
  pending: {
    label: '待确认',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-400/30'
  },
  confirmed: {
    label: '已确认',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
  },
  'needs-clarification': {
    label: '需补充',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-400/30'
  }
}

export const PlanNode = memo(function PlanNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const updateMacraNode = useComfyStore((state) => state.updateMacraNode)
  const nodeData = macraNode || (data as MacraNodeData)
  const [isExpanded, setIsExpanded] = useState(false)

  const metadata = nodeData?.metadata || {}
  const status = metadata.semantic_status || 'pending'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  const label = nodeData?.label || '语义确认'
  const summary = nodeData?.summary || nodeData?.content || ''
  const fullContent = nodeData?.fullContent || summary
  const canExpand = fullContent && fullContent !== summary

  const updateStatus = useCallback((nextStatus: MacraNodeData['metadata']['semantic_status']) => {
    if (!nodeData) return
    updateMacraNode(id, {
      metadata: {
        ...nodeData.metadata,
        semantic_status: nextStatus
      }
    })
  }, [id, nodeData, updateMacraNode])

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
        }}
      />

      <div
        className="w-[360px] rounded-3xl overflow-hidden transition-all duration-500 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          boxShadow: '0 16px 40px -12px rgba(99, 102, 241, 0.35)'
        }}
      >
        <div
          className="relative px-5 py-4 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.05))'
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg border border-white/20">
                <ClipboardCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-black text-white title-font">{label}</h3>
                <p className="text-xs text-slate-400 mt-1">语义确认 · 计划节点</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${statusStyle.badge}`}>
                {statusStyle.label}
              </span>
              {canExpand && (
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="p-2 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  title={isExpanded ? '收起' : '展开'}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-slate-200 bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner">
            <ReactMarkdown>
              {isExpanded ? fullContent : summary || '*暂无语义确认内容*'}
            </ReactMarkdown>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => updateStatus('confirmed')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              确认语义
            </button>
            <button
              onClick={() => updateStatus('needs-clarification')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              需要补充
            </button>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
        }}
      />
    </>
  )
})
