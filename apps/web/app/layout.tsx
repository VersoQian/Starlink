import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/shared/components'
import { fontVariables } from '@/shared/design-system/typography'

export const metadata: Metadata = {
  title: 'starlink · 智绘画布',
  description: 'starlink · Multi-Agent Strategy Canvas — 12-agent CC-BMC workshop',
  icons: {
    icon: '/favicon-32.png',
    shortcut: '/favicon-32.png'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={fontVariables}>
      <body className="min-h-screen bg-ink text-paper antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
