'use client'

import { useEffect, useState } from 'react'
import { ScenarioList } from '@/features/practice'
import type { Scenario } from '@/features/practice'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme, cn, bgToText, bgToBorder } from '@/lib/theme'

export default function PracticePage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()

  useEffect(() => {
    fetchScenarios()
  }, [])

  async function fetchScenarios() {
    try {
      const res = await fetch('/api/cultural/simulations')
      const data = await res.json()
      setScenarios(data.scenarios || [])
    } catch (error) {
      console.error('Failed to fetch scenarios:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={cn('flex h-screen items-center justify-center', theme.colors.background.primary)}>
        <div className="text-center">
          <div className={cn('animate-spin w-12 h-12 mx-auto mb-4 border-4 border-t-transparent rounded-full', bgToBorder(theme.colors.brand.solid))}></div>
          <p className={theme.colors.text.tertiary}>加载场景中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col h-screen', theme.colors.background.primary)}>
      {/* Header with Theme Toggle */}
      <div className={cn('shrink-0 flex items-center justify-between px-6 py-4 border-b backdrop-blur-sm', theme.colors.border.default, theme.colors.background.secondary)}>
        <h1 className={cn('text-xl font-bold', theme.colors.text.primary)}>跨文化商业沟通模拟</h1>
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <ScenarioList scenarios={scenarios} />

        {/* Empty State - 选择场景提示 */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className={cn('w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg', theme.colors.brand.from, theme.colors.brand.to)}>
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className={cn('text-2xl font-bold mb-3', theme.colors.text.primary)}>
              跨文化商业沟通模拟
            </h2>
            <p className={cn('mb-6', theme.colors.text.tertiary)}>
              选择一个场景开始练习。AI将扮演对方角色，并实时给出文化礼节和策略建议。
            </p>
            <div className={cn('inline-flex items-center gap-2 px-4 py-2 border rounded-full text-sm', theme.colors.background.card, theme.colors.border.default, theme.colors.text.tertiary)}>
              <svg className={cn('w-4 h-4', bgToText(theme.colors.brand.solid))} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              从左侧选择一个场景
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
