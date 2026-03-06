'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { CC_BMC_DOMAINS, type CCBMCDomain, type MacraNodeData } from '@/types/macra'
import { Edit3, Check, X, Info, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

// 新配色方案 - Tech-Luxe Gradient
const DOMAIN_COLORS: Record<CCBMCDomain, { main: string; light: string; accent: string; icon: string; gradient: string }> = {
  [CC_BMC_DOMAINS.CUSTOMER_SEGMENTS]: {
    main: '#fbbf24', light: '#fef3c7', accent: '#f59e0b', icon: '👥',
    gradient: 'from-amber-400 to-amber-500'
  },
  [CC_BMC_DOMAINS.CUSTOMER_RELATIONSHIPS]: {
    main: '#10b981', light: '#d1fae5', accent: '#059669', icon: '🤝',
    gradient: 'from-emerald-400 to-emerald-500'
  },
  [CC_BMC_DOMAINS.CHANNELS]: {
    main: '#3b82f6', light: '#dbeafe', accent: '#2563eb', icon: '📡',
    gradient: 'from-blue-400 to-blue-500'
  },
  [CC_BMC_DOMAINS.VALUE_PROPOSITIONS]: {
    main: '#f59e0b', light: '#fef3c7', accent: '#d97706', icon: '💎',
    gradient: 'from-amber-500 to-orange-500'
  },
  [CC_BMC_DOMAINS.REVENUE_STREAMS]: {
    main: '#10b981', light: '#d1fae5', accent: '#059669', icon: '💰',
    gradient: 'from-emerald-500 to-green-500'
  },
  [CC_BMC_DOMAINS.KEY_ACTIVITIES]: {
    main: '#6366f1', light: '#e0e7ff', accent: '#4f46e5', icon: '⚙️',
    gradient: 'from-indigo-400 to-indigo-500'
  },
  [CC_BMC_DOMAINS.KEY_RESOURCES]: {
    main: '#8b5cf6', light: '#ede9fe', accent: '#7c3aed', icon: '🔑',
    gradient: 'from-violet-400 to-violet-500'
  },
  [CC_BMC_DOMAINS.KEY_PARTNERSHIPS]: {
    main: '#06b6d4', light: '#cffafe', accent: '#0891b2', icon: '🔗',
    gradient: 'from-cyan-400 to-cyan-500'
  },
  [CC_BMC_DOMAINS.COST_STRUCTURE]: {
    main: '#f472b6', light: '#fce7f3', accent: '#ec4899', icon: '📊',
    gradient: 'from-pink-400 to-pink-500'
  }
}

export function CCBMCCardNode({ id, data }: NodeProps) {
  const { getMacraNode, updateMacraNode, openDetailPanel } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(nodeData?.content || '')
  const [editedLabel, setEditedLabel] = useState(nodeData?.label || '')
  const [showMetadata, setShowMetadata] = useState(false)
  const [showDomainSelector, setShowDomainSelector] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false) // 展开/折叠状态

  const domain = nodeData?.domain || CC_BMC_DOMAINS.VALUE_PROPOSITIONS
  const colors = DOMAIN_COLORS[domain]
  const rawData = data as Record<string, unknown>
  const meta = rawData.meta as { summary?: string; fullContent?: string } | undefined

  // 从 meta 中获取 summary 和 fullContent
  const summary = meta?.summary || nodeData?.content || ''
  const fullContent = meta?.fullContent || nodeData?.content || ''
  const hasExtendedContent = summary !== fullContent && fullContent.length > summary.length

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
          background: `linear-gradient(135deg, ${colors.main}, ${colors.accent})`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${colors.main}40`
        }}
      />

      <div
        className="w-[360px] rounded-3xl overflow-hidden transition-all duration-500 hover:scale-105 relative group"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isHovered
            ? `0 20px 60px -15px ${colors.main}60, 0 0 0 1px ${colors.main}20, inset 0 1px 0 rgba(255,255,255,0.1)`
            : `0 10px 30px -10px ${colors.main}30, inset 0 1px 0 rgba(255,255,255,0.05)`
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 装饰性光晕效果 */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${colors.main}20, transparent 70%)`
          }}
        />

        {/* 顶部栏 */}
        <div
          className="relative px-5 py-4 border-b border-white/10"
          style={{
            background: `linear-gradient(135deg, ${colors.main}15, ${colors.accent}05)`
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${colors.gradient} shadow-lg text-2xl transform group-hover:rotate-12 transition-transform duration-300`}
                style={{ boxShadow: `0 8px 24px ${colors.main}40` }}
              >
                {colors.icon}
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 text-sm font-bold bg-white/10 rounded-xl px-3 py-2 border border-white/20 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/30 shadow-inner text-white placeholder-slate-400"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  placeholder="标题"
                  autoFocus
                />
              ) : (
                <h3 className="text-base font-black text-white flex-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  {nodeData?.label || '未命名'}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="p-2 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-amber-400 backdrop-blur-sm border border-transparent hover:border-white/20"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-emerald-400 backdrop-blur-sm border border-transparent hover:border-white/20"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 transition-all text-emerald-400 border border-emerald-400/30 shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 transition-all text-pink-400 border border-pink-400/30 shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 维度标签 */}
          <div className="relative">
            <button
              onClick={() => setShowDomainSelector(!showDomainSelector)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all backdrop-blur-sm border`}
              style={{
                background: `linear-gradient(135deg, ${colors.main}20, ${colors.accent}10)`,
                color: colors.main,
                borderColor: `${colors.main}30`,
                fontFamily: 'Outfit, sans-serif'
              }}
            >
              <span className="uppercase">{domain}</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showDomainSelector && (
              <div
                className="absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border z-50 max-h-72 overflow-y-auto backdrop-blur-xl"
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                {Object.values(CC_BMC_DOMAINS).map((d) => {
                  const dColor = DOMAIN_COLORS[d]
                  return (
                    <button
                      key={d}
                      onClick={() => handleDomainChange(d)}
                      className="w-full px-4 py-3 text-left text-xs hover:bg-white/10 transition-all flex items-center gap-3 first:rounded-t-2xl last:rounded-b-2xl border-b border-white/5 last:border-0"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${dColor.gradient} flex items-center justify-center text-lg shadow-lg`}
                        style={{ boxShadow: `0 4px 12px ${dColor.main}40` }}
                      >
                        {dColor.icon}
                      </div>
                      <span className="flex-1 font-bold text-slate-200 uppercase tracking-wide" style={{ fontFamily: 'Outfit, sans-serif' }}>
                        {d}
                      </span>
                      {d === domain && (
                        <Check className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className="p-5 relative">
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              placeholder="输入内容（支持 Markdown）"
              className="w-full h-36 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 shadow-inner placeholder-slate-500 text-slate-200 backdrop-blur-sm"
            />
          ) : (
            <>
              <div
                className={`prose prose-sm prose-invert max-w-none text-slate-300 overflow-hidden leading-relaxed transition-all duration-300 ${isExpanded ? 'max-h-none' : 'max-h-32'}`}
              >
                <ReactMarkdown>{isExpanded ? fullContent : summary || '*暂无内容*'}</ReactMarkdown>
              </div>

              {/* 展开/折叠按钮 */}
              {hasExtendedContent && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all backdrop-blur-sm border hover:scale-105`}
                  style={{
                    background: `linear-gradient(135deg, ${colors.main}15, ${colors.accent}10)`,
                    color: colors.main,
                    borderColor: `${colors.main}30`,
                    fontFamily: 'Outfit, sans-serif'
                  }}
                >
                  {isExpanded ? (
                    <>
                      <Minimize2 className="w-4 h-4" />
                      <span>收起详情</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4" />
                      <span>展开详情</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* 元数据 */}
          {showMetadata && nodeData?.metadata && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              {nodeData.metadata.agent_signature && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>创建者:</span>
                  <span
                    className="px-3 py-1.5 rounded-lg font-bold shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${colors.main}20, ${colors.accent}10)`,
                      color: colors.main,
                      border: `1px solid ${colors.main}30`,
                      fontFamily: 'JetBrains Mono, monospace'
                    }}
                  >
                    {nodeData.metadata.agent_signature}
                  </span>
                </div>
              )}

              {nodeData.metadata.confidence && (
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="font-semibold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>置信度:</span>
                  <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden shadow-inner border border-white/10">
                    <div
                      className="h-full transition-all rounded-full"
                      style={{
                        width: nodeData.metadata.confidence === 'high' ? '100%' :
                               nodeData.metadata.confidence === 'medium' ? '66%' : '33%',
                        background: `linear-gradient(90deg, ${colors.main}, ${colors.accent})`,
                        boxShadow: `0 0 12px ${colors.main}60`
                      }}
                    />
                  </div>
                </div>
              )}

              {nodeData.metadata.source && (
                <div
                  className="text-xs text-slate-300 rounded-xl px-3 py-2 border"
                  style={{
                    background: `${colors.main}10`,
                    borderColor: `${colors.main}20`,
                    fontFamily: 'JetBrains Mono, monospace'
                  }}
                >
                  <span className="font-semibold">来源: </span>
                  <span>{nodeData.metadata.source}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部署名栏 */}
        <div
          className="px-5 py-3 border-t border-white/10 flex items-center justify-between"
          style={{
            background: `linear-gradient(135deg, ${colors.main}08, ${colors.accent}05)`
          }}
        >
          {/* Agent 署名 */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
              style={{
                background: `linear-gradient(135deg, ${colors.main}30, ${colors.accent}20)`,
                boxShadow: `0 2px 8px ${colors.main}40`
              }}
            >
              🤖
            </div>
            <span className="text-xs text-slate-400" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              by{' '}
              <span className="font-bold" style={{ color: colors.main }}>
                {nodeData?.metadata?.agent_signature || 'AI Agent'}
              </span>
            </span>
            {nodeData?.metadata?.confidence && (
              <div
                className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: `${colors.main}20`,
                  color: colors.main,
                  border: `1px solid ${colors.main}30`
                }}
              >
                {nodeData.metadata.confidence}
              </div>
            )}
          </div>

          {/* 查看详情按钮 */}
          <button
            onClick={() => {
              console.log('[CCBMCCardNode] Opening detail panel for node:', id)
              openDetailPanel(id)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 backdrop-blur-sm border"
            style={{
              background: `linear-gradient(135deg, ${colors.main}15, ${colors.accent}10)`,
              color: colors.main,
              borderColor: `${colors.main}30`,
              fontFamily: 'Outfit, sans-serif'
            }}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>详情</span>
          </button>
        </div>

        {/* 底部装饰线 */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${colors.main}60, ${colors.accent}60, transparent)`
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: `linear-gradient(135deg, ${colors.main}, ${colors.accent})`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${colors.main}40`
        }}
      />
    </>
  )
}
