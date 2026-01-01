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
        className="w-3 h-3 bg-purple-500 border-2 border-white shadow-md"
      />

      <Card className="w-96 shadow-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50 relative overflow-hidden hover:shadow-2xl transition-all duration-300 rounded-2xl">
        {/* 装饰性背景 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200/30 to-transparent rounded-full blur-2xl" />

        <CardHeader className="pb-3 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-400 to-purple-500 shadow-lg">
                <Lightbulb className="w-5 h-5 text-white" />
              </div>

              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 text-sm font-semibold bg-white/80 border-2 border-purple-200 rounded-lg px-2 py-1.5 text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm"
                  placeholder="洞察标题"
                />
              ) : (
                <div className="flex-1">
                  <CardTitle className="text-sm text-purple-900 font-bold flex items-center gap-2">
                    {nodeData?.label || '洞察便签'}
                    {nodeData?.metadata?.agent_signature === 'Orchestrator' && (
                      <Sparkles className="w-4 h-4 text-purple-500" />
                    )}
                  </CardTitle>
                  {nodeData?.metadata?.agent_signature && (
                    <p className="text-xs text-purple-600 mt-0.5 font-medium">
                      来自 {nodeData.metadata.agent_signature}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-purple-100 transition-all text-purple-600 hover:shadow-sm"
                  title="编辑"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="p-1.5 rounded-lg hover:bg-green-100 transition-all text-green-600 shadow-sm hover:shadow"
                    title="保存"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg hover:bg-red-100 transition-all text-red-600 shadow-sm hover:shadow"
                    title="取消"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 relative z-10">
          {/* 内容区域 */}
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入洞察内容（支持 Markdown）..."
              className="w-full h-40 bg-white/80 border-2 border-purple-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-inner"
            />
          ) : (
            <div className="prose prose-sm max-w-none bg-white/70 backdrop-blur-sm rounded-xl p-4 min-h-[100px] max-h-64 overflow-y-auto border-2 border-purple-100 shadow-sm">
              <ReactMarkdown>
                {nodeData?.content || '*这里将展示AI生成的洞察和建议*'}
              </ReactMarkdown>
            </div>
          )}

          {/* 置信度指示器 */}
          {nodeData?.metadata?.confidence && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-700 font-semibold">置信度:</span>
              <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full bg-gradient-to-r from-purple-400 to-purple-500 transition-all rounded-full ${
                    nodeData.metadata.confidence === 'high' ? 'w-full' :
                    nodeData.metadata.confidence === 'medium' ? 'w-2/3' :
                    'w-1/3'
                  }`}
                />
              </div>
              <Badge
                variant={nodeData.metadata.confidence === 'high' ? 'default' : 'secondary'}
                className="text-xs bg-purple-100 text-purple-700 border-purple-200"
              >
                {nodeData.metadata.confidence}
              </Badge>
            </div>
          )}

          {/* 数据来源 */}
          {nodeData?.metadata?.source && (
            <div className="bg-white/60 rounded-xl p-2.5 border-2 border-purple-100 shadow-sm">
              <p className="text-xs text-purple-700">
                <span className="font-semibold">来源: </span>
                {nodeData.metadata.source}
              </p>
            </div>
          )}

          {/* 标签 */}
          {nodeData?.metadata?.tags && nodeData.metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {nodeData.metadata.tags.map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-white/60 border-purple-200 text-purple-700 shadow-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white shadow-md"
      />
    </>
  )
}
