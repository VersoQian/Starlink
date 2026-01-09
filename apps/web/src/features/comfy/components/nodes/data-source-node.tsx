'use client'

import { useState } from 'react'
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

export function DataSourceNode({ id, data }: NodeProps) {
  const { getMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)
  const [isHovered, setIsHovered] = useState(false)

  const confidence = nodeData?.metadata?.confidence
  const confidenceStyle = confidence ? CONFIDENCE_STYLES[confidence] : null
  const tags = nodeData?.metadata?.tags ?? []

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'linear-gradient(135deg, #22d3ee, #0ea5e9)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(34, 211, 238, 0.4)'
        }}
      />

      <div
        className="w-[360px] rounded-3xl overflow-hidden transition-all duration-500 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isHovered
            ? '0 20px 60px -15px rgba(34, 211, 238, 0.55), 0 0 0 1px rgba(34, 211, 238, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 10px 30px -10px rgba(34, 211, 238, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(34, 211, 238, 0.25), transparent 70%)'
          }}
        />

        <div
          className="relative px-6 py-5 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.18), rgba(14, 165, 233, 0.05))'
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 shadow-lg text-2xl transform group-hover:rotate-6 transition-transform duration-300 border-2 border-white/20"
                style={{ boxShadow: '0 10px 30px rgba(34, 211, 238, 0.45)' }}
              >
                <Database className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-black text-white title-font">
                  {nodeData?.label || '数据源节点'}
                </h3>
                <p className="text-xs text-cyan-200 mt-1 font-medium">可信资料与研究输入</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {nodeData?.metadata?.agent_signature && (
                <span className="px-3 py-1 rounded-full text-[11px] font-bold border border-cyan-400/30 text-cyan-200 bg-cyan-400/10 mono-font">
                  {nodeData.metadata.agent_signature}
                </span>
              )}
              <Sparkles className="w-4 h-4 text-cyan-300" />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="prose prose-sm prose-invert max-w-none text-slate-200 bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner max-h-52 overflow-y-auto">
            <ReactMarkdown>{nodeData?.content || '*等待数据源描述*'}</ReactMarkdown>
          </div>

          {nodeData?.metadata?.source && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 border border-cyan-400/20 bg-cyan-400/10">
              <Link2 className="w-4 h-4 text-cyan-300" />
              <span className="text-xs text-cyan-100 mono-font truncate">{nodeData.metadata.source}</span>
            </div>
          )}

          {confidenceStyle && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="mono-font text-slate-400">可信度</span>
                <span className="px-3 py-1 rounded-lg text-[11px] font-bold border border-cyan-400/30 text-cyan-200 bg-cyan-400/10">
                  {confidenceStyle.label}
                </span>
              </div>
              <div className="h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/10">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: confidenceStyle.width,
                    background: 'linear-gradient(90deg, #22d3ee, #0ea5e9)',
                    boxShadow: '0 0 12px rgba(34, 211, 238, 0.6)'
                  }}
                />
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border backdrop-blur-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(34, 211, 238, 0.35)',
                    color: '#bae6fd',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {nodeData?.metadata?.source && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-4 h-4 text-cyan-300" />
              <span className="mono-font">已验证数据来源</span>
            </div>
          )}
        </div>

        <div
          className="h-1"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.8), rgba(14, 165, 233, 0.6), transparent)'
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'linear-gradient(135deg, #22d3ee, #0ea5e9)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(34, 211, 238, 0.4)'
        }}
      />
    </>
  )
}
