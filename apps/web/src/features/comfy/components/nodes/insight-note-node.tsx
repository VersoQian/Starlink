'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { Lightbulb, Edit3, Check, X, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export function InsightNoteNode({ id, data }: NodeProps) {
  const { getMacraNode, updateMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(nodeData?.content || '')
  const [editedLabel, setEditedLabel] = useState(nodeData?.label || '')
  const [isHovered, setIsHovered] = useState(false)

  const handleSave = useCallback(() => {
    updateMacraNode(id, {
      content: editedContent,
      label: editedLabel
    })
    setIsEditing(false)
  }, [id, editedContent, editedLabel, updateMacraNode])

  const handleCancel = useCallback(() => {
    setEditedContent(nodeData?.content || '')
    setEditedLabel(nodeData?.label || '')
    setIsEditing(false)
  }, [nodeData])

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
        }}
      />

      <div
        className="w-[400px] rounded-3xl overflow-hidden transition-all duration-500 hover:scale-105 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isHovered
            ? '0 20px 60px -15px rgba(59, 130, 246, 0.6), 0 0 0 1px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
            : '0 10px 30px -10px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 装饰性光晕效果 */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl"
          style={{
            background: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.2), transparent 70%)'
          }}
        />

        {/* 顶部栏 */}
        <div
          className="relative px-6 py-5 border-b border-white/10"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))'
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div
                className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg text-2xl transform group-hover:rotate-12 transition-transform duration-300 border-2 border-white/20"
                style={{ boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)' }}
              >
                <Lightbulb className="w-7 h-7 text-white" />
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 text-sm font-bold bg-white/10 rounded-xl px-3 py-2 border border-white/20 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/30 shadow-inner text-white placeholder-slate-400"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  placeholder="洞察标题"
                  autoFocus
                />
              ) : (
                <div className="flex-1">
                  <h3 className="text-base font-black text-white flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                    {nodeData?.label || '洞察便签'}
                    {nodeData?.metadata?.agent_signature && (
                      <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                    )}
                  </h3>
                  {nodeData?.metadata?.agent_signature && (
                    <p className="text-xs text-blue-300 mt-1 font-medium" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      来自 {nodeData.metadata.agent_signature}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-blue-400 backdrop-blur-sm border border-transparent hover:border-white/20"
                  title="编辑"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-all text-emerald-400 border border-emerald-400/30 shadow-lg"
                    title="保存"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 transition-all text-pink-400 border border-pink-400/30 shadow-lg"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-6 relative space-y-4">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入洞察内容（支持 Markdown）..."
              className="w-full h-48 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 shadow-inner placeholder-slate-500 text-slate-200 backdrop-blur-sm"
            />
          ) : (
            <div className="prose prose-sm prose-invert max-w-none text-slate-300 min-h-[120px] max-h-72 overflow-y-auto leading-relaxed bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner">
              <ReactMarkdown>
                {nodeData?.content || '*这里将展示AI生成的洞察和建议*'}
              </ReactMarkdown>
            </div>
          )}

          {/* 置信度指示器 */}
          {nodeData?.metadata?.confidence && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                置信度:
              </span>
              <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/10">
                <div
                  className="h-full transition-all rounded-full"
                  style={{
                    width: nodeData.metadata.confidence === 'high' ? '100%' :
                           nodeData.metadata.confidence === 'medium' ? '66%' : '33%',
                    background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                    boxShadow: '0 0 12px rgba(59, 130, 246, 0.6)'
                  }}
                />
              </div>
              <span
                className="px-3 py-1 rounded-lg text-xs font-bold border shadow-sm"
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#3b82f6',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                {nodeData.metadata.confidence}
              </span>
            </div>
          )}

          {/* 数据来源 */}
          {nodeData?.metadata?.source && (
            <div
              className="rounded-xl px-4 py-3 border"
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 0.2)'
              }}
            >
              <p className="text-xs text-slate-300" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <span className="font-semibold text-blue-400">来源: </span>
                {nodeData.metadata.source}
              </p>
            </div>
          )}

          {/* 标签 */}
          {nodeData?.metadata?.tags && nodeData.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nodeData.metadata.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border backdrop-blur-sm"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: '#93c5fd',
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 底部装饰线 */}
        <div
          className="h-1"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.8), rgba(37, 99, 235, 0.6), transparent)'
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
        }}
      />
    </>
  )
}
