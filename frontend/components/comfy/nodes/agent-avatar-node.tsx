'use client'

import { useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useComfyStore } from '@/store/comfy-store'
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
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />

      <Card className="w-80 shadow-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center text-2xl shadow-lg`}>
              {config.avatar}
            </div>

            <div className="flex-1">
              <CardTitle className="text-sm text-gray-900">{config.name}</CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
            </div>

            {isInteractive && (
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-2 rounded-full transition ${
                  isChatOpen
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {isChatOpen ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              </button>
            )}
          </div>
        </CardHeader>

        {isChatOpen && (
          <CardContent className="space-y-3">
            <div className="bg-white rounded-lg border border-gray-200 p-3 h-48 overflow-y-auto space-y-2">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 text-xs">
                  <Bot className="w-8 h-8 mb-2" />
                  <p>向我提问任何关于 {config.description} 的问题</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-xs ${
                      msg.role === 'user'
                        ? 'bg-blue-100 text-blue-900 ml-4'
                        : 'bg-purple-100 text-purple-900 mr-4'
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
                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={2}
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isProcessing}
                className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white disabled:opacity-50"
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
        className="w-3 h-3 bg-purple-500 border-2 border-white"
      />
    </>
  )
}
