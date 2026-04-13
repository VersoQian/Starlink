'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRightIcon } from '@radix-ui/react-icons'
import {
  useAddKnowledgeSeed,
  useCreateKnowledgeBase,
  useImportKnowledgeFiles,
  useImportKnowledgeUrl,
  useKbTaskStatus,
  useKnowledgeBaseStatus,
  useKnowledgeBases,
  usePublishKnowledgeBase
} from '@/features/knowledge/hooks'
import { ToolHeroCard } from '@/shared/components/tool-page-shell'
import type { KnowledgeTask } from '@/types/knowledge'
import { cn } from '@/shared/lib/utils'

const importOptions = [
  {
    id: 'file',
    title: 'Document ingestion',
    description: 'Upload pdf, office, audio, video or mixed files for OCR and semantic mapping.',
    actionLabel: 'Select files'
  },
  {
    id: 'link',
    title: 'Web extraction',
    description: 'Capture a remote page and turn it into reusable strategic fragments.',
    actionLabel: 'Add URL'
  }
]

const statusBadgeMap: Record<'pending' | 'processing' | 'succeeded' | 'failed', string> = {
  pending: '待处理',
  processing: '处理中',
  succeeded: '已完成',
  failed: '失败'
}

const taskTypeMap: Record<'seed' | 'file' | 'url', string> = {
  seed: '文本',
  file: '文件',
  url: '网页'
}

const taskTypeColorMap: Record<'seed' | 'file' | 'url', string> = {
  seed: '#F97316',
  file: '#22C55E',
  url: '#38BDF8'
}

function getPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function getPayloadNumber(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getTaskCardTitle(task: KnowledgeTask): string {
  if (task.type === 'file') {
    const path = getPayloadString(task.payload, 'path')
    if (!path) return `文件导入任务 ${task.id.slice(-6)}`
    const normalized = path.replace(/\\/g, '/')
    const fileName = normalized.split('/').pop()
    return fileName || `文件导入任务 ${task.id.slice(-6)}`
  }

  if (task.type === 'url') {
    const url = getPayloadString(task.payload, 'url')
    if (!url) return `网页导入任务 ${task.id.slice(-6)}`
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const length = getPayloadNumber(task.payload, 'length')
  return length ? `文本片段（${length} 字）` : `文本导入任务 ${task.id.slice(-6)}`
}

function getTaskCardSummary(task: KnowledgeTask): string {
  if (task.type === 'file') {
    const path = getPayloadString(task.payload, 'path')
    return path ? `源文件路径：${path}` : '文件任务已创建，等待索引任务完成。'
  }

  if (task.type === 'url') {
    const url = getPayloadString(task.payload, 'url')
    return url ? `来源链接：${url}` : '网页抓取任务已创建，等待内容抽取。'
  }

  const length = getPayloadNumber(task.payload, 'length')
  if (length) return `文本长度：${length} 字，任务状态将随处理进度更新。`
  return '文本种子已提交，等待切片与索引。'
}

function formatDate(value?: string | null) {
  if (!value) return 'Just now'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value))
  } catch {
    return value
  }
}

function getTaskProgress(task: KnowledgeTask) {
  if (task.status === 'succeeded') return 100
  if (task.status === 'failed') return 100
  if (task.status === 'processing') return 68
  return 22
}

type OperationNotice = {
  type: 'success' | 'error'
  message: string
} | null

type MergedTask = KnowledgeTask & {
  lastEventId?: string
  source: 'history' | 'realtime'
}

export default function KnowledgePage({ params }: { params: { workspaceId: string } }) {
  const [activeBaseId, setActiveBaseId] = useState('')
  const [inputText, setInputText] = useState('')
  const [activeImport, setActiveImport] = useState<'file' | 'link'>('file')
  const [linkValue, setLinkValue] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [fileFilter, setFileFilter] = useState('')
  const [latestOnly, setLatestOnly] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [aiMode, setAiMode] = useState<'ai' | 'manual'>('ai')
  const [operationNotice, setOperationNotice] = useState<OperationNotice>(null)

  const {
    data: knowledgeBases = [],
    isLoading: isKnowledgeBasesLoading,
    isError: isKnowledgeBasesError
  } = useKnowledgeBases(params.workspaceId)
  const createKnowledgeBaseMutation = useCreateKnowledgeBase(params.workspaceId)
  const publishKnowledgeBaseMutation = usePublishKnowledgeBase(params.workspaceId)
  const addKnowledgeSeedMutation = useAddKnowledgeSeed(params.workspaceId)
  const importKnowledgeUrlMutation = useImportKnowledgeUrl(params.workspaceId)
  const importKnowledgeFilesMutation = useImportKnowledgeFiles(params.workspaceId)

  useEffect(() => {
    if (knowledgeBases.length === 0) return
    const exists = knowledgeBases.some((item) => item.id === activeBaseId)
    if (!activeBaseId || !exists) {
      setActiveBaseId(knowledgeBases[0].id)
    }
  }, [activeBaseId, knowledgeBases])

  const activeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === activeBaseId) ?? knowledgeBases[0],
    [activeBaseId, knowledgeBases]
  )
  const {
    data: knowledgeBaseStatus,
    isLoading: isKnowledgeBaseStatusLoading,
    isError: isKnowledgeBaseStatusError
  } = useKnowledgeBaseStatus(params.workspaceId, activeBaseId)
  const {
    data: taskStatuses = [],
    isLoading: isTaskLoading,
    isError: isTaskError
  } = useKbTaskStatus(params.workspaceId, activeBaseId)

  const mergedTasks = useMemo<MergedTask[]>(() => {
    const byId = new Map<string, MergedTask>()

    for (const task of knowledgeBaseStatus?.tasks ?? []) {
      byId.set(task.id, {
        ...task,
        source: 'history'
      })
    }

    for (const eventTask of taskStatuses) {
      const existing = byId.get(eventTask.taskId)
      if (existing) {
        const nextError =
          eventTask.error !== null
            ? eventTask.error
            : eventTask.status === 'failed'
              ? (existing.error ?? null)
              : null
        byId.set(eventTask.taskId, {
          ...existing,
          type: eventTask.taskType,
          status: eventTask.status,
          error: nextError,
          updatedAt: eventTask.updatedAt > existing.updatedAt ? eventTask.updatedAt : existing.updatedAt,
          lastEventId: eventTask.lastEventId,
          source: 'realtime'
        })
        continue
      }

      byId.set(eventTask.taskId, {
        id: eventTask.taskId,
        workspaceId: eventTask.workspaceId,
        kbId: eventTask.kbId,
        type: eventTask.taskType,
        status: eventTask.status,
        payload: {},
        error: eventTask.error ?? null,
        createdAt: eventTask.updatedAt,
        updatedAt: eventTask.updatedAt,
        lastEventId: eventTask.lastEventId,
        source: 'realtime'
      })
    }

    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [knowledgeBaseStatus?.tasks, taskStatuses])

  const taskStats = useMemo(() => {
    return {
      total: mergedTasks.length,
      pending: mergedTasks.filter((task) => task.status === 'pending').length,
      processing: mergedTasks.filter((task) => task.status === 'processing').length,
      succeeded: mergedTasks.filter((task) => task.status === 'succeeded').length,
      failed: mergedTasks.filter((task) => task.status === 'failed').length
    }
  }, [mergedTasks])

  const activeBaseDescription = useMemo(() => {
    if (!activeBase) return '欢迎来到您的知识花园'
    if (activeBase.status === 'ready') return '可发布，适合生成洞察并同步画布'
    if (activeBase.status === 'processing') return '任务处理中，等待索引完成'
    return '草稿状态，可继续导入与整理'
  }, [activeBase])

  const importedTasks = useMemo(() => {
    const filter = fileFilter.trim().toLowerCase()

    const matched = filter
      ? mergedTasks.filter((task) => {
          const title = getTaskCardTitle(task).toLowerCase()
          const summary = getTaskCardSummary(task).toLowerCase()
          return (
            title.includes(filter) ||
            summary.includes(filter) ||
            task.type.includes(filter) ||
            task.status.includes(filter) ||
            task.id.toLowerCase().includes(filter)
          )
        })
      : mergedTasks

    return latestOnly ? matched.slice(0, 6) : matched
  }, [fileFilter, latestOnly, mergedTasks])

  const extractedThemes = useMemo(() => {
    const tokens = new Set<string>()
    if (activeBase?.status) {
      tokens.add(activeBase.status === 'ready' ? 'Research Ready' : `Status ${activeBase.status}`)
    }
    importedTasks.forEach((task) => {
      if (task.type === 'file') tokens.add('File OCR')
      if (task.type === 'url') tokens.add('Web Extraction')
      if (task.type === 'seed') tokens.add('Text Seeds')
      if (task.status === 'processing') tokens.add('Live Indexing')
      if (task.status === 'succeeded') tokens.add('Structured Fragments')
    })
    return [...tokens].slice(0, 6)
  }, [activeBase?.status, importedTasks])

  const integrityScore = useMemo(() => {
    if (taskStats.total === 0) return 100
    const score = Math.round(((taskStats.succeeded + taskStats.processing * 0.7 + taskStats.pending * 0.4) / taskStats.total) * 100)
    return Math.min(100, Math.max(62, score))
  }, [taskStats])

  const queueTasks = importedTasks.slice(0, 3)
  const isTaskCenterLoading = isKnowledgeBaseStatusLoading || isTaskLoading
  const isTaskCenterError = isKnowledgeBaseStatusError && isTaskError
  const isTaskCenterPartialError = (isKnowledgeBaseStatusError || isTaskError) && !isTaskCenterError

  const handleCreateKnowledgeBase = async () => {
    try {
      const created = await createKnowledgeBaseMutation.mutateAsync()
      setActiveBaseId(created.id)
      setOperationNotice({ type: 'success', message: `已创建知识库：${created.name}` })
    } catch (error) {
      console.error('Failed to create knowledge base', error)
      setOperationNotice({ type: 'error', message: '创建知识库失败，请稍后重试。' })
    }
  }

  const handlePublishKnowledgeBase = async () => {
    if (!activeBaseId) {
      setOperationNotice({ type: 'error', message: '请先选择一个 Knowledge Base。' })
      return
    }
    try {
      const published = await publishKnowledgeBaseMutation.mutateAsync({ kbId: activeBaseId })
      setOperationNotice({ type: 'success', message: `已发布：${published.name}` })
    } catch (error) {
      console.error('Failed to publish knowledge base', error)
      setOperationNotice({ type: 'error', message: '发布失败，请检查服务状态。' })
    }
  }

  const handleAddSeed = async () => {
    if (!activeBaseId) {
      setOperationNotice({ type: 'error', message: '请先选择一个 Knowledge Base。' })
      return
    }
    const text = inputText.trim()
    if (!text) {
      setOperationNotice({ type: 'error', message: '请输入要导入的文本。' })
      return
    }
    try {
      const task = await addKnowledgeSeedMutation.mutateAsync({ kbId: activeBaseId, text })
      setInputText('')
      setOperationNotice({ type: 'success', message: `文本导入任务已创建：${task.id}` })
    } catch (error) {
      console.error('Failed to add knowledge seed', error)
      setOperationNotice({ type: 'error', message: '文本导入失败，请稍后重试。' })
    }
  }

  const handleImportUrl = async () => {
    if (!activeBaseId) {
      setOperationNotice({ type: 'error', message: '请先选择一个 Knowledge Base。' })
      return
    }
    const url = linkValue.trim()
    if (!/^https?:\/\//i.test(url)) {
      setOperationNotice({ type: 'error', message: '请输入合法的 http/https URL。' })
      return
    }
    try {
      const task = await importKnowledgeUrlMutation.mutateAsync({ kbId: activeBaseId, url })
      setLinkValue('')
      setOperationNotice({ type: 'success', message: `URL 导入任务已创建：${task.id}` })
    } catch (error) {
      console.error('Failed to import knowledge url', error)
      setOperationNotice({ type: 'error', message: 'URL 导入失败，请稍后重试。' })
    }
  }

  const handleImportFiles = async () => {
    if (!activeBaseId) {
      setOperationNotice({ type: 'error', message: '请先选择一个 Knowledge Base。' })
      return
    }
    if (selectedFiles.length === 0) {
      setOperationNotice({ type: 'error', message: '请先选择至少一个文件。' })
      return
    }

    try {
      setUploadProgress(0)
      const tasks = await importKnowledgeFilesMutation.mutateAsync({
        kbId: activeBaseId,
        files: selectedFiles,
        retryCount: 2,
        onProgress: (percentage) => setUploadProgress(percentage)
      })
      setUploadProgress(100)
      setSelectedFiles([])
      setOperationNotice({
        type: 'success',
        message: `文件导入任务已创建 ${tasks.length} 个。`
      })
    } catch (error) {
      console.error('Failed to import files', error)
      setUploadProgress(null)
      setOperationNotice({ type: 'error', message: '文件导入失败，请稍后重试。' })
    }
  }

  return (
    <div className="space-y-8 text-[var(--stratum-ink)]">
      <ToolHeroCard
        theme="ocean"
        eyebrow="@knowledge"
        title="Knowledge Input Console"
        description="这里只负责导入、整理和供给证据，不再承担工作区主战场职责。完成资料处理后，建议回到智慧画布继续建模，或交给 @research 做进一步提炼。"
        actions={
          <>
            <Link
              href={`/workspace/${params.workspaceId}/canvas` as Route}
              className="rounded-full bg-[var(--stratum-navy)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              返回智慧画布
            </Link>
            <Link
              href={`/workspace/${params.workspaceId}/deep-research` as Route}
              className="rounded-full bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              打开研究工具
            </Link>
          </>
        }
        stats={[
          {
            label: 'Sources',
            value: `${taskStats.total}`,
            detail: '当前工作区已接入的知识来源'
          },
          {
            label: 'Indexed',
            value: `${taskStats.succeeded + taskStats.processing}`,
            detail: '已经索引或正在处理中的条目'
          },
          {
            label: 'Integrity',
            value: `${integrityScore}%`,
            detail: activeBaseDescription
          },
          {
            label: 'Themes',
            value: `${extractedThemes.length || 2}`,
            detail: '自动聚合出的资料主题簇'
          }
        ]}
      />

      <section className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Tool Status</p>
          <h2 className="stratum-display mt-3 text-4xl font-semibold leading-none">Knowledge Base</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500">
            Assemble and synthesize multi-source intelligence for AI-driven strategy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCreateKnowledgeBase}
            disabled={createKnowledgeBaseMutation.isPending}
            data-testid="kb-create-button"
            className="rounded-2xl bg-[var(--stratum-navy)] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(19,27,46,0.18)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createKnowledgeBaseMutation.isPending ? 'Creating...' : '+ New Data Source'}
          </button>
          <button
            onClick={handlePublishKnowledgeBase}
            disabled={!activeBaseId || publishKnowledgeBaseMutation.isPending}
            className="rounded-2xl bg-[var(--stratum-surface-low)] px-5 py-4 text-sm font-medium text-[var(--stratum-navy)] transition hover:bg-[#e9edf2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishKnowledgeBaseMutation.isPending ? 'Publishing...' : 'Publish KB'}
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="stratum-card rounded-[28px] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Total Sources</p>
            <p className="mt-4 text-5xl font-semibold text-[var(--stratum-ink)]">{taskStats.total}</p>
            <p className="mt-2 text-sm text-slate-500">Current ingestion payload across files, links and text seeds.</p>
          </article>
          <article className="stratum-card rounded-[28px] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Index Volume</p>
            <p className="mt-4 text-5xl font-semibold text-[var(--stratum-ink)]">{taskStats.succeeded + taskStats.processing}</p>
            <p className="mt-2 text-sm text-slate-500">Documents already indexed or currently moving through the queue.</p>
          </article>
          <article className="stratum-card rounded-[28px] border border-[rgba(137,206,255,0.4)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Integrity Score</p>
            <p className="mt-4 text-5xl font-semibold text-[var(--stratum-blue)]">{integrityScore}%</p>
            <p className="mt-2 text-sm text-slate-500">{activeBaseDescription}</p>
          </article>
        </div>

        <aside className="stratum-card rounded-[28px] p-6">
          <h2 className="stratum-display text-3xl font-semibold">Extracted Themes</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {(extractedThemes.length > 0 ? extractedThemes : ['Ingestion Ready', 'Workspace Sync']).map((theme) => (
              <span
                key={theme}
                className="rounded-full bg-[var(--stratum-surface-low)] px-3 py-2 text-sm text-slate-500"
              >
                {theme}
              </span>
            ))}
          </div>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_300px]">
        <div>
          <h2 className="stratum-display text-3xl font-semibold">Active Processing Queue</h2>
          <div className="mt-5 space-y-4">
            {(queueTasks.length > 0
              ? queueTasks
              : [
                  {
                    id: 'empty',
                    type: 'seed',
                    status: 'pending',
                    payload: {},
                    workspaceId: params.workspaceId,
                    kbId: activeBaseId || 'default',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    source: 'history'
                  } as MergedTask
                ]
            ).map((task) => (
              <article key={task.id} className="stratum-card rounded-[28px] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--stratum-surface-low)] text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {task.type === 'file' ? 'DOC' : task.type === 'url' ? 'URL' : 'TXT'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-[var(--stratum-ink)]">{task.id === 'empty' ? 'Waiting for first source' : getTaskCardTitle(task)}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {task.id === 'empty' ? 'Create a knowledge base or add a source to activate the queue.' : getTaskCardSummary(task)}
                        </p>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--stratum-blue)]">
                        {task.id === 'empty' ? 'idle' : statusBadgeMap[task.status]}
                      </p>
                    </div>
                    <div className="mt-4 h-1.5 rounded-full bg-black/[0.08]">
                      <div
                        className={cn(
                          'h-1.5 rounded-full',
                          task.status === 'failed' ? 'bg-rose-400' : 'bg-[var(--stratum-blue)]'
                        )}
                        style={{ width: `${getTaskProgress(task)}%` }}
                      />
                    </div>
                    {task.status === 'succeeded' && task.id !== 'empty' && (
                      <div className="mt-4 rounded-2xl bg-[var(--stratum-surface-low)] px-4 py-3 text-sm italic leading-6 text-slate-500">
                        “{getTaskCardSummary(task)}”
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <article className="stratum-card rounded-[28px] p-7">
            <h2 className="stratum-display text-4xl font-semibold leading-none">Ready for Synthesized Analysis?</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              Knowledge Base 已经沉淀到可供研究模块复用的状态。可以直接进入 Deep Research 生成执行摘要与策略建议。
            </p>
            <Link
              href={`/workspace/${params.workspaceId}/deep-research` as Route}
              className="mt-8 inline-flex items-center gap-3 rounded-2xl bg-[var(--stratum-glow)] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(19,27,46,0.18)]"
            >
              Start Deep Research
              <ArrowRightIcon />
            </Link>
          </article>

          <article className="rounded-[24px] bg-[var(--stratum-navy)] px-5 py-4 text-white shadow-[0_22px_44px_rgba(19,27,46,0.18)]">
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Infrastructure Status</p>
            <p className="mt-3 text-sm text-white/72">
              Contextual Engine: {taskStats.processing > 0 ? 'Syncing workspace nodes...' : 'Idle and ready.'}
            </p>
          </article>
        </aside>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_380px]">
        <article className="stratum-card rounded-[32px] p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Source Studio</p>
              <h2 className="stratum-display mt-2 text-3xl font-semibold">Manual Seeds</h2>
            </div>
            <button
              onClick={() => setAiMode(aiMode === 'ai' ? 'manual' : 'ai')}
              className={cn(
                'rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]',
                aiMode === 'ai' ? 'bg-[#eaf4ff] text-[var(--stratum-blue)]' : 'bg-[var(--stratum-surface-low)] text-slate-500'
              )}
            >
              {aiMode === 'ai' ? 'AI mode' : 'Manual mode'}
            </button>
          </div>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            data-testid="kb-seed-textarea"
            placeholder="在此输入或粘贴文本，构建新的知识种子..."
            className="mt-5 h-56 w-full rounded-[28px] bg-[var(--stratum-surface-low)] px-5 py-4 text-sm leading-7 text-[var(--stratum-ink)] outline-none placeholder:text-slate-400"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">支持粘贴摘要、访谈原文、竞品记录与长文本资料。</p>
            <button
              onClick={handleAddSeed}
              disabled={!activeBaseId || addKnowledgeSeedMutation.isPending}
              data-testid="kb-add-seed-button"
              className="rounded-2xl bg-[var(--stratum-navy)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addKnowledgeSeedMutation.isPending ? 'Submitting...' : 'Add seed'}
            </button>
          </div>
        </article>

        <div className="space-y-4">
          {importOptions.map((option) => (
            <article
              key={option.id}
              className={cn(
                'stratum-card rounded-[28px] p-5 transition',
                activeImport === option.id ? 'ring-1 ring-[rgba(0,140,199,0.35)]' : ''
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-[var(--stratum-ink)]">{option.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{option.description}</p>
                </div>
                <button
                  onClick={() => setActiveImport(option.id as 'file' | 'link')}
                  className="rounded-full bg-[var(--stratum-surface-low)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  {option.actionLabel}
                </button>
              </div>

              {option.id === 'link' ? (
                <div className="mt-4 space-y-3">
                  <input
                    value={linkValue}
                    onChange={(event) => setLinkValue(event.target.value)}
                    data-testid="kb-url-input"
                    placeholder="https://..."
                    className="w-full rounded-2xl bg-[var(--stratum-surface-low)] px-4 py-3 text-sm outline-none placeholder:text-slate-400"
                  />
                  <button
                    onClick={handleImportUrl}
                    disabled={!activeBaseId || importKnowledgeUrlMutation.isPending}
                    data-testid="kb-import-url-button"
                    className="w-full rounded-2xl bg-[var(--stratum-navy)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {importKnowledgeUrlMutation.isPending ? 'Importing...' : 'Import URL'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-dashed border-[rgba(19,27,46,0.12)] bg-[var(--stratum-surface-low)] px-4 py-4">
                    <input
                      type="file"
                      multiple
                      data-testid="kb-file-input"
                      onChange={(event) => {
                        const files = event.target.files ? Array.from(event.target.files) : []
                        setSelectedFiles(files)
                        setUploadProgress(null)
                      }}
                      className="w-full text-sm text-slate-500"
                    />
                  </div>
                  {selectedFiles.length > 0 && (
                    <p className="text-xs leading-5 text-slate-500">
                      已选择 {selectedFiles.length} 个文件：{selectedFiles.slice(0, 2).map((file) => file.name).join('，')}
                      {selectedFiles.length > 2 ? ' ...' : ''}
                    </p>
                  )}
                  {uploadProgress !== null && (
                    <p className="text-xs leading-5 text-slate-500">上传进度：{uploadProgress}%</p>
                  )}
                  <button
                    onClick={handleImportFiles}
                    disabled={!activeBaseId || importKnowledgeFilesMutation.isPending}
                    data-testid="kb-import-file-button"
                    className="w-full rounded-2xl bg-[var(--stratum-navy)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {importKnowledgeFilesMutation.isPending ? 'Uploading...' : 'Upload and ingest'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="stratum-card rounded-[32px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Knowledge Bases</p>
            <h2 className="stratum-display mt-2 text-3xl font-semibold">Current Collections</h2>
          </div>
          {operationNotice && (
            <p
              className={cn(
                'rounded-2xl px-4 py-3 text-sm',
                operationNotice.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              )}
            >
              {operationNotice.message}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {isKnowledgeBasesError && (
            <p className="w-full text-sm text-rose-600">知识库列表加载失败，请检查 Gateway 与 Task Service。</p>
          )}
          {knowledgeBases.map((kb) => (
            <button
              key={kb.id}
              onClick={() => setActiveBaseId(kb.id)}
              className={cn(
                'rounded-[24px] px-4 py-4 text-left transition',
                activeBaseId === kb.id
                  ? 'bg-[#eaf4ff] text-[var(--stratum-blue)] shadow-[0_12px_28px_rgba(0,140,199,0.08)]'
                  : 'bg-[var(--stratum-surface-low)] text-slate-500'
              )}
            >
              <p className="font-semibold">{kb.name}</p>
              <p className="mt-1 text-xs">状态 {kb.status} · 更新于 {formatDate(kb.updatedAt)}</p>
            </button>
          ))}
          {!isKnowledgeBasesLoading && knowledgeBases.length === 0 && (
            <p className="text-sm text-slate-500">暂无 Knowledge Base，请先创建一个。</p>
          )}
        </div>
      </section>

      <section data-testid="knowledge-task-center" className="rounded-[32px] bg-[var(--stratum-navy)] p-8 text-white shadow-[0_30px_60px_rgba(19,27,46,0.18)]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="stratum-display text-3xl font-semibold">Task Center</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65">
              当前 KB：{activeBaseId || '-'}。任务来源于实时事件与历史聚合，按 Task ID 合并去重。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/72">
            <span className="rounded-full border border-white/15 px-3 py-1">总计 {taskStats.total}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">待处理 {taskStats.pending}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">处理中 {taskStats.processing}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">完成 {taskStats.succeeded}</span>
            <span className="rounded-full border border-white/15 px-3 py-1">失败 {taskStats.failed}</span>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/72">
            <span>筛选</span>
            <input
              value={fileFilter}
              onChange={(event) => setFileFilter(event.target.value)}
              data-testid="kb-task-filter-input"
              placeholder="任务名 / 类型 / 状态 / ID"
              className="w-52 bg-transparent text-white placeholder:text-white/35 outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setLatestOnly((current) => !current)}
              className={cn(
                'rounded-full border px-4 py-2 text-xs transition',
                latestOnly ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : 'border-white/20 text-white/75 hover:bg-white/10'
              )}
            >
              {latestOnly ? '仅最新 6 条' : '显示全部'}
            </button>
            <button
              onClick={() => setFileFilter('')}
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/75 transition hover:bg-white/10"
            >
              清空筛选
            </button>
          </div>
        </div>

        {isTaskCenterLoading && (
          <p className="mt-6 text-sm text-white/65">正在同步任务中心数据...</p>
        )}
        {isTaskCenterError && (
          <p className="mt-6 text-sm text-rose-200">任务中心加载失败，请检查 Gateway 与 Task Service 链路。</p>
        )}
        {isTaskCenterPartialError && (
          <p className="mt-6 text-sm text-amber-100">部分任务源加载失败，当前展示的是可用数据。</p>
        )}
        {!isTaskCenterLoading && !isTaskCenterError && importedTasks.length === 0 && (
          <p className="mt-6 text-sm text-white/65">暂无导入任务。可先上传文件、粘贴文本或导入 URL。</p>
        )}

        {!isTaskCenterLoading && !isTaskCenterError && importedTasks.length > 0 && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {importedTasks.map((task) => (
              <article
                key={task.id}
                data-testid="kb-task-card"
                className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 transition hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/55">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: taskTypeColorMap[task.type] }}
                    />
                    {taskTypeMap[task.type]}
                  </span>
                  <span>{formatDate(task.updatedAt)}</span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-lg font-semibold text-white">{getTaskCardTitle(task)}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-7 text-white/68">{getTaskCardSummary(task)}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/55">
                  <span className="rounded-full border border-white/15 px-3 py-1">#{task.type}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1">#{task.status}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1">
                    {task.source === 'realtime' ? '#实时' : '#历史'}
                  </span>
                  {task.error && (
                    <span className="rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-rose-100">
                      #error
                    </span>
                  )}
                </div>

                <div className="mt-5 h-1.5 rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-1.5 rounded-full',
                      task.status === 'failed' ? 'bg-rose-400' : 'bg-[var(--stratum-sky)]'
                    )}
                    style={{ width: `${getTaskProgress(task)}%` }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-white/55">
                  <span>{statusBadgeMap[task.status]}</span>
                  <span className="rounded-full border border-white/15 px-3 py-1 font-mono">ID {task.id.slice(-8)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
