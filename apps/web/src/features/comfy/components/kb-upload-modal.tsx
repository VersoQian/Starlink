'use client'

/**
 * KB Upload Modal — Mode B 入口共享组件 (canvas / homepage / /knowledge
 * 三处都用)。三种 source：
 *   1. paste-text  — addKnowledgeSeed mutation
 *   2. import-url  — importKnowledgeUrl mutation
 *   3. upload-file — POST /kb/:kbId/import/file (要 task service 4001)
 *
 * 流程：
 *   - 进 modal → 拉 knowledgeBases(workspaceId) 列出已有 KB
 *   - 没 KB → "新建知识库" → createKnowledgeBase mutation
 *   - 选定 KB → 选 source → 提交 → 后台 ingest
 *   - 完成后 onAnalyze callback → 上层用 kbId 触发 startConversation
 */

import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, FileText, Globe, Pencil, Plus, Sparkles, Upload, X } from 'lucide-react'
import { getGraphQLClient } from '@/shared/lib/graphql-client'

const KB_LIST = /* GraphQL */ `
  query KbList($workspaceId: ID!) {
    knowledgeBases(workspaceId: $workspaceId) {
      id workspaceId name description status sourceCount lastIngestAt
    }
  }
`

const KB_CREATE = /* GraphQL */ `
  mutation KbCreate($workspaceId: ID!, $visibility: String) {
    createKnowledgeBase(workspaceId: $workspaceId, visibility: $visibility) {
      id workspaceId name description status sourceCount visibility
    }
  }
`

const KB_ADD_SEED = /* GraphQL */ `
  mutation KbAddSeed($workspaceId: ID!, $kbId: ID!, $text: String!) {
    addKnowledgeSeed(workspaceId: $workspaceId, kbId: $kbId, text: $text) {
      id status
    }
  }
`

const KB_IMPORT_URL = /* GraphQL */ `
  mutation KbImportUrl($workspaceId: ID!, $kbId: ID!, $url: String!) {
    importKnowledgeUrl(workspaceId: $workspaceId, kbId: $kbId, url: $url) {
      id status
    }
  }
`

type KnowledgeBase = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  status: string
  sourceCount: number
  lastIngestAt: string | null
}

type SourceTab = 'text' | 'url' | 'file'

type Props = {
  open: boolean
  workspaceId: string
  onClose: () => void
  /** Called with the chosen KB id when user clicks "用此资料生成 BMC". */
  onAnalyze?: (kbId: string) => void
}

export function KbUploadModal({ open, workspaceId, onClose, onAnalyze }: Props) {
  const qc = useQueryClient()
  const [activeKbId, setActiveKbId] = useState<string | null>(null)
  const [sourceTab, setSourceTab] = useState<SourceTab>('text')
  const [textInput, setTextInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [submittingSource, setSubmittingSource] = useState(false)
  const [submitNote, setSubmitNote] = useState<string | null>(null)

  const { data: kbs, isLoading: kbsLoading } = useQuery({
    queryKey: ['kbList', workspaceId],
    queryFn: async () => {
      const client = getGraphQLClient()
      const r = await client.request<{ knowledgeBases: KnowledgeBase[] }>(KB_LIST, { workspaceId })
      return r.knowledgeBases ?? []
    },
    enabled: open && !!workspaceId,
    staleTime: 10_000,
  })

  // Auto-select most-recent or first KB on open
  useEffect(() => {
    if (!open) return
    if (activeKbId || !kbs || kbs.length === 0) return
    setActiveKbId(kbs[0].id)
  }, [open, kbs, activeKbId])

  // F1 · KB visibility selector. Defaults to 'workspace' (legacy
  // behaviour: shared with all members). Users uploading personal
  // documents can pick 'private' so other workspace members can't
  // search those chunks even when they share the workspace.
  const [newKbVisibility, setNewKbVisibility] = useState<'private' | 'workspace' | 'global'>('workspace')

  const createMutation = useMutation({
    mutationFn: async () => {
      const client = getGraphQLClient()
      const r = await client.request<{ createKnowledgeBase: KnowledgeBase }>(KB_CREATE, {
        workspaceId,
        visibility: newKbVisibility
      })
      return r.createKnowledgeBase
    },
    onSuccess: (kb) => {
      void qc.invalidateQueries({ queryKey: ['kbList', workspaceId] })
      setActiveKbId(kb.id)
      setSubmitNote(`已创建知识库 ${kb.id.slice(0, 8)}… · ${newKbVisibility === 'private' ? '私人' : newKbVisibility === 'global' ? '全局' : '工作区'}`)
    },
  })

  const handleSubmitSource = useCallback(async () => {
    if (!activeKbId || submittingSource) return
    setSubmittingSource(true)
    setSubmitNote(null)
    const client = getGraphQLClient()
    try {
      if (sourceTab === 'text') {
        if (!textInput.trim()) throw new Error('文本不能为空')
        await client.request(KB_ADD_SEED, { workspaceId, kbId: activeKbId, text: textInput.trim() })
        setTextInput('')
        setSubmitNote('文本已入库，agent 后台 chunk + embed 中…')
      } else if (sourceTab === 'url') {
        if (!urlInput.trim()) throw new Error('URL 不能为空')
        await client.request(KB_IMPORT_URL, { workspaceId, kbId: activeKbId, url: urlInput.trim() })
        setUrlInput('')
        setSubmitNote('URL 已提交抓取，agent 后台分析中…')
      } else if (sourceTab === 'file') {
        setSubmitNote('文件上传需要 KB task service (port 4001) — 当前未运行；先用文本/URL 替代')
      }
      void qc.invalidateQueries({ queryKey: ['kbList', workspaceId] })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSubmitNote(`失败：${msg.slice(0, 200)}`)
    } finally {
      setSubmittingSource(false)
    }
  }, [activeKbId, submittingSource, sourceTab, textInput, urlInput, workspaceId, qc])

  if (!open) return null

  const activeKb = kbs?.find((k) => k.id === activeKbId) ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stratum-navy/40 backdrop-blur-sm p-6"
      role="dialog"
      aria-modal="true"
      aria-label="KB 资料上传"
    >
      <article className="w-full max-w-[720px] rounded-2xl bg-white shadow-2xl border border-stratum-line overflow-hidden flex flex-col max-h-[85vh]">
        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-stratum-line">
          <div className="flex items-start gap-3 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stratum-navy">
              <Database className="h-4 w-4 text-stratum-sky" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-stratum-blue">
                KNOWLEDGE BASE · 资料分析入口
              </p>
              <h2 className="mt-1 font-display font-[700] text-[20px] tracking-tight text-stratum-navy">
                上传资料 → AI 抽取 → 生成 BMC
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-stratum-muted hover:bg-stratum-surface-low hover:text-stratum-navy transition-colors"
            aria-label="关闭"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* KB selector strip */}
          <section>
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-stratum-muted mb-2">
              选择知识库 · {kbs?.length ?? 0} 个
            </p>
            {kbsLoading ? (
              <p className="font-body text-[12px] text-stratum-muted">载入中…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(kbs ?? []).map((kb) => (
                  <button
                    key={kb.id}
                    type="button"
                    onClick={() => setActiveKbId(kb.id)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                      activeKbId === kb.id
                        ? 'border-stratum-blue bg-stratum-blue/10 text-stratum-navy'
                        : 'border-stratum-line bg-stratum-surface-low text-stratum-ink hover:border-stratum-blue/40'
                    }`}
                  >
                    <Database className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="font-body text-[12px] font-medium">{kb.name || `KB ${kb.id.slice(0, 6)}`}</span>
                    <span className="font-body text-[10px] tabular-nums text-stratum-muted">
                      {kb.sourceCount} 项
                    </span>
                  </button>
                ))}
                <div className="flex items-center gap-2">
                  {/* F1 · Visibility selector — drives whether the new KB
                      is private to the caller, shared with the workspace,
                      or globally visible. Default 'workspace' matches the
                      legacy behaviour pre-isolation. */}
                  <select
                    value={newKbVisibility}
                    onChange={(e) => setNewKbVisibility(e.target.value as 'private' | 'workspace' | 'global')}
                    className="rounded-lg border border-stratum-line bg-white px-2 py-2 font-body text-[11px] text-stratum-ink focus:border-stratum-blue focus:outline-none"
                    disabled={createMutation.isPending}
                    aria-label="新建知识库的可见性"
                  >
                    <option value="private">🔒 私人 · 只我可搜</option>
                    <option value="workspace">👥 工作区 · 所有成员可搜</option>
                    <option value="global">🌐 全局 · 所有用户可搜</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-stratum-line bg-white px-3 py-2 text-stratum-muted hover:border-stratum-blue/40 hover:text-stratum-blue transition-colors disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="font-body text-[12px] font-medium">
                      {createMutation.isPending ? '创建中…' : '新建知识库'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Source tabs */}
          {activeKb ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-stratum-muted">
                  添加资料到 {activeKb.name || `KB ${activeKb.id.slice(0, 6)}`}
                </p>
                <span
                  className={`font-body text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    activeKb.status === 'published'
                      ? 'bg-stratum-ok-wash text-stratum-ok'
                      : 'bg-stratum-surface-low text-stratum-muted'
                  }`}
                >
                  {activeKb.status}
                </span>
              </div>
              <nav role="tablist" className="flex items-center gap-1 mb-3 border-b border-stratum-line">
                <SourceTabBtn id="text" current={sourceTab} setTab={setSourceTab} icon={Pencil} label="文本笔记" />
                <SourceTabBtn id="url"  current={sourceTab} setTab={setSourceTab} icon={Globe}  label="导入 URL" />
                <SourceTabBtn id="file" current={sourceTab} setTab={setSourceTab} icon={Upload} label="上传文件" />
              </nav>

              {sourceTab === 'text' ? (
                <div>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="贴入访谈纪录 / 竞品分析 / 市场报告片段…&#10;agent 会拆 chunk + embed 后存入 KB"
                    rows={6}
                    className="w-full resize-y rounded-lg border border-stratum-line bg-stratum-surface-low px-3 py-2.5 font-body text-[13px] leading-relaxed text-stratum-navy outline-none focus:border-stratum-blue focus:ring-2 focus:ring-stratum-blue/20"
                  />
                </div>
              ) : null}

              {sourceTab === 'url' ? (
                <div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/article 或 PDF / 文档直链"
                    className="w-full rounded-lg border border-stratum-line bg-stratum-surface-low px-3 py-2.5 font-body text-[13px] text-stratum-navy outline-none focus:border-stratum-blue focus:ring-2 focus:ring-stratum-blue/20"
                  />
                  <p className="mt-2 font-body text-[11px] text-stratum-muted">
                    支持 http(s) 抓取 → 提取正文 → chunk → embed
                  </p>
                </div>
              ) : null}

              {sourceTab === 'file' ? (
                <div className="rounded-lg border-2 border-dashed border-stratum-line bg-stratum-surface-low p-6 text-center">
                  <Upload className="h-6 w-6 text-stratum-blue/40 mx-auto mb-2" strokeWidth={1.5} />
                  <p className="font-body text-[12px] text-stratum-muted leading-relaxed">
                    需要 KB task service (port 4001) 启动。<br />
                    暂用左侧「文本笔记」或「导入 URL」替代。
                  </p>
                </div>
              ) : null}

              {submitNote ? (
                <p
                  className={`mt-2 font-body text-[11px] ${
                    submitNote.startsWith('失败') ? 'text-stratum-danger' : 'text-stratum-blue'
                  }`}
                >
                  {submitNote}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-lg border border-dashed border-stratum-line bg-stratum-surface-low/50 p-6 text-center">
              <FileText className="h-6 w-6 text-stratum-blue/40 mx-auto mb-2" strokeWidth={1.5} />
              <p className="font-body text-[12px] text-stratum-muted">
                还没有知识库——点上面「新建知识库」开始
              </p>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-6 py-4 bg-stratum-surface-low border-t border-stratum-line">
          <button
            type="button"
            onClick={handleSubmitSource}
            disabled={!activeKbId || submittingSource || sourceTab === 'file'}
            className="rounded-full border border-stratum-line bg-white px-4 py-2 font-body text-[11px] font-semibold text-stratum-navy hover:border-stratum-blue/40 hover:text-stratum-blue transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submittingSource ? '提交中…' : '添加到 KB'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-2 font-body text-[11px] font-semibold text-stratum-muted hover:text-stratum-navy transition-colors"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeKbId && onAnalyze) {
                  onAnalyze(activeKbId)
                  onClose()
                }
              }}
              disabled={!activeKb || activeKb.sourceCount === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-stratum-navy px-4 py-2 font-body text-[11px] font-bold text-white hover:bg-stratum-navy-soft transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5 text-stratum-sky" strokeWidth={2} fill="#89CEFF" />
              基于此 KB 生成 BMC
            </button>
          </div>
        </footer>
      </article>
    </div>
  )
}

function SourceTabBtn({
  id,
  current,
  setTab,
  icon: Icon,
  label,
}: {
  id: SourceTab
  current: SourceTab
  setTab: (t: SourceTab) => void
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
}) {
  const isActive = current === id
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3 py-2 -mb-px font-body text-[12px] font-semibold transition-colors ${
        isActive
          ? 'border-b-2 border-stratum-blue text-stratum-navy'
          : 'border-b-2 border-transparent text-stratum-muted hover:text-stratum-navy'
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  )
}
