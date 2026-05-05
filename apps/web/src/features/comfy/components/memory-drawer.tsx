'use client'

/**
 * P2 · Memory drawer · 长期画像 / 会话记忆 / KB 引用 三 tab
 *
 * 用户能看到 / 改 / 删 AI 学到的关于自己的所有信息：
 *   - 个人画像 (kind='user-skill', scope='user'): 跨 workspace 全局画像
 *   - 当前 workspace (kind='summary' / 'insight' 等, workspace-scoped):
 *     这个 idea 范围内学到的
 *   - KB 引用历史: AI 在哪些会话引用了哪些 KB 文档，反查到原始 chunk
 *
 * 视觉沿用 Editorial Boardroom v2 token：
 *   - 左侧 sticky 三 tab + 计数 badge
 *   - 右侧条目列表 (EditorialProse 渲染 markdown 内容)
 *   - 每条带"标记不准 / 删除 / 来源"操作
 */

import { useMemo, useState } from 'react'
import { X, Trash2, AlertCircle, BookOpen, FileText } from 'lucide-react'
import { EditorialProse } from '../registries/renderers/editorial-prose'
import { useMyMemories, useMyKnowledgeEvidence, useCorrectMemoryItem, type MemoryItem, type KnowledgeEvidenceRef } from '../hooks/use-memory-list'

interface MemoryDrawerProps {
  open: boolean
  onClose: () => void
  /** 当前 workspaceId — 限定"workspace 学到的"标签页范围 */
  workspaceId?: string
}

type Tab = 'profile' | 'workspace' | 'kb-evidence'

const TAB_LABELS: Record<Tab, { kicker: string; title: string; description: string }> = {
  profile: {
    kicker: 'PROFILE',
    title: '个人画像',
    description: 'AI 跨所有项目对你的领域 / 风格 / 盲点的推断'
  },
  workspace: {
    kicker: 'WORKSPACE',
    title: '本项目记忆',
    description: '在当前 workspace 内积累的会话摘要 / 决策 / 见解'
  },
  'kb-evidence': {
    kicker: 'CITATIONS',
    title: 'KB 引用历史',
    description: 'AI 在你的会话中引用过哪些知识库文档'
  }
}

export function MemoryDrawer({ open, onClose, workspaceId }: MemoryDrawerProps) {
  const [tab, setTab] = useState<Tab>('profile')

  // Profile: cross-workspace user-skill rows (workspaceId omitted →
  // server returns scope='user' global rows).
  const profileQuery = useMyMemories({
    workspaceId: null,
    kind: 'user-skill',
    enabled: open && tab === 'profile'
  })
  const workspaceQuery = useMyMemories({
    workspaceId: workspaceId ?? null,
    enabled: open && tab === 'workspace' && Boolean(workspaceId)
  })
  const kbEvidenceQuery = useMyKnowledgeEvidence({
    workspaceId: workspaceId ?? null,
    enabled: open && tab === 'kb-evidence'
  })

  const tabCounts = useMemo(
    () => ({
      profile: profileQuery.data?.length ?? null,
      workspace: workspaceQuery.data?.length ?? null,
      'kb-evidence': kbEvidenceQuery.data?.length ?? null
    }),
    [profileQuery.data, workspaceQuery.data, kbEvidenceQuery.data]
  )

  if (!open) return null

  return (
    <aside
      className="fixed right-0 top-0 bottom-0 z-30 w-[820px] max-w-[90vw] flex flex-col bg-paper shadow-[-2px_0_0_0_#1A1A1A,-12px_0_24px_-12px_rgba(0,0,0,0.18)]"
      aria-label="记忆抽屉"
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b-[1.5px] border-stratum-navy">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-press">
            MEMORY
          </span>
          <h2 className="font-display font-[800] text-[20px] tracking-tight text-stratum-navy">
            长期画像与记忆
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="flex items-center justify-center h-8 w-8 rounded-full text-stratum-muted hover:text-stratum-navy hover:bg-stratum-surface-low transition-colors"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b-[0.5px] border-stratum-line bg-stratum-surface-low/30">
        {(Object.keys(TAB_LABELS) as Tab[]).map((id) => {
          const meta = TAB_LABELS[id]
          const active = tab === id
          const count = tabCounts[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 px-4 py-3 text-left border-r-[0.5px] last:border-r-0 border-stratum-line transition-colors ${
                active ? 'bg-white' : 'hover:bg-white/50'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span
                  className={`font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${
                    active ? 'text-press' : 'text-stratum-muted'
                  }`}
                >
                  {meta.kicker}
                </span>
                {count != null ? (
                  <span className="font-mono text-[9px] tabular-nums text-stratum-muted">
                    {count.toString().padStart(2, '0')}
                  </span>
                ) : null}
              </div>
              <p
                className={`font-display font-[700] text-[13px] tracking-tight ${
                  active ? 'text-stratum-navy' : 'text-stratum-muted'
                }`}
              >
                {meta.title}
              </p>
              <p className="font-body text-[10px] leading-snug text-stratum-muted mt-0.5 line-clamp-2">
                {meta.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tab === 'profile' ? (
          <MemoryListTab
            data={profileQuery.data}
            isLoading={profileQuery.isLoading}
            error={profileQuery.error}
            emptyHint="AI 还没有从你的会话里推断出长期画像。多用几次后回来看看。"
          />
        ) : null}
        {tab === 'workspace' ? (
          workspaceId ? (
            <MemoryListTab
              data={workspaceQuery.data}
              isLoading={workspaceQuery.isLoading}
              error={workspaceQuery.error}
              emptyHint="本 workspace 暂无会话摘要。"
            />
          ) : (
            <p className="font-body text-[13px] text-stratum-muted py-8 text-center">
              请先选择一个 workspace
            </p>
          )
        ) : null}
        {tab === 'kb-evidence' ? (
          <KbEvidenceTab
            data={kbEvidenceQuery.data}
            isLoading={kbEvidenceQuery.isLoading}
            error={kbEvidenceQuery.error}
          />
        ) : null}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-3 border-t-[0.5px] border-stratum-line bg-stratum-surface-low/40">
        <p className="font-body text-[10px] text-stratum-muted">
          这些数据按用户隔离，仅你可见
        </p>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-stratum-muted hover:text-stratum-navy"
        >
          ESC ↩
        </button>
      </footer>
    </aside>
  )
}

function MemoryListTab(props: {
  data: MemoryItem[] | undefined
  isLoading: boolean
  error: unknown
  emptyHint: string
}) {
  if (props.isLoading) {
    return <p className="font-body text-[13px] text-stratum-muted py-6">加载中…</p>
  }
  if (props.error) {
    return (
      <div className="border border-stratum-danger/40 bg-stratum-danger-wash/30 px-4 py-3 rounded">
        <p className="font-body text-[12px] text-stratum-danger">
          加载失败：{props.error instanceof Error ? props.error.message : '未知错误'}
        </p>
      </div>
    )
  }
  if (!props.data || props.data.length === 0) {
    return (
      <p className="font-body text-[13px] text-stratum-muted py-8 text-center italic">
        {props.emptyHint}
      </p>
    )
  }
  return (
    <ul className="space-y-4">
      {props.data.map((item) => (
        <MemoryItemCard key={item.id} item={item} />
      ))}
    </ul>
  )
}

function MemoryItemCard({ item }: { item: MemoryItem }) {
  const correct = useCorrectMemoryItem()
  const evidence = Array.isArray(item.tags) ? item.tags : []
  const confidencePct = Math.round((item.confidence ?? 0) * 100)
  const importancePct = Math.round((item.importance ?? 0) * 100)

  const handleArchive = () => {
    if (!window.confirm(`确认删除 "${item.title}"? 此操作不可撤销，但会让 AI 不再用此推断。`)) return
    correct.mutate({ itemId: item.id, archive: true })
  }
  const handleFlag = () => {
    const feedback = window.prompt(
      `告诉 AI 为什么 "${item.title}" 不准（可空，仅用于改进未来推断）：`,
      ''
    )
    if (feedback === null) return
    correct.mutate({ itemId: item.id, feedback: feedback.trim() })
  }

  return (
    <li className="border border-stratum-line bg-white px-4 py-3 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-shadow">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-stratum-muted">
              {item.kind} · {item.scope}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-stratum-muted">
              conf {confidencePct}% · imp {importancePct}%
            </span>
          </div>
          <h3 className="font-display font-[700] text-[14px] tracking-tight text-stratum-navy">
            {item.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleFlag}
            disabled={correct.isPending}
            aria-label="标记不准"
            className="p-1.5 text-stratum-muted hover:text-stratum-navy hover:bg-stratum-surface-low rounded transition-colors disabled:opacity-40"
          >
            <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={correct.isPending}
            aria-label="删除"
            className="p-1.5 text-stratum-muted hover:text-stratum-danger hover:bg-stratum-danger-wash/40 rounded transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </header>
      <div className="font-body text-[12.5px] leading-[1.65] text-stratum-ink">
        <EditorialProse content={item.content} density="compact" />
      </div>
      {evidence.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t-[0.5px] border-stratum-line">
          {evidence.slice(0, 8).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-stratum-muted bg-stratum-surface-low px-1.5 py-0.5 rounded-[2px]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <p className="font-mono text-[9px] tabular-nums text-stratum-muted mt-2">
        {new Date(item.updatedAt).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </p>
    </li>
  )
}

function KbEvidenceTab(props: {
  data: KnowledgeEvidenceRef[] | undefined
  isLoading: boolean
  error: unknown
}) {
  if (props.isLoading) {
    return <p className="font-body text-[13px] text-stratum-muted py-6">加载中…</p>
  }
  if (props.error) {
    return (
      <div className="border border-stratum-danger/40 bg-stratum-danger-wash/30 px-4 py-3 rounded">
        <p className="font-body text-[12px] text-stratum-danger">
          加载失败：{props.error instanceof Error ? props.error.message : '未知错误'}
        </p>
      </div>
    )
  }
  if (!props.data || props.data.length === 0) {
    return (
      <p className="font-body text-[13px] text-stratum-muted py-8 text-center italic">
        AI 还没有引用过 KB 文档。在会话里 @ agent 并提供 kbId 后，引用记录会出现在这里。
      </p>
    )
  }
  // Group by docId for compactness
  const byDoc = new Map<string, KnowledgeEvidenceRef[]>()
  for (const ev of props.data) {
    const list = byDoc.get(ev.docId) ?? []
    list.push(ev)
    byDoc.set(ev.docId, list)
  }
  return (
    <ul className="space-y-3">
      {Array.from(byDoc.entries()).map(([docId, refs]) => (
        <li key={docId} className="border border-stratum-line bg-white">
          <header className="flex items-center justify-between gap-2 px-3 py-2 border-b-[0.5px] border-stratum-line bg-stratum-surface-low/40">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="h-3.5 w-3.5 text-stratum-muted shrink-0" strokeWidth={1.5} />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-stratum-navy truncate">
                {docId}
              </span>
            </div>
            <span className="font-mono text-[9px] tabular-nums text-stratum-muted shrink-0">
              {refs.length} 次引用
            </span>
          </header>
          <ul>
            {refs.map((ref, i) => (
              <li
                key={`${ref.memoryItemId}-${i}`}
                className="px-3 py-2 border-b-[0.5px] border-stratum-line last:border-b-0 hover:bg-stratum-surface-low/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <FileText className="h-3 w-3 text-stratum-muted shrink-0" strokeWidth={1.5} />
                    <span className="font-display font-[700] text-[12px] tracking-tight text-stratum-navy truncate">
                      {ref.sourceTitle}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] tabular-nums text-stratum-muted shrink-0">
                    {ref.score != null ? `score ${ref.score.toFixed(2)}` : ''} ·{' '}
                    {new Date(ref.citedAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
                {ref.snippet ? (
                  <p className="font-body text-[11.5px] leading-[1.55] text-stratum-ink line-clamp-3 italic">
                    {ref.snippet}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
