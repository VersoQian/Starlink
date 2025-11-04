import type { Metadata } from 'next'
import '../../app/globals.css'
import { Providers } from '../components/providers'

export const metadata: Metadata = {
  title: 'Branching Canvas · Next Generation',
  description: 'Quest 驱动课程与多维画布的统一工作台'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-900 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
