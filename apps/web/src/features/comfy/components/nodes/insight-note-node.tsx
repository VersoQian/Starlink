'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { type MacraNodeData } from '@/types/macra'
import { Lightbulb, Edit3, Check, X, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export const InsightNoteNode = memo(function InsightNoteNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const updateMacraNode = useComfyStore((state) => state.updateMacraNode)
  const nodeData = macraNode || (data as MacraNodeData)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(nodeData?.content || '')
  const [editedLabel, setEditedLabel] = useState(nodeData?.label || '')

  const handleSave = useCallback(() => {
    updateMacraNode(id, {
      content: editedContent,
      label: editedLabel
    })
    setIsEditing(false)
  }, [editedContent, editedLabel, id, updateMacraNode])

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
          width: 10,
          height: 10,
          background: '#60a5fa',
          border: '2px solid rgb(2 6 23)'
        }}
      />

      <div
        className="group relative w-[360px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl transition-colors hover:border-white/[0.16]"
        style={{ boxShadow: 'inset 3px 0 0 0 #60a5fa' }}
      >
        {/* 顶部栏 */}
        <div className="relative border-b border-white/[0.06] bg-blue-400/[0.06] px-4 py-3">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-400/15 text-blue-300">
                <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 rounded-md border border-white/[0.08] bg-slate-950/50 px-2 py-1.5 text-[13px] font-medium text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-300/20"
                  placeholder="洞察标题"
                  autoFocus
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
                    {nodeData?.label || '洞察便签'}
                    {nodeData?.metadata?.agent_signature && (
                      <Sparkles className="h-3 w-3 text-blue-300" strokeWidth={1.75} />
                    )}
                  </h3>
                  {nodeData?.metadata?.agent_signature && (
                    <p className="mt-0.5 text-[11px] text-blue-300/80">
                      来自 {nodeData.metadata.agent_signature}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                  aria-label="编辑"
                >
                  <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-emerald-300 transition-colors hover:bg-emerald-400/10"
                    aria-label="保存"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-rose-300 transition-colors hover:bg-rose-400/10"
                    aria-label="取消"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className="relative space-y-3 p-4">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入洞察内容（支持 Markdown）..."
              className="block h-40 w-full resize-none rounded-md border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-[12px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-300/20"
            />
          ) : (
            <div className="prose prose-sm prose-invert max-h-64 min-h-[100px] max-w-none overflow-y-auto rounded-md border border-white/[0.06] bg-slate-950/40 p-3 text-slate-200">
              <ReactMarkdown>
                {nodeData?.content || '*这里将展示AI生成的洞察和建议*'}
              </ReactMarkdown>
            </div>
          )}

          {/* 置信度指示器 */}
          {nodeData?.metadata?.confidence && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-slate-400">置信度</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                <div
                  className="h-full bg-blue-400 transition-all"
                  style={{
                    width:
                      nodeData.metadata.confidence === 'high'
                        ? '100%'
                        : nodeData.metadata.confidence === 'medium'
                          ? '66%'
                          : '33%'
                  }}
                />
              </div>
              <span className="rounded bg-blue-400/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-blue-300">
                {nodeData.metadata.confidence}
              </span>
            </div>
          )}

          {/* 数据来源 */}
          {nodeData?.metadata?.source && (
            <div className="rounded-md border border-white/[0.06] bg-blue-400/[0.06] px-3 py-2 text-[11px] text-slate-300">
              <span className="font-medium text-blue-300">来源 </span>
              {nodeData.metadata.source}
            </div>
          )}

          {/* 标签 */}
          {nodeData?.metadata?.tags && nodeData.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {nodeData.metadata.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="rounded border border-blue-400/25 bg-blue-400/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-blue-200"
                >
                  {tag}
                </span>
              ))}
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
          background: '#60a5fa',
          border: '2px solid rgb(2 6 23)'
        }}
      />
    </>
  )
})
