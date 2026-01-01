'use client'

import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      style={{
        background: mode === 'light'
          ? 'linear-gradient(to right, #9B87F5, #7A6EEF)'
          : 'linear-gradient(to right, #06B6D4, #2563EB)'
      }}
      aria-label="Toggle theme"
    >
      {/* 滑块 */}
      <span
        className={`absolute top-0.5 flex items-center justify-center w-6 h-6 bg-white rounded-full shadow-lg transition-transform duration-300 ${
          mode === 'dark' ? 'translate-x-7' : 'translate-x-0.5'
        }`}
      >
        {mode === 'light' ? (
          // 太阳图标 (浅色模式)
          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          // 月亮图标 (深色模式)
          <svg className="w-4 h-4 text-slate-700" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </span>
    </button>
  )
}
