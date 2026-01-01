'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { CC_BMC_DOMAINS, type CCBMCDomain, type MacraNodeData } from '@/types/macra'
import { Edit3, Check, X, Info, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// 紫色主题配色方案 - 柔和协调的渐变色系
const DOMAIN_COLORS: Record<CCBMCDomain, { main: string; light: string; accent: string; icon: string }> = {
  [CC_BMC_DOMAINS.CUSTOMER_SEGMENTS]: {
    main: '#8b5cf6', light: '#f5f3ff', accent: '#a78bfa', icon: '👥'
  },
  [CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS]: {
    main: '#7c3aed', light: '#f5f3ff', accent: '#8b5cf6', icon: '🤝'
  },
  [CC_BMC_DOMAINS.CHANNELS]: {
    main: '#6366f1', light: '#eef2ff', accent: '#818cf8', icon: '📡'
  },
  [CC_BMC_DOMAINS.VALUE_PROPOSITIONS]: {
    main: '#9333ea', light: '#faf5ff', accent: '#a855f7', icon: '💎'
  },
  [CC_BMC_DOMAINS.REVENUE_STREAMS]: {
    main: '#7c3aed', light: '#f5f3ff', accent: '#9333ea', icon: '💰'
  },
  [CC_BMC_DOMAINS.KEY_ACTIVITIES]: {
    main: '#8b5cf6', light: '#f5f3ff', accent: '#a78bfa', icon: '⚙️'
  },
  [CC_BMC_DOMAINS.KEY_RESOURCES]: {
    main: '#a855f7', light: '#faf5ff', accent: '#c084fc', icon: '🔑'
  },
  [CC_BMC_DOMAINS.KEY_PARTNERSHIPS]: {
    main: '#6366f1', light: '#eef2ff', accent: '#818cf8', icon: '🔗'
  },
  [CC_BMC_DOMAINS.COST_STRUCTURE]: {
    main: '#7c3aed', light: '#f5f3ff', accent: '#8b5cf6', icon: '📊'
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
        className="w-[320px] bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02]"
        style={{
          borderColor: colors.light,
          boxShadow: `0 1px 3px rgba(139, 92, 246, 0.1), 0 1px 2px rgba(139, 92, 246, 0.06), 0 0 0 3px ${colors.light}`
        }}
      >
        {/* 顶部栏 */}
        <div
          className="px-4 py-3 border-b border-purple-100 bg-gradient-to-r"
          style={{
            backgroundImage: `linear-gradient(to right, ${colors.light}, ${colors.light}ee)`
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xl">{colors.icon}</span>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 text-sm font-semibold bg-white rounded-lg px-2 py-1.5 border-2 border-purple-200 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 shadow-sm"
                  placeholder="标题"
                  autoFocus
                />
              ) : (
                <h3 className="text-sm font-bold text-slate-800 flex-1">{nodeData?.label || '未命名'}</h3>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="p-1.5 rounded-lg hover:bg-white/90 transition-all text-slate-500 hover:text-purple-600 hover:shadow-sm"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 rounded-lg hover:bg-white/90 transition-all text-slate-500 hover:text-purple-600 hover:shadow-sm"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="p-1.5 rounded-lg hover:bg-green-50 transition-all text-green-600 shadow-sm hover:shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-all text-red-600 shadow-sm hover:shadow"
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
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:bg-white/90 shadow-sm hover:shadow"
              style={{
                color: colors.main,
                backgroundColor: 'rgba(255, 255, 255, 0.6)'
              }}
            >
              <span>{domain}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showDomainSelector && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-purple-100 z-50 max-h-64 overflow-y-auto">
                {Object.values(CC_BMC_DOMAINS).map((d) => {
                  const dColor = DOMAIN_COLORS[d]
                  return (
                    <button
                      key={d}
                      onClick={() => handleDomainChange(d)}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-purple-50 transition-all flex items-center gap-2.5 first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <span className="text-base">{dColor.icon}</span>
                      <span className="flex-1 font-medium text-slate-700">{d}</span>
                      {d === domain && <Check className="w-3.5 h-3.5 text-purple-600" />}
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
              className="w-full h-32 bg-purple-50/50 border-2 border-purple-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 shadow-inner placeholder-slate-400"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-slate-700 min-h-[80px] max-h-40 overflow-y-auto">
              <ReactMarkdown>{nodeData?.content || '*暂无内容*'}</ReactMarkdown>
            </div>
          )}

          {/* 元数据 */}
          {showMetadata && nodeData?.metadata && (
            <div className="mt-3 pt-3 border-t border-purple-100 space-y-2.5">
              {nodeData.metadata.agent_signature && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">创建者:</span>
                  <span className="px-2.5 py-1 bg-purple-50 rounded-lg text-purple-700 font-medium shadow-sm">
                    {nodeData.metadata.agent_signature}
                  </span>
                </div>
              )}

              {nodeData.metadata.confidence && (
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold">置信度:</span>
                  <div className="flex-1 h-2 bg-purple-50 rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full transition-all rounded-full"
                      style={{
                        width: nodeData.metadata.confidence === 'high' ? '100%' :
                               nodeData.metadata.confidence === 'medium' ? '66%' : '33%',
                        background: `linear-gradient(to right, ${colors.main}, ${colors.accent})`
                      }}
                    />
                  </div>
                </div>
              )}

              {nodeData.metadata.source && (
                <div className="text-xs text-slate-600 bg-purple-50 rounded-lg px-2.5 py-1.5">
                  <span className="font-semibold">来源: </span>
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
