'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { useComfyStore } from '../../store'
import { AGENT_TYPES, type AgentType, type MacraNodeData } from '@/types/macra'
import { Bot, MessageCircle, X, Send, Loader2 } from 'lucide-react'

// Agent 对应的颜色和头像
const AGENT_CONFIG: Record<AgentType, { color: string; avatar: string; name: string; description: string }> = {
  [AGENT_TYPES.MARKET]: {
    color: 'from-blue-500 to-blue-600',
    avatar: '📊',
    name: '市场分析专家',
    description: '负责客户、渠道、关系分析'
  },
  [AGENT_TYPES.PRODUCT]: {
    color: 'from-purple-500 to-purple-600',
    avatar: '💡',
    name: '产品策略专家',
    description: '负责价值主张、关键业务'
  },
  [AGENT_TYPES.FINANCE]: {
    color: 'from-green-500 to-green-600',
    avatar: '💰',
    name: '财务分析专家',
    description: '负责收入、成本结构'
  },
  [AGENT_TYPES.COMPLIANCE]: {
    color: 'from-red-500 to-red-600',
    avatar: '⚖️',
    name: '合规法务专家',
    description: '负责合规、法律风险'
  },
  [AGENT_TYPES.ORCHESTRATOR]: {
    color: 'from-indigo-500 to-indigo-600',
    avatar: '🎯',
    name: '中央编排器',
    description: '协调所有Agent工作'
  },
  [AGENT_TYPES.CRITIC]: {
    color: 'from-orange-500 to-orange-600',
    avatar: '🔍',
    name: '对抗性评论者',
    description: '检测逻辑漏洞和冲突'
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
        className="w-3 h-3 bg-purple-500 border-2 border-white shadow-md"
      />

      <Card className="w-80 shadow-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:shadow-2xl transition-all duration-300 rounded-2xl">
        <CardHeader className="pb-3 border-b border-purple-100 bg-gradient-to-r from-purple-50/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl shadow-lg ring-2 ring-white`}>
              {config.avatar}
            </div>

            <div className="flex-1">
              <CardTitle className="text-sm text-slate-800 font-bold">{config.name}</CardTitle>
              <p className="text-xs text-slate-600 mt-0.5">{config.description}</p>
            </div>

            {isInteractive && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded-xl transition-all shadow-sm hover:shadow ${
                  isChatOpen
                    ? 'bg-purple-100 text-purple-600 scale-110'
                    : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                }`}
              >
                {isChatOpen ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              </button>
            )}
          </div>
        </CardHeader>

        {isChatOpen && (
          <CardContent className="space-y-3 pt-4">
            <div className="bg-purple-50/50 rounded-xl border-2 border-purple-100 p-3 h-48 overflow-y-auto space-y-2 shadow-inner">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 text-xs">
                  <Bot className="w-8 h-8 mb-2 text-purple-400" />
                  <p>向我提问任何关于 {config.description} 的问题</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-purple-100 text-purple-900 ml-4 border border-purple-200'
                        : 'bg-white text-slate-700 mr-4 border border-purple-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="输入你的问题..."
                className="flex-1 bg-white border-2 border-purple-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 shadow-sm"
                rows={2}
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white disabled:opacity-50 shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-purple-500 border-2 border-white shadow-md"
      />
    </>
  )
}
