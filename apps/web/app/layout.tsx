import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/shared/components'
import { fontVariables } from '@/shared/design-system/typography'

export const metadata: Metadata = {
  title: 'Kuse Research Canvas',
  description: '多模态协作研究画布'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // P1/P2 (2026-05-01): Editorial Boardroom v2 binds Fraunces / Geist /
  // JetBrains Mono CSS variables to <html>. Old @import-loaded fonts
  // (Inter / Roboto / Outfit / Manrope / DM Sans) in globals.css remain
  // active for v1 surfaces; P4 deletes those once all surfaces migrate.
  return (
    <html lang="zh-CN" suppressHydrationWarning className={fontVariables}>
      <body className="min-h-screen bg-canvas-bg text-canvas-text antialiased transition-colors">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
