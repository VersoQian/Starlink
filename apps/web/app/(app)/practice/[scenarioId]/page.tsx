'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ScenarioList, ChatInterface, ContextAssistant, useSessionStorage, useScoring } from '@/features/practice'
import type { Scenario, Message, Insight, Resource } from '@/features/practice'
import { nanoid } from 'nanoid'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme, cn, bgToBorder } from '@/lib/theme'

export default function ScenarioPage() {
  const params = useParams()
  const router = useRouter()
  const scenarioId = params.scenarioId as string
  const { theme } = useTheme()

  // 会话存储
  const { loadSession, saveSession, clearSession } = useSessionStorage(scenarioId)

  // State
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [quickReplyUsedCount, setQuickReplyUsedCount] = useState(0)

  // 计算评分
  const score = useScoring(messages, insights, quickReplyUsedCount)

  // Load scenarios
  useEffect(() => {
    fetchScenarios()
  }, [])

  // Load current scenario
  useEffect(() => {
    if (scenarios.length > 0) {
      const scenario = scenarios.find((s) => s.id === scenarioId)
      if (scenario) {
        setCurrentScenario(scenario)
        // 只在首次加载时添加系统消息或从会话恢复
        if (!sessionLoaded) {
          const saved = loadSession()
          if (saved && saved.messages.length > 0) {
            // 恢复保存的会话
            setMessages(saved.messages)
            setInsights(saved.insights)
            setResources(saved.resources)
            setQuickReplies(saved.quickReplies)
          } else {
            // 新会话：添加系统消息
            setMessages([{
              id: nanoid(),
              role: 'system',
              content: `场景：${scenario.title}\n\n${scenario.description}\n\n目标：${scenario.goal}`,
              timestamp: Date.now()
            }])
          }
          setSessionLoaded(true)
        }
      } else {
        router.push('/practice')
      }
    }
  }, [scenarioId, scenarios, router, sessionLoaded, loadSession])

  // 自动保存会话
  useEffect(() => {
    if (sessionLoaded && messages.length > 0) {
      saveSession({
        messages,
        insights,
        resources,
        quickReplies
      })
    }
  }, [messages, insights, resources, quickReplies, sessionLoaded, saveSession])

  async function fetchScenarios() {
    try {
      const res = await fetch('/api/cultural/simulations')
      const data = await res.json()
      setScenarios(data.scenarios || [])
    } catch (error) {
      console.error('Failed to fetch scenarios:', error)
    }
  }

  async function sendMessage(messageText?: string) {
    const textToSend = messageText || input.trim()
    if (!textToSend || loading) return

    // Add user message
    const userMessage: Message = {
      id: nanoid(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Prepare history
      const history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }))

      // Call API
      const res = await fetch('/api/cultural/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId,
          message: textToSend,
          history
        })
      })

      if (!res.ok) throw new Error('Failed to send message')

      const data = await res.json()

      // Add assistant message
      const assistantMessage: Message = {
        id: nanoid(),
        role: 'assistant',
        content: data.reply,
        feedback: data.feedback, // 添加反馈
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Update insights, resources, and quick replies
      setInsights(data.insights || [])
      setResources(data.resources || [])
      setQuickReplies(data.quickReplies || [])
    } catch (error) {
      console.error('Failed to send message:', error)
      // Add error message
      const errorMessage: Message = {
        id: nanoid(),
        role: 'assistant',
        content: '抱歉，发生了错误。请稍后重试。',
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  function handleQuickReply(reply: string) {
    setInput(reply)
    setQuickReplyUsedCount(prev => prev + 1)
    sendMessage(reply)
  }

  function handleClearSession() {
    if (confirm('确定要清除当前会话并重新开始吗？')) {
      clearSession()
      // 重新初始化
      if (currentScenario) {
        setMessages([{
          id: nanoid(),
          role: 'system',
          content: `场景：${currentScenario.title}\n\n${currentScenario.description}\n\n目标：${currentScenario.goal}`,
          timestamp: Date.now()
        }])
      }
      setInsights([])
      setResources([])
      setQuickReplies([])
      setQuickReplyUsedCount(0) // 重置计数
    }
  }

  if (!currentScenario) {
    return (
      <div className={cn('flex h-screen items-center justify-center', theme.colors.background.primary)}>
        <div className={cn('animate-spin w-12 h-12 border-4 border-t-transparent rounded-full', bgToBorder(theme.colors.brand.solid))}></div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-screen', theme.colors.background.primary)}>
      {/* Header with Theme Toggle */}
      <div className={cn('shrink-0 flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm', theme.colors.border.default, theme.colors.background.secondary)}>
        <h1 className={cn('text-xl font-bold', theme.colors.text.primary)}>{currentScenario.title}</h1>
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <ScenarioList scenarios={scenarios} currentScenarioId={scenarioId} />
        <ChatInterface
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={() => sendMessage()}
          loading={loading}
          quickReplies={quickReplies}
          onQuickReply={handleQuickReply}
          onClearSession={handleClearSession}
        />
        <ContextAssistant
          scenario={currentScenario}
          insights={insights}
          resources={resources}
          score={score}
        />
      </div>
    </div>
  )
}
