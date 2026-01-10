'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { AGENT_TYPES, type AgentType, type MacraNodeData } from '@/types/macra'
import { Bot, MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

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

export function AgentAvatarNode({ id, data }: NodeProps) {
  const { getMacraNode } = useComfyStore()
  const nodeData = getMacraNode(id) || (data as MacraNodeData)

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
          background: `linear-gradient(135deg, ${config.accentColor}, ${config.accentColor}dd)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.accentColor}40`
        }}
      />

      <div
        className={`w-96 rounded-3xl overflow-hidden transition-all duration-500 relative group ${isChatOpen ? 'shadow-2xl' : ''}`}
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: isHovered || isChatOpen
            ? `0 20px 60px -15px ${config.accentColor}60, 0 0 0 1px ${config.accentColor}20, inset 0 1px 0 rgba(255,255,255,0.1)`
            : `0 10px 30px -10px ${config.accentColor}30, inset 0 1px 0 rgba(255,255,255,0.05)`,
          transform: isChatOpen ? 'scale(1.02)' : 'scale(1)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 装饰性光晕效果 */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl blur-2xl pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${config.accentColor}20, transparent 70%)`
          }}
        />

        {/* 头部 */}
        <div
          className="relative px-6 py-5 border-b border-white/10"
          style={{
            background: `linear-gradient(135deg, ${config.accentColor}15, transparent)`
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-3xl shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 border-2 border-white/20`}
              style={{ boxShadow: `0 12px 32px ${config.accentColor}50` }}
            >
              {config.avatar}
            </div>

            <div className="flex-1">
              <h3 className="text-base font-black text-white mb-1" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {config.name}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">{config.description}</p>
            </div>

            {isInteractive && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-3 rounded-2xl transition-all shadow-lg border backdrop-blur-sm ${
                  isChatOpen
                    ? `bg-gradient-to-br ${config.gradient} text-white border-white/30 scale-110 shadow-xl`
                    : 'glass-effect text-slate-400 hover:text-white border-white/20 hover:border-white/40'
                }`}
                style={isChatOpen ? { boxShadow: `0 8px 24px ${config.accentColor}60` } : {}}
              >
                {isChatOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>

        {/* 对话界面 */}
        {isChatOpen && (
          <div className="relative">
            {/* 消息区域 */}
            <div
              className="h-64 overflow-y-auto p-5 space-y-3 backdrop-blur-sm"
              style={{ background: 'rgba(0, 0, 0, 0.2)' }}
            >
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div
                    className={`w-20 h-20 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4 shadow-lg`}
                    style={{ boxShadow: `0 12px 32px ${config.accentColor}50` }}
                  >
                    <Sparkles className="w-10 h-10 text-white animate-pulse" />
                  </div>
                  <p className="text-slate-400 text-sm">向我提问关于</p>
                  <p className="text-white text-sm font-bold mt-1">{config.description}</p>
                  <p className="text-slate-500 text-xs mt-2">的任何问题</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                        msg.role === 'agent'
                          ? `bg-gradient-to-br ${config.gradient} border-2 border-white/20`
                          : 'glass-effect border border-white/20'
                      }`}
                      style={msg.role === 'agent' ? { boxShadow: `0 4px 12px ${config.accentColor}50` } : {}}
                    >
                      {msg.role === 'agent' ? (
                        <span className="text-lg">{config.avatar}</span>
                      ) : (
                        <span className="text-amber-400 text-xs font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>U</span>
                      )}
                    </div>
                    <div className={`flex flex-col gap-1.5 max-w-[75%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                      <div
                        className={`p-4 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-sm border ${
                          msg.role === 'agent'
                            ? 'glass-effect border-white/10 text-slate-200 rounded-tl-none'
                            : `bg-gradient-to-br ${config.gradient} text-white rounded-tr-none border-white/20`
                        }`}
                        style={msg.role === 'user' ? { boxShadow: `0 8px 20px ${config.accentColor}40` } : {}}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 输入区域 */}
            <div
              className="p-5 border-t border-white/10"
              style={{
                background: `linear-gradient(to top, ${config.accentColor}10, transparent)`
              }}
            >
              <div className="flex items-end gap-3">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="输入你的问题..."
                  className="flex-1 bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent shadow-inner placeholder-slate-500 text-slate-200 backdrop-blur-sm"
                  style={{
                    focusRing: `0 0 0 2px ${config.accentColor}50`
                  }}
                  rows={2}
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isProcessing}
                  className={`p-3.5 rounded-xl bg-gradient-to-br ${config.gradient} text-white disabled:opacity-50 shadow-lg transition-all hover:scale-110 border-2 border-white/20 disabled:scale-100`}
                  style={{ boxShadow: `0 8px 24px ${config.accentColor}50` }}
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 底部装饰线 */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, transparent, ${config.accentColor}80, ${config.accentColor}60, transparent)`
          }}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: `linear-gradient(135deg, ${config.accentColor}, ${config.accentColor}dd)`,
          width: 10,
          height: 10,
          border: '2px solid rgba(255,255,255,0.3)',
          boxShadow: `0 4px 12px ${config.accentColor}40`
        }}
      />
    </>
  )
}
