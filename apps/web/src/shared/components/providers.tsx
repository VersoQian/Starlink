'use client'

import { ReactNode, useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { getQueryClient } from '../lib/query-client'
import { ThemeSync } from './theme-sync'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [client] = useState(() => getQueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ThemeSync />
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  )
}
