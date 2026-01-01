'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = theme === 'dark'
  const label = isDark ? '浅色' : '深色'

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center gap-2 rounded-full border border-canvas-border/70 bg-canvas-surface px-3 py-1 text-xs font-medium text-canvas-muted transition hover:bg-canvas-panel hover:text-canvas-text"
      aria-label="切换配色"
    >
      <span className="text-base leading-none">{isDark ? '🌕' : '🌑'}</span>
      <span className="leading-none">切换{label}</span>
    </button>
  )
}
