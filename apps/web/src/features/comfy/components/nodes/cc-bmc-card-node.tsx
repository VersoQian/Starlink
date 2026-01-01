'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { CC_BMC_DOMAINS, type CCBMCDomain, type MacraNodeData } from '@/types/macra'
import { Edit3, Check, X, Info, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// 专业的商业配色方案 - 更低饱和度、更高级
const DOMAIN_COLORS: Record<CCBMCDomain, { main: string; light: string; accent: string; icon: string }> = {
  [CC_BMC_DOMAINS.CUSTOMER_SEGMENTS]: {
    main: '#2563eb', light: '#eff6ff', accent: '#3b82f6', icon: '👥'
  },
  [CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS]: {
    main: '#7c3aed', light: '#f5f3ff', accent: '#8b5cf6', icon: '🤝'
  },
  [CC_BMC_DOMAINS.CHANNELS]: {
    main: '#059669', light: '#ecfdf5', accent: '#10b981', icon: '📡'
  },
  [CC_BMC_DOMAINS.VALUE_PROPOSITIONS]: {
    main: '#dc2626', light: '#fef2f2', accent: '#ef4444', icon: '💎'
  },
  [CC_BMC_DOMAINS.REVENUE_STREAMS]: {
    main: '#16a34a', light: '#f0fdf4', accent: '#22c55e', icon: '💰'
  },
  [CC_BMC_DOMAINS.KEY_ACTIVITIES]: {
    main: '#ca8a04', light: '#fefce8', accent: '#eab308', icon: '⚙️'
  },
  [CC_BMC_DOMAINS.KEY_RESOURCES]: {
    main: '#db2777', light: '#fdf2f8', accent: '#ec4899', icon: '🔑'
  },
  [CC_BMC_DOMAINS.KEY_PARTNERSHIPS]: {
    main: '#4f46e5', light: '#eef2ff', accent: '#6366f1', icon: '🔗'
  },
  [CC_BMC_DOMAINS.COST_STRUCTURE]: {
    main: '#dc2626', light: '#fef2f2', accent: '#f87171', icon: '📊'
  }
}

export function CCBMCCardNode({ id, data }: NodeProps) {
  const { getMacraNode, updateMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(nodeData?.content || '')
  const [editedLabel, setEditedLabel] = useState(nodeData?.label || '')
  const [showMetadata, setShowMetadata] = useState(false)
  const [showDomainSelector, setShowDomainSelector] = useState(false)

  const domain = nodeData?.domain || CC_BMC_DOMAINS.VALUE_PROPOSITIONS
  const colors = DOMAIN_COLORS[domain]

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

  const handleDomainChange = useCallback((newDomain: CCBMCDomain) => {
    updateMacraNode(id, { domain: newDomain })
    setShowDomainSelector(false)
  }, [id, updateMacraNode])

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: colors.main,
          width: 8,
          height: 8,
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />

      <div
        className="w-[320px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-xl"
        style={{ borderTopColor: colors.main, borderTopWidth: 3 }}
      >
        {/* 顶部栏 */}
        <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: colors.light }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xl">{colors.icon}</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 text-sm font-semibold bg-white rounded px-2 py-1 border border-gray-300 focus:outline-none focus:border-blue-500"
                  placeholder="标题"
                  autoFocus
                />
              ) : (
                <h3 className="text-sm font-semibold text-gray-900 flex-1">{nodeData?.label || '未命名'}</h3>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="p-1.5 rounded hover:bg-white/80 transition text-gray-500"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded hover:bg-white/80 transition text-gray-500"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="p-1.5 rounded hover:bg-green-50 transition text-green-600"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 rounded hover:bg-red-50 transition text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 维度标签 */}
          <div className="relative">
            <button
              onClick={() => setShowDomainSelector(!showDomainSelector)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-medium transition hover:bg-white/80"
              style={{ color: colors.main }}
            >
              <span>{domain}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showDomainSelector && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-64 overflow-y-auto">
                {Object.values(CC_BMC_DOMAINS).map((d) => {
                  const dColor = DOMAIN_COLORS[d]
                  return (
                    <button
                      key={d}
                      onClick={() => handleDomainChange(d)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition flex items-center gap-2"
                    >
                      <span>{dColor.icon}</span>
                      <span className="flex-1">{d}</span>
                      {d === domain && <Check className="w-3.5 h-3.5 text-blue-500" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-4">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入内容（支持 Markdown）"
              className="w-full h-32 bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700 min-h-[80px] max-h-40 overflow-y-auto">
              <ReactMarkdown>{nodeData?.content || '*暂无内容*'}</ReactMarkdown>
            </div>
          )}

          {/* 元数据 */}
          {showMetadata && nodeData?.metadata && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {nodeData.metadata.agent_signature && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium">创建者:</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                    {nodeData.metadata.agent_signature}
                  </span>
                </div>
              )}

              {nodeData.metadata.confidence && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="font-medium">置信度:</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: nodeData.metadata.confidence === 'high' ? '100%' :
                               nodeData.metadata.confidence === 'medium' ? '66%' : '33%',
                        backgroundColor: colors.main
                      }}
                    />
                  </div>
                </div>
              )}

              {nodeData.metadata.source && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">来源: </span>
                  <span>{nodeData.metadata.source}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: colors.main,
          width: 8,
          height: 8,
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
    </>
  )
}
