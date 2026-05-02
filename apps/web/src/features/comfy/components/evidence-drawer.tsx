'use client'

/**
 * EvidenceDrawer — Editorial Boardroom v2 (2026-05-02).
 *
 * Right-side drawer that opens when the user clicks a citation badge
 * `[N]` on a BMC card. Shows the original snippet text + reverse
 * lookup (which OTHER cards reference this same evidence).
 *
 * v1 was sky-blue glass: rounded-28px container, sky-300 borders,
 * backdrop-blur-xl, blue-tinted gradient CTA with rgba(56,189,248,0.25)
 * shadow halo. v2 is brutalist 1.5px paper border on ink-ash1, mono
 * kicker labels, paper-on-ink primary CTA. No glass, no glow.
 *
 * Functional surface unchanged: useQuery cardsReferencingEvidence,
 * highlightCards, clearHighlight — all wiring preserved.
 */

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
  const referenceCount = referencingCardIds?.length ?? 0

  const handleLocateCards = () => {
    if (referencingCardIds && referencingCardIds.length > 0) {
      highlightCards(referencingCardIds)
    }
  }

  return (
    <aside
      className={cn(
        'fixed right-4 top-20 bottom-8 z-40 w-[min(420px,calc(100vw-2rem))]',
        'bg-ink-ash1 border-[1.5px] border-paper/30',
        'flex flex-col overflow-hidden animate-editorial-publish',
        className
      )}
      role="dialog"
      aria-modal="false"
      aria-label="Evidence detail"
    >
      {/* Header — kicker EVIDENCE + Fraunces 标题 + close */}
      <header className="flex items-start justify-between border-b-[1px] border-ink-ash3/30 px-5 py-4 shrink-0">
        <div className="flex items-baseline gap-3 min-w-0">
          <FileText className="h-3.5 w-3.5 text-paper-ash3 shrink-0 self-center" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
              EVIDENCE · 证据来源
            </p>
            <h3
              className="mt-1 font-display font-[700] text-[15px] tracking-[0.02em] text-paper truncate"
              title={title}
            >
              {title}
            </h3>
            <p className="mt-1 font-instr text-[10px] tabular-nums text-ink-ash4">
              <span className="text-paper-ash3">DOC</span> {docId}
              {snippetId ? (
                <>
                  {' · '}
                  <span className="text-paper-ash3">CHUNK</span> {snippetId}
                </>
              ) : null}
              {typeof score === 'number' ? (
                <>
                  {' · '}
                  <span className="text-paper-ash3">REL</span> {score.toFixed(2)}
                </>
              ) : null}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            clearHighlight()
            closeDrawer()
          }}
          className="shrink-0 p-1.5 border-[0.5px] border-ink-ash3/40 text-paper-ash3 hover:border-paper/40 hover:text-paper transition-colors"
          aria-label="关闭"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </header>

      {/* Body */}
      <section className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Snippet */}
        <div>
          <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 mb-2">
            原文片段 · ORIGINAL SNIPPET
          </p>
          <div className="border-[0.5px] border-ink-ash3/30 bg-ink-ash2/20 px-4 py-3 font-body text-[13px] leading-[1.6] text-paper/85 max-w-measure-body">
            {snippetText || (
              <span className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
                — 该 evidence 原文在当前会话中不可见 —
              </span>
            )}
          </div>
        </div>

        {/* Reverse lookup — which BMC cards reference this evidence */}
        <div>
          <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3 mb-2">
            反向查询 · CARDS CITING THIS
          </p>
          <div className="border-[0.5px] border-ink-ash3/30 bg-ink-ash2/20 px-4 py-3 font-instr text-[11px] uppercase tracking-kicker">
            {isLoading ? (
              <span className="text-ink-ash4">查询中...</span>
            ) : referenceCount > 0 ? (
              <span className="text-paper">
                <span className="tabular-nums text-press">{referenceCount}</span>{' '}
                <span className="text-paper-ash3">张卡片引用此证据</span>
              </span>
            ) : (
              <span className="text-ink-ash4">尚未发现引用此证据的卡片</span>
            )}
          </div>
        </div>
      </section>

      {/* Footer — primary CTA paper-on-ink */}
      <footer className="border-t-[1px] border-ink-ash3/30 px-5 py-4 shrink-0">
        <button
          type="button"
          onClick={handleLocateCards}
          disabled={!referencingCardIds || referencingCardIds.length === 0}
          className={cn(
            'flex w-full items-center justify-center gap-2',
            'bg-paper text-ink px-4 py-2',
            'font-instr text-[10px] uppercase tracking-kicker',
            'hover:bg-paper-ash2 transition-colors',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-ink-ash2/40 disabled:text-ink-ash4'
          )}
        >
          <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
          定位相关卡片
          {drawer.highlightedCardIds.length > 0 ? (
            <span className="text-press tabular-nums">· 已高亮</span>
          ) : null}
        </button>
      </footer>
    </aside>
  )
}
