import type { Message, Insight, Resource } from '../types'
import { notifyAssetFeedChanged } from '@/entities/asset/local-source'

interface SessionData {
  messages: Message[]
  insights: Insight[]
  resources: Resource[]
  quickReplies: string[]
  lastUpdated: number
}

export function useSessionStorage(scenarioId: string, workspaceId = 'proj-001') {
  const storageKey = `practice-session-${workspaceId}-${scenarioId}`
  const legacyStorageKey = `practice-session-${scenarioId}`

  // 加载会话
  function loadSession(): SessionData | null {
    if (typeof window === 'undefined') return null

    try {
      const saved = localStorage.getItem(storageKey)
      const legacy = localStorage.getItem(legacyStorageKey)
      if (!saved && !legacy) return null

      const data = JSON.parse(saved ?? legacy ?? 'null') as SessionData
      // 检查是否过期（24小时）
      const isExpired = Date.now() - data.lastUpdated > 24 * 60 * 60 * 1000
      if (isExpired) {
        localStorage.removeItem(storageKey)
        return null
      }

      return data
    } catch (error) {
      console.error('Failed to load session:', error)
      return null
    }
  }

  // 保存会话
  function saveSession(data: Omit<SessionData, 'lastUpdated'>) {
    if (typeof window === 'undefined') return

    try {
      const sessionData: SessionData = {
        ...data,
        lastUpdated: Date.now()
      }
      localStorage.setItem(storageKey, JSON.stringify(sessionData))
      notifyAssetFeedChanged()
    } catch (error) {
      console.error('Failed to save session:', error)
    }
  }

  // 清除会话
  function clearSession() {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(legacyStorageKey)
      notifyAssetFeedChanged()
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  // 获取所有会话列表（用于统计）
  function getAllSessions() {
    if (typeof window === 'undefined') return []

    try {
      const sessions: { scenarioId: string; lastUpdated: number; messageCount: number }[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('practice-session-')) {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data) as SessionData
            const scenarioId = key.replace('practice-session-', '')
            sessions.push({
              scenarioId,
              lastUpdated: parsed.lastUpdated,
              messageCount: parsed.messages.length
            })
          }
        }
      }

      return sessions
    } catch (error) {
      console.error('Failed to get all sessions:', error)
      return []
    }
  }

  return {
    loadSession,
    saveSession,
    clearSession,
    getAllSessions
  }
}
