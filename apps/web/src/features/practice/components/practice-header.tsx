'use client'

import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTheme } from '@/lib/theme'

export function PracticeHeader() {
  const { theme } = useTheme()

  return (
    <header className={`shrink-0 flex items-center justify-between whitespace-nowrap border-b ${theme.colors.border.default} px-6 py-3 ${theme.colors.background.secondary} backdrop-blur-sm z-10`}>
      <div className={`flex items-center gap-4 ${theme.colors.text.secondary}`}>
        <div className={`${theme.colors.brand.solid.replace('bg-', 'text-')} size-6`}>
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 45.8096C19.6865 45.8096 15.4698 44.5305 11.8832 42.134C8.29667 39.7376 5.50128 36.3314 3.85056 32.3462C2.19985 28.361 1.76794 23.9758 2.60947 19.7452C3.451 15.5145 5.52816 11.6284 8.57829 8.5783C11.6284 5.52817 15.5145 3.45101 19.7452 2.60948C23.9758 1.76795 28.361 2.19986 32.3462 3.85057C36.3314 5.50129 39.7376 8.29668 42.134 11.8833C44.5305 15.4698 45.8096 19.6865 45.8096 24L24 24L24 45.8096Z" fill="currentColor"></path>
          </svg>
        </div>
        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Starlink Assistant</h2>
      </div>

      <div className="flex flex-1 justify-end gap-6">
        <div className="hidden md:flex items-center gap-6">
          <Link
            className={`text-sm font-medium leading-normal ${theme.colors.text.tertiary} hover:${theme.colors.brand.solid.replace('bg-', 'text-')} transition-colors cursor-pointer`}
            href="/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className={`text-sm font-medium leading-normal ${theme.colors.brand.solid.replace('bg-', 'text-')}`}
            href="/practice"
          >
            Scenarios
          </Link>
          <a className={`text-sm font-medium leading-normal ${theme.colors.text.tertiary} hover:${theme.colors.brand.solid.replace('bg-', 'text-')} transition-colors cursor-pointer`} href="#">
            History
          </a>
          <a className={`text-sm font-medium leading-normal ${theme.colors.text.tertiary} hover:${theme.colors.brand.solid.replace('bg-', 'text-')} transition-colors cursor-pointer`} href="#">
            Settings
          </a>
        </div>

        <button className={`flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-gradient-to-r ${theme.colors.brand.from} ${theme.colors.brand.to} text-white text-sm font-bold leading-normal tracking-[0.015em] hover:opacity-90 transition-all shadow-md`}>
          <span className="truncate">New Simulation</span>
        </button>

        {/* 主题切换器 */}
        <ThemeToggle />

        <div className={`bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-gradient-to-br ${theme.colors.brand.from} ${theme.colors.brand.to}`}></div>
      </div>
    </header>
  )
}
