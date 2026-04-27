'use client'

import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { useComfyStore } from '../../store'
import { AGENT_TYPES, type AgentType, type MacraNodeData } from '@/types/macra'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

// Agent 配色方案 - Tech-Luxe Gradient
const AGENT_CONFIG: Record<AgentType, { gradient: string; avatar: string; name: string; description: string; accentColor: string }> = {
  [AGENT_TYPES.CUSTOMER_SEGMENTS]: {
    gradient: 'from-sky-400 to-sky-500',
    avatar: '🧭',
    name: '客户细分专家',
    description: '目标客户与画像分析',
    accentColor: '#38bdf8'
  },
  [AGENT_TYPES.CUSTOMER_RELATIONSHIPS]: {
    gradient: 'from-cyan-400 to-cyan-500',
    avatar: '🤝',
    name: '客户关系专家',
    description: '关系维护与用户粘性',
    accentColor: '#22d3ee'
  },
  [AGENT_TYPES.CHANNELS]: {
    gradient: 'from-blue-400 to-blue-500',
    avatar: '🚚',
    name: '渠道通路专家',
    description: '触达与分发策略',
    accentColor: '#3b82f6'
  },
  [AGENT_TYPES.VALUE_PROPOSITIONS]: {
    gradient: 'from-violet-400 to-violet-500',
    avatar: '💎',
    name: '价值主张专家',
    description: '核心价值与差异化',
    accentColor: '#8b5cf6'
  },
  [AGENT_TYPES.REVENUE_STREAMS]: {
    gradient: 'from-emerald-400 to-emerald-500',
    avatar: '💹',
    name: '收入来源专家',
    description: '商业模式与定价',
    accentColor: '#10b981'
  },
  [AGENT_TYPES.KEY_ACTIVITIES]: {
    gradient: 'from-amber-400 to-amber-500',
    avatar: '🛠️',
    name: '关键业务专家',
    description: '核心活动与流程',
    accentColor: '#f59e0b'
  },
  [AGENT_TYPES.KEY_RESOURCES]: {
    gradient: 'from-lime-400 to-lime-500',
    avatar: '🧰',
    name: '核心资源专家',
    description: '关键资产与能力',
    accentColor: '#84cc16'
  },
  [AGENT_TYPES.KEY_PARTNERSHIPS]: {
    gradient: 'from-orange-400 to-orange-500',
    avatar: '🧩',
    name: '重要合作专家',
    description: '合作伙伴与协同',
    accentColor: '#f97316'
  },
  [AGENT_TYPES.COST_STRUCTURE]: {
    gradient: 'from-rose-400 to-rose-500',
    avatar: '📉',
    name: '成本结构专家',
    description: '成本构成与优化',
    accentColor: '#fb7185'
  },
  [AGENT_TYPES.MARKET]: {
    gradient: 'from-blue-400 to-blue-500',
    avatar: '📊',
    name: '市场分析专家',
    description: '客户、渠道、关系分析',
    accentColor: '#3b82f6'
  },
  [AGENT_TYPES.PRODUCT]: {
    gradient: 'from-amber-400 to-amber-500',
    avatar: '💡',
    name: '产品策略专家',
    description: '价值主张、关键业务',
    accentColor: '#fbbf24'
  },
  [AGENT_TYPES.FINANCE]: {
    gradient: 'from-emerald-400 to-emerald-500',
    avatar: '💰',
    name: '财务分析专家',
    description: '收入、成本结构',
    accentColor: '#10b981'
  },
  [AGENT_TYPES.COMPLIANCE]: {
    gradient: 'from-pink-400 to-pink-500',
    avatar: '⚖️',
    name: '合规法务专家',
    description: '合规、法律风险',
    accentColor: '#f472b6'
  },
  [AGENT_TYPES.SEMANTIC_PLAN]: {
    gradient: 'from-violet-400 to-indigo-500',
    avatar: '🧠',
    name: '语义确认专家',
    description: '需求理解与确认',
    accentColor: '#8b5cf6'
  },
  [AGENT_TYPES.CULTURAL_CONTEXT]: {
    gradient: 'from-teal-400 to-cyan-500',
    avatar: '🌍',
    name: '文化情境专家',
    description: '文化背景与适配',
    accentColor: '#22d3ee'
  },
  [AGENT_TYPES.CULTURAL_SIMULATION]: {
    gradient: 'from-purple-400 to-indigo-500',
    avatar: '🗣️',
    name: '跨文化演练专家',
    description: '沟通模拟与策略',
    accentColor: '#a855f7'
  },
  [AGENT_TYPES.CULTURAL_REPORT]: {
    gradient: 'from-sky-400 to-blue-500',
    avatar: '📘',
    name: '跨文化报告专家',
    description: '策略报告与落地',
    accentColor: '#38bdf8'
  },
  [AGENT_TYPES.ORCHESTRATOR]: {
    gradient: 'from-indigo-400 to-indigo-500',
    avatar: '🎯',
    name: '中央编排器',
    description: '协调所有Agent工作',
    accentColor: '#6366f1'
  },
  [AGENT_TYPES.CRITIC]: {
    gradient: 'from-orange-400 to-orange-500',
    avatar: '🔍',
    name: '对抗性评论者',
    description: '检测逻辑漏洞和冲突',
    accentColor: '#f97316'
  }
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
          width: 10,
          height: 10,
          background: config.accentColor,
          border: '2px solid rgb(2 6 23)'
        }}
      />

      <div
        className="group relative w-[360px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-900/60 backdrop-blur-xl transition-colors hover:border-white/[0.16]"
        style={{ boxShadow: `inset 3px 0 0 0 ${config.accentColor}` }}
      >
        {/* 头部 */}
        <div
          className="relative border-b border-white/[0.06] px-4 py-3"
          style={{ background: `${config.accentColor}08` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-md text-xl"
              style={{ background: `${config.accentColor}15`, color: config.accentColor }}
            >
              {config.avatar}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-semibold text-white">{config.name}</h3>
              <p className="text-[11px] text-slate-400">{config.description}</p>
            </div>

            {isInteractive && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                  isChatOpen
                    ? 'bg-white/[0.08] text-white'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
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
            <div className="h-56 space-y-2.5 overflow-y-auto bg-slate-950/30 p-4">
              {chatMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div
                    className="mb-3 flex h-12 w-12 items-center justify-center rounded-md"
                    style={{ background: `${config.accentColor}15`, color: config.accentColor }}
                  >
                    <Sparkles className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <p className="text-[12px] text-slate-400">向我提问关于</p>
                  <p className="mt-0.5 text-[12px] font-medium text-white">
                    {config.description}
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={
                        msg.role === 'agent'
                          ? { background: `${config.accentColor}15`, color: config.accentColor }
                          : { background: 'rgba(255,255,255,0.05)', color: 'rgb(148 163 184)' }
                      }
                    >
                      {msg.role === 'agent' ? (
                        <span className="text-[14px]">{config.avatar}</span>
                      ) : (
                        <span className="text-[10px] font-medium">U</span>
                      )}
                    </div>
                    <div
                      className={`max-w-[78%] rounded-lg border px-3 py-2 text-[12px] leading-relaxed ${
                        msg.role === 'agent'
                          ? 'border-white/[0.06] bg-white/[0.03] text-slate-200'
                          : 'border-white/[0.08] bg-white/[0.06] text-slate-100'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 输入区域 */}
            <div className="border-t border-white/[0.06] bg-slate-950/40 p-3">
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
                  className="flex-1 resize-none rounded-md border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-[12px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-1 focus:ring-cyan-300/20"
                  rows={2}
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-slate-950 transition-colors disabled:opacity-40"
                  style={{ background: config.accentColor }}
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
          width: 10,
          height: 10,
          background: config.accentColor,
          border: '2px solid rgb(2 6 23)'
        }}
      />
    </>
  )
})
