'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { AGENT_TYPES, type AgentType, type MacraNodeData } from '@/types/macra'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

// Editorial Boardroom v2 agent config (2026-05-01).
// Collapses the previous 16-type emoji+gradient palette to a 5-byline
// system (market / product / finance / critic / synthesizer). Each
// agent gets a Fraunces letter glyph + a muted byline-tinted class
// instead of an emoji on a gradient. Names + descriptions stay
// identical so chat copy reads the same.
type BylineKey = 'market' | 'product' | 'finance' | 'critic' | 'synthesizer'

interface AgentEntry {
  /** Single Fraunces letter — typeset mark in lieu of the old emoji. */
  glyph: string
  byline: BylineKey
  /** Tailwind class for the byline-tinted text/glyph. */
  tintClass: string
  /** Hex for inset 3px edge bar (muted, NOT the press accent). */
  edgeHex: string
  name: string
  description: string
}

const BYLINE_TINT: Record<BylineKey, string> = {
  market:      'text-byline-market',
  product:     'text-byline-product',
  finance:     'text-byline-finance',
  critic:      'text-byline-critic',
  synthesizer: 'text-byline-synthesizer',
}

const BYLINE_HEX: Record<BylineKey, string> = {
  market:      '#9B8E70',
  product:     '#7A8B7E',
  finance:     '#6E7A8C',
  critic:      '#8C6E6E',
  synthesizer: '#6B6B7C',
}

function entry(byline: BylineKey, glyph: string, name: string, description: string): AgentEntry {
  return { glyph, byline, tintClass: BYLINE_TINT[byline], edgeHex: BYLINE_HEX[byline], name, description }
}

const AGENT_CONFIG: Record<AgentType, AgentEntry> = {
  // Market family — customer-facing dimensions
  [AGENT_TYPES.MARKET]:                  entry('market',      'M', '市场分析专家', '客户、渠道、关系分析'),
  [AGENT_TYPES.CUSTOMER_SEGMENTS]:       entry('market',      'M', '客户细分专家', '目标客户与画像分析'),
  [AGENT_TYPES.CUSTOMER_RELATIONSHIPS]:  entry('market',      'M', '客户关系专家', '关系维护与用户粘性'),
  [AGENT_TYPES.CHANNELS]:                entry('market',      'M', '渠道通路专家', '触达与分发策略'),

  // Product family — value + operations
  [AGENT_TYPES.PRODUCT]:                 entry('product',     'P', '产品策略专家', '价值主张、关键业务'),
  [AGENT_TYPES.VALUE_PROPOSITIONS]:      entry('product',     'P', '价值主张专家', '核心价值与差异化'),
  [AGENT_TYPES.KEY_ACTIVITIES]:          entry('product',     'P', '关键业务专家', '核心活动与流程'),
  [AGENT_TYPES.KEY_RESOURCES]:           entry('product',     'P', '核心资源专家', '关键资产与能力'),
  [AGENT_TYPES.KEY_PARTNERSHIPS]:        entry('product',     'P', '重要合作专家', '合作伙伴与协同'),

  // Finance family
  [AGENT_TYPES.FINANCE]:                 entry('finance',     'F', '财务分析专家', '收入、成本结构'),
  [AGENT_TYPES.REVENUE_STREAMS]:         entry('finance',     'F', '收入来源专家', '商业模式与定价'),
  [AGENT_TYPES.COST_STRUCTURE]:          entry('finance',     'F', '成本结构专家', '成本构成与优化'),

  // Critic family — adversarial review
  [AGENT_TYPES.CRITIC]:                  entry('critic',      'C', '对抗性评论者', '检测逻辑漏洞和冲突'),
  [AGENT_TYPES.COMPLIANCE]:              entry('critic',      'C', '合规法务专家', '合规、法律风险'),

  // Synthesizer / orchestrator family — meta agents
  [AGENT_TYPES.ORCHESTRATOR]:            entry('synthesizer', 'S', '中央编排器',     '协调所有 Agent 工作'),
  [AGENT_TYPES.SEMANTIC_PLAN]:           entry('synthesizer', 'S', '语义确认专家',   '需求理解与确认'),
  [AGENT_TYPES.CULTURAL_CONTEXT]:        entry('synthesizer', 'S', '文化情境专家',   '文化背景与适配'),
  [AGENT_TYPES.CULTURAL_SIMULATION]:     entry('synthesizer', 'S', '跨文化演练专家', '沟通模拟与策略'),
  [AGENT_TYPES.CULTURAL_REPORT]:         entry('synthesizer', 'S', '跨文化报告专家', '策略报告与落地'),
}

interface ChatMessage {
  role: 'user' | 'agent'
  content: string
}

export const AgentAvatarNode = memo(function AgentAvatarNode({ id, data }: NodeProps) {
  const macraNode = useComfyStore((state) => state.macraNodes.get(id))
  const nodeData = macraNode || (data as MacraNodeData)

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const agentType = nodeData?.agentType || AGENT_TYPES.MARKET
  const config = AGENT_CONFIG[agentType]
  const isInteractive = nodeData?.isInteractive ?? true

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isProcessing) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setIsProcessing(true)

    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      // Fallback: 模拟回复
      setTimeout(() => {
        const mockResponse = `作为 ${config.name}，我收到了你的问题："${userMessage}"。\n\n这是一个模拟回复（API未就绪）。实际部署时，我会根据专业领域给出深度分析。`
        setChatMessages(prev => [...prev, { role: 'agent', content: mockResponse }])
        setIsProcessing(false)
      }, 1000)
    } catch (error) {
      console.error('Agent 对话失败:', error)
      setIsProcessing(false)
    }
  }, [inputMessage, isProcessing, config.name])

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          background: '#2A2826',
          border: '0.5px solid rgba(244,240,232,0.4)'
        }}
      />

      <div
        className="group relative w-[360px] overflow-hidden border-[1px] border-ink-ash3/30 bg-ink-ash1 transition-colors hover:border-ink-ash2/60"
        style={{ boxShadow: `inset 3px 0 0 0 ${config.edgeHex}` }}
      >
        {/* 头部 — Fraunces 字母 byline + 名称 */}
        <div className="relative border-b-[0.5px] border-ink-ash3/30 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Single display-serif glyph in lieu of emoji avatar */}
            <span
              aria-hidden="true"
              className={`shrink-0 font-display font-[700] text-[28px] leading-none ${config.tintClass}`}
            >
              {config.glyph}
            </span>

            <div className="min-w-0 flex-1">
              <h3 className="font-display font-[700] text-[15px] tracking-[0.02em] text-paper truncate">
                {config.name}
              </h3>
              <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 mt-0.5">
                {config.description}
              </p>
            </div>

            {isInteractive && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`flex h-7 w-7 items-center justify-center transition-colors ${
                  isChatOpen
                    ? 'bg-ink-ash2/40 text-paper'
                    : 'text-ink-ash4 hover:bg-ink-ash2/40 hover:text-paper'
                }`}
                aria-label={isChatOpen ? '关闭对话' : '打开对话'}
              >
                {isChatOpen ? (
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>

        {/* 对话界面 */}
        {isChatOpen && (
          <div className="relative">
            {/* 消息区域 */}
            <div className="h-56 space-y-3 overflow-y-auto bg-ink/40 p-4">
              {chatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Sparkles className={`h-5 w-5 mb-2 ${config.tintClass}`} strokeWidth={1.5} />
                  <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
                    向我提问关于
                  </p>
                  <p className="mt-1 font-display font-[700] text-[13px] text-paper">
                    {config.description}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`shrink-0 flex h-6 w-6 items-center justify-center font-display font-[700] text-[14px] leading-none ${
                        msg.role === 'agent' ? config.tintClass : 'text-ink-ash4'
                      }`}
                    >
                      {msg.role === 'agent' ? config.glyph : 'U'}
                    </span>
                    <div
                      className={`max-w-[78%] border-[0.5px] px-3 py-2 font-body text-[12px] leading-[1.5] ${
                        msg.role === 'agent'
                          ? 'border-ink-ash3/30 bg-ink-ash2/30 text-paper/85'
                          : 'border-paper/20 bg-paper/[0.04] text-paper'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 输入区域 */}
            <div className="border-t-[0.5px] border-ink-ash3/30 bg-ink/40 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="输入你的问题…"
                  className="flex-1 resize-none border-[0.5px] border-ink-ash3/40 bg-ink/60 px-3 py-2 font-body text-[12px] text-paper outline-none transition-colors placeholder:text-ink-ash4 focus:border-paper/40"
                  rows={2}
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className="flex h-9 w-9 items-center justify-center bg-paper text-ink transition-colors disabled:opacity-30 hover:bg-paper-ash2"
                  aria-label="发送"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <Send className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          background: '#2A2826',
          border: '0.5px solid rgba(244,240,232,0.4)'
        }}
      />
    </>
  )
})
