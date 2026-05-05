import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/shared/components'
import { fontVariables } from '@/shared/design-system/typography'

export const metadata: Metadata = {
  title: 'Kuse Research Canvas',
  description: '多模态协作研究画布'
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
