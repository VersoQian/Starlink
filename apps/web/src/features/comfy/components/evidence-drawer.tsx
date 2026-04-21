'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import { FileText, Target, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useComfyStore } from '../store'

const CARDS_REFERENCING_QUERY = /* GraphQL */ `
  query CardsReferencingEvidence($conversationId: ID!, $evidenceId: ID!) {
    cardsReferencingEvidence(conversationId: $conversationId, evidenceId: $evidenceId)
  }
`

type EvidenceDrawerProps = {
  conversationId?: string | null
  className?: string
}

/**
 * Right-side drawer that shows the original evidence text the user clicked
 * through a citation badge, plus reverse lookup: which BMC cards reference
 * this same evidence.
 *
 * Controlled entirely by the comfy-store `evidenceDrawer` state.
 * When rendered without a `conversationId` prop (e.g., registered as an
 * overlay panel via panel-registry), falls back to `store.currentConversationId`.
 */
export function EvidenceDrawer({ conversationId, className }: EvidenceDrawerProps = {}) {
  const drawer = useComfyStore((state) => state.evidenceDrawer)
  const storeConversationId = useComfyStore((state) => state.currentConversationId)
  const effectiveConversationId = conversationId ?? storeConversationId
  const knowledgeEvidence = useComfyStore((state) => state.knowledgeEvidence)
  const closeDrawer = useComfyStore((state) => state.closeEvidenceDrawer)
  const highlightCards = useComfyStore((state) => state.highlightCardsReferencingEvidence)
  const clearHighlight = useComfyStore((state) => state.clearCitationHighlight)

  const evidence = useMemo(() => {
    if (!drawer.focusedEvidenceId) return null
    return (
      knowledgeEvidence.find((e) => {
        const record = e as { id?: string; docId?: string }
        return record.id === drawer.focusedEvidenceId || record.docId === drawer.focusedEvidenceId
      }) ?? null
    )
  }, [knowledgeEvidence, drawer.focusedEvidenceId])

  const { data: referencingCardIds, isLoading } = useQuery({
    queryKey: ['cardsReferencingEvidence', effectiveConversationId, drawer.focusedEvidenceId],
    enabled:
      drawer.isOpen &&
      !!effectiveConversationId &&
      !!drawer.focusedEvidenceId,
    staleTime: 5000,
    queryFn: async () => {
      if (!effectiveConversationId || !drawer.focusedEvidenceId) return [] as string[]
      const client = getGraphQLClient()
      const response = await client.request<{ cardsReferencingEvidence: string[] }>(
        CARDS_REFERENCING_QUERY,
        { conversationId: effectiveConversationId, evidenceId: drawer.focusedEvidenceId }
      )
      return response.cardsReferencingEvidence ?? []
    }
  })

  if (!drawer.isOpen) return null

  const docId = (evidence as { docId?: string } | null)?.docId ?? drawer.focusedEvidenceId ?? ''
  const snippetText = (evidence as { snippet?: string } | null)?.snippet ?? ''
  const score = (evidence as { score?: number } | null)?.score
  const metadata = (evidence as { metadata?: Record<string, unknown> } | null)?.metadata
  const title = (metadata?.title as string | undefined) ?? docId
  const snippetId = (metadata?.snippetId as string | undefined) ?? ''

  const handleLocateCards = () => {
    if (referencingCardIds && referencingCardIds.length > 0) {
      highlightCards(referencingCardIds)
    }
  }

  return (
    <div
      className={cn(
        'fixed right-4 top-20 bottom-8 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-sky-300/20 bg-[linear-gradient(180deg,rgba(8,11,20,0.96)_0%,rgba(12,17,28,0.98)_100%)] shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-xl',
        className
      )}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-200">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-sky-300">Evidence 证据来源</p>
              <h3 className="mt-1 truncate text-sm font-semibold text-slate-100">{title}</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">
                docId: {docId}
                {snippetId ? ` · snippetId: ${snippetId}` : ''}
                {typeof score === 'number' ? ` · 相关度 ${score.toFixed(2)}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              clearHighlight()
              closeDrawer()
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <section className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">原文片段</p>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-sm leading-7 text-slate-200">
            {snippetText || '（该 evidence 原文在当前会话中不可见）'}
          </div>

          <div className="mt-6 rounded-2xl border border-sky-300/10 bg-sky-400/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-sky-200">
              反向查询：引用此 Evidence 的 BMC 卡片
            </p>
            <div className="mt-2 text-xs text-slate-300">
              {isLoading
                ? '查询中...'
                : referencingCardIds && referencingCardIds.length > 0
                  ? `${referencingCardIds.length} 张卡片引用了此证据`
                  : '尚未发现引用此证据的卡片'}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={handleLocateCards}
            disabled={!referencingCardIds || referencingCardIds.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,rgba(224,242,254,0.96)_0%,rgba(186,230,253,0.92)_100%)] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_16px_34px_rgba(56,189,248,0.25)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Target className="h-4 w-4" />
            定位相关卡片
            {drawer.highlightedCardIds.length > 0 ? ' · 已高亮' : ''}
          </button>
        </footer>
      </div>
    </div>
  )
}
