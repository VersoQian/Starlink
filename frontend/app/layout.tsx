import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '../components/providers'

export const metadata: Metadata = {
  title: 'Kuse Research Canvas',
  description: '多模态协作研究画布'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

