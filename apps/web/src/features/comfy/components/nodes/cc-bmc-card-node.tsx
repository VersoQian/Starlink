'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { CC_BMC_DOMAINS, type CCBMCDomain, type MacraNodeData } from '@/types/macra'
import { Edit3, Check, X, Info, ChevronDown, Maximize2, Minimize2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { CitationBadge } from '../citation-badge'
import { useCardHighlightClass } from '../../hooks/use-citation-highlight'

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

export const CCBMCCardNode = memo(function CCBMCCardNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const updateMacraNode = useComfyStore((state) => state.updateMacraNode)
  const openDetailPanel = useComfyStore((state) => state.openDetailPanel)
  const nodeData = macraNode || (data as MacraNodeData)

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(nodeData?.content || '')
  const [editedLabel, setEditedLabel] = useState(nodeData?.label || '')
  const [showMetadata, setShowMetadata] = useState(false)
  const [showDomainSelector, setShowDomainSelector] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false) // 展开/折叠状态

  const domain = nodeData?.domain || CC_BMC_DOMAINS.VALUE_PROPOSITIONS
  const colors = DOMAIN_COLORS[domain]
  const rawData = data as Record<string, unknown>
  const meta = rawData.meta as { summary?: string; fullContent?: string } | undefined

  // Citation 相关
  const cardCitations = useComfyStore((state) => state.citations[id])
  const knowledgeEvidence = useComfyStore((state) => state.knowledgeEvidence)
  const openEvidenceDrawer = useComfyStore((state) => state.openEvidenceDrawer)
  const highlightClass = useCardHighlightClass(id)
  const contentCitation = cardCitations?.find((c) => c.fieldName === 'content')
  const metaForCitation = rawData.meta as
    | { citations?: unknown; noRefRanges?: unknown[]; groundingRate?: number; invalidRefs?: unknown[] }
    | undefined
  const groundingRate = metaForCitation?.groundingRate
  const noRefCount = Array.isArray(metaForCitation?.noRefRanges) ? metaForCitation!.noRefRanges.length : 0

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
          width: 10,
          height: 10,
          background: colors.main,
          border: '2px solid rgb(2 6 23)'
        }}
      />

      <div
        className={`group relative w-[340px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl transition-colors hover:border-white/[0.16] ${highlightClass}`}
        style={{
          // 1px left border in domain accent — semantic at-a-glance dimension cue
          // without the 9-color gradient/glow extravagance.
          boxShadow: `inset 3px 0 0 0 ${colors.main}`
        }}
      >
        {/* 顶部栏 */}
        <div
          className="relative border-b border-white/[0.06] px-4 py-3"
          style={{ background: `${colors.main}08` }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-md text-lg"
                style={{ background: `${colors.main}15`, color: colors.main }}
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
                <h3 className="flex-1 text-[13px] font-semibold text-white">
                  {nodeData?.label || '未命名'}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setShowMetadata(!showMetadata)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                    aria-label="切换元信息"
                  >
                    <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                    aria-label="编辑卡片"
                  >
                    <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </>
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

          {/* 维度标签 */}
          <div className="relative">
            <button
              onClick={() => setShowDomainSelector(!showDomainSelector)}
              className="flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors hover:bg-white/[0.04]"
              style={{
                color: colors.main,
                borderColor: `${colors.main}33`,
                background: `${colors.main}10`
              }}
            >
              <span>{domain}</span>
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
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
        <div className="relative p-4">
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

              {(contentCitation || noRefCount > 0 || typeof groundingRate === 'number') && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-300/15 bg-sky-400/5 px-3 py-2 text-[10px] text-slate-400"
                  data-testid="citation-footer"
                >
                  <span className="font-medium uppercase tracking-[0.18em] text-sky-200">
                    Citations
                  </span>
                  {contentCitation?.spans.map((span, i) => {
                    const primary = span.refs[0]
                    if (!primary) return null
                    const evidence = knowledgeEvidence.find((e) => {
                      const r = e as { id?: string; docId?: string }
                      return r.id === primary.evidenceId || r.docId === primary.docId
                    })
                    const score = (evidence as { score?: number } | undefined)?.score
                    return (
                      <CitationBadge
                        key={`${primary.evidenceId}-${i}`}
                        variant="ref"
                        index={i + 1}
                        docId={primary.docId}
                        score={score}
                        onClick={() => openEvidenceDrawer(primary.evidenceId, i)}
                      />
                    )
                  })}
                  {noRefCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-400/10 px-2 py-0.5 text-amber-300">
                      <CitationBadge variant="no-ref" className="mx-0 h-4 w-4" />
                      <span>{noRefCount} 处无引用</span>
                    </span>
                  )}
                  {typeof groundingRate === 'number' && (
                    <span className="ml-auto text-[10px] text-slate-500">
                      grounding {(groundingRate * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}

              {/* 展开/折叠按钮 */}
              {hasExtendedContent && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/[0.16] hover:text-white"
                >
                  {isExpanded ? (
                    <>
                      <Minimize2 className="h-3 w-3" strokeWidth={1.75} />
                      收起详情
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3 w-3" strokeWidth={1.75} />
                      展开详情
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
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-slate-950/30 px-4 py-2.5">
          {/* Agent 署名 */}
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-400">
            <span className="text-slate-500">by</span>
            <span className="font-medium" style={{ color: colors.main }}>
              {nodeData?.metadata?.agent_signature || 'AI Agent'}
            </span>
            {nodeData?.metadata?.confidence && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                style={{
                  background: `${colors.main}15`,
                  color: colors.main
                }}
              >
                {nodeData.metadata.confidence}
              </span>
            )}
          </div>

          {/* 查看详情按钮 */}
          <button
            onClick={() => openDetailPanel(id)}
            className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:border-white/[0.16] hover:text-white"
          >
            <Maximize2 className="h-3 w-3" strokeWidth={1.75} />
            详情
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 10,
          height: 10,
          background: colors.main,
          border: '2px solid rgb(2 6 23)'
        }}
      />
    </>
  )
})
