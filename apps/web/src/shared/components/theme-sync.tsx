'use client'

import { useEffect, useRef } from 'react'
import { useTheme as useAppTheme } from '@/lib/theme'

export function ThemeSync() {
  const initializedRef = useRef(false)
  const mode = useAppTheme((state) => state.mode)

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  useEffect(() => {
    if (!initializedRef.current) return
    document.documentElement.classList.toggle('dark', mode === 'dark')
  }, [mode])

  return null
}
