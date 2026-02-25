'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme, cn } from '@/lib/theme'
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
import type { KnowledgeTask } from '@/types/knowledge'

const importOptions = [
  {
    id: 'file',
    title: '从文件导入',
    description: '上传文档内容，支持 image / pdf / txt / ms-office / audio / video',
    actionLabel: '选择文件'
  },
  {
    id: 'link',
    title: '从网页链接导入',
    description: '粘贴网页链接即可抓取内容，并提炼核心片段',
    actionLabel: '输入网址'
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

type OperationNotice = {
  type: 'success' | 'error'
  message: string
} | null

type MergedTask = KnowledgeTask & {
  lastEventId?: string
  source: 'history' | 'realtime'
}

export default function KnowledgePage({ params }: { params: { workspaceId: string } }) {
  const { theme } = useTheme()
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
  } = useKnowledgeBases()
  const createKnowledgeBaseMutation = useCreateKnowledgeBase()
  const publishKnowledgeBaseMutation = usePublishKnowledgeBase()
  const addKnowledgeSeedMutation = useAddKnowledgeSeed()
  const importKnowledgeUrlMutation = useImportKnowledgeUrl()
  const importKnowledgeFilesMutation = useImportKnowledgeFiles()

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
  } = useKnowledgeBaseStatus(activeBaseId)
  const { data: taskStatuses = [], isLoading: isTaskLoading, isError: isTaskError } = useKbTaskStatus(activeBaseId)
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
    <div className={cn('flex flex-1 flex-col gap-8 px-8 py-6', theme.colors.background.primary, theme.colors.text.primary)}>
      <section className={cn('rounded-3xl border px-8 py-6 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.brand.solid.replace('bg-', 'text-'))}>Workspace {params.workspaceId}</p>
            <h1 className={cn('mt-2 text-2xl font-semibold', theme.colors.text.primary)}>
              {activeBase?.name ?? (isKnowledgeBasesLoading ? '加载中...' : 'Knowledge Base')}
            </h1>
            <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>{activeBaseDescription}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button className={cn('rounded-lg border px-4 py-2 transition', theme.colors.border.default, theme.colors.text.secondary, theme.colors.interactive.hover)}>
              分享
            </button>
            <button
              onClick={handlePublishKnowledgeBase}
              disabled={!activeBaseId || publishKnowledgeBaseMutation.isPending}
              className={cn(
                'rounded-lg px-5 py-2 font-semibold text-white shadow bg-gradient-to-r',
                theme.colors.brand.from,
                theme.colors.brand.to,
                !activeBaseId || publishKnowledgeBaseMutation.isPending ? 'cursor-not-allowed opacity-60' : ''
              )}
            >
              {publishKnowledgeBaseMutation.isPending ? '发布中...' : '发布'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isKnowledgeBasesError && (
            <p className="w-full text-xs text-rose-500">知识库列表加载失败，请检查 Gateway 与 Task Service。</p>
          )}
          {knowledgeBases.map((kb) => (
            <button
              key={kb.id}
              onClick={() => setActiveBaseId(kb.id)}
              className={cn(
                'rounded-2xl border px-4 py-3 text-left text-sm transition shadow-sm',
                activeBaseId === kb.id
                  ? cn('text-cyan-500', theme.colors.brand.light, theme.colors.border.hover)
                  : cn(theme.colors.text.secondary, theme.colors.background.card, theme.colors.interactive.hover, 'border-transparent')
              )}
            >
              <p className="font-semibold">{kb.name}</p>
              <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>
                状态：{kb.status} · 更新于 {new Date(kb.updatedAt).toLocaleDateString()}
              </p>
            </button>
          ))}
          {!isKnowledgeBasesLoading && knowledgeBases.length === 0 && (
            <p className={cn('text-xs', theme.colors.text.muted)}>暂无 Knowledge Base，请先创建一个。</p>
          )}
          <button
            onClick={handleCreateKnowledgeBase}
            disabled={createKnowledgeBaseMutation.isPending}
            data-testid="kb-create-button"
            className={cn(
              'rounded-2xl border border-dashed px-4 py-3 text-sm transition',
              theme.colors.border.default,
              theme.colors.brand.solid.replace('bg-', 'text-'),
              theme.colors.interactive.hover,
              createKnowledgeBaseMutation.isPending ? 'opacity-60 cursor-not-allowed' : ''
            )}
          >
            {createKnowledgeBaseMutation.isPending ? '创建中...' : '+ 新建 Knowledge Base'}
          </button>
        </div>
        {operationNotice && (
          <p
            className={cn(
              'mt-4 rounded-xl border px-3 py-2 text-xs',
              operationNotice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                : 'border-rose-200 bg-rose-50 text-rose-600'
            )}
          >
            {operationNotice.message}
          </p>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className={cn('rounded-3xl border p-6 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            data-testid="kb-seed-textarea"
            placeholder="在此输入或粘贴文本，或上传 Seeds 到 Knowledge Base..."
            className={cn('h-48 w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
          />
          <div className={cn('mt-4 flex flex-wrap items-center gap-3 text-xs', theme.colors.text.muted)}>
            <button
              onClick={handleAddSeed}
              disabled={!activeBaseId || addKnowledgeSeedMutation.isPending}
              data-testid="kb-add-seed-button"
              className={cn(
                'rounded-lg border px-3 py-2 transition',
                theme.colors.border.default,
                theme.colors.text.secondary,
                theme.colors.interactive.hover,
                !activeBaseId || addKnowledgeSeedMutation.isPending ? 'cursor-not-allowed opacity-60' : ''
              )}
            >
              {addKnowledgeSeedMutation.isPending ? '提交中...' : '添加'}
            </button>
            <span>支持粘贴、上传多种格式，AI 会自动分类与提炼。</span>
          </div>
        </div>

        <div className="grid gap-4">
          {importOptions.map((option) => (
            <div
              key={option.id}
              className={cn(
                'rounded-3xl border p-5 shadow-sm transition',
                theme.colors.border.default,
                theme.colors.background.card,
                activeImport === option.id ? 'ring-2 ring-cyan-500' : 'hover:border-cyan-400/50'
              )}
            >
              <div className={cn('flex items-center justify-between text-sm font-semibold', theme.colors.text.primary)}>
                <span>{option.title}</span>
                <button
                  onClick={() => setActiveImport(option.id as 'file' | 'link')}
                  className={cn('rounded-full border px-3 py-1 text-xs transition', theme.colors.border.default, theme.colors.brand.solid.replace('bg-', 'text-'), theme.colors.interactive.hover)}
                >
                  {option.actionLabel}
                </button>
              </div>
              <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>{option.description}</p>
              {option.id === 'link' ? (
                <>
                  <input
                    value={linkValue}
                    onChange={(event) => setLinkValue(event.target.value)}
                    data-testid="kb-url-input"
                    placeholder="输入网址"
                    className={cn('mt-3 w-full rounded-xl border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.secondary, `focus:${theme.colors.border.hover}`)}
                  />
                  <button
                    onClick={handleImportUrl}
                    disabled={!activeBaseId || importKnowledgeUrlMutation.isPending}
                    data-testid="kb-import-url-button"
                    className={cn(
                      'mt-3 w-full rounded-xl border px-3 py-2 text-xs transition',
                      theme.colors.border.default,
                      theme.colors.text.secondary,
                      theme.colors.interactive.hover,
                      !activeBaseId || importKnowledgeUrlMutation.isPending ? 'cursor-not-allowed opacity-60' : ''
                    )}
                  >
                    {importKnowledgeUrlMutation.isPending ? '导入中...' : '导入 URL'}
                  </button>
                </>
              ) : (
                <>
                  <div className={cn('mt-3 rounded-xl border border-dashed px-3 py-3 text-xs', theme.colors.border.default, theme.colors.text.muted)}>
                    <input
                      type="file"
                      multiple
                      data-testid="kb-file-input"
                      onChange={(event) => {
                        const files = event.target.files ? Array.from(event.target.files) : []
                        setSelectedFiles(files)
                        setUploadProgress(null)
                      }}
                      className="w-full text-xs"
                    />
                  </div>
                  {selectedFiles.length > 0 && (
                    <p className={cn('mt-2 text-[11px]', theme.colors.text.muted)}>
                      已选择 {selectedFiles.length} 个文件：{selectedFiles.slice(0, 2).map((file) => file.name).join('，')}
                      {selectedFiles.length > 2 ? ' ...' : ''}
                    </p>
                  )}
                  {uploadProgress !== null && (
                    <p className={cn('mt-1 text-[11px]', theme.colors.text.muted)}>上传进度：{uploadProgress}%</p>
                  )}
                  <button
                    onClick={handleImportFiles}
                    disabled={!activeBaseId || importKnowledgeFilesMutation.isPending}
                    data-testid="kb-import-file-button"
                    className={cn(
                      'mt-3 w-full rounded-xl border px-3 py-2 text-xs transition',
                      theme.colors.border.default,
                      theme.colors.text.secondary,
                      theme.colors.interactive.hover,
                      !activeBaseId || importKnowledgeFilesMutation.isPending ? 'cursor-not-allowed opacity-60' : ''
                    )}
                  >
                    {importKnowledgeFilesMutation.isPending ? '上传中...' : '上传并导入文件'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={cn('rounded-3xl border px-6 py-4 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
        <div className={cn('flex flex-wrap items-center justify-between gap-3 text-xs', theme.colors.text.muted)}>
          <div className="flex items-center gap-3">
            <span>当前模式：</span>
            <button
              onClick={() => setAiMode(aiMode === 'ai' ? 'manual' : 'ai')}
              className={cn(
                'rounded-full border px-3 py-1 text-[11px] transition',
                aiMode === 'ai'
                  ? cn('text-cyan-500', theme.colors.brand.light, theme.colors.border.hover)
                  : cn(theme.colors.border.default, theme.colors.background.card, theme.colors.text.secondary, theme.colors.interactive.hover)
              )}
            >
              {aiMode === 'ai' ? 'AI 智能拆分' : '手动模式'}
            </button>
          </div>
          <p>AI 将分析内容并优化逻辑，关闭后改为手动上传与整理。</p>
        </div>
      </section>

      <section data-testid="knowledge-task-center" className="rounded-3xl bg-gradient-to-br from-[#0F1729] via-[#10172B] to-[#111C30] p-8 text-white shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">任务中心（实时 + 历史）</h2>
            <p className="mt-1 text-sm text-white/60">
              当前 KB：{activeBaseId || '-'}。任务来源于 `kbTaskStatus` 实时事件与 `knowledgeBaseStatus` 历史聚合，按 Task ID 合并去重。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="rounded-full border border-white/20 px-3 py-1">总计 {taskStats.total}</span>
            <span className="rounded-full border border-slate-300/40 px-3 py-1 text-slate-200">待处理 {taskStats.pending}</span>
            <span className="rounded-full border border-amber-300/40 px-3 py-1 text-amber-200">处理中 {taskStats.processing}</span>
            <span className="rounded-full border border-emerald-300/40 px-3 py-1 text-emerald-200">完成 {taskStats.succeeded}</span>
            <span className="rounded-full border border-rose-300/40 px-3 py-1 text-rose-200">失败 {taskStats.failed}</span>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <span>筛选：</span>
              <input
                value={fileFilter}
                onChange={(event) => setFileFilter(event.target.value)}
                data-testid="kb-task-filter-input"
                placeholder="任务名 / 类型 / 状态 / ID"
                className="w-44 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              />
            </label>
            <button
              onClick={() => setLatestOnly((current) => !current)}
              className={cn(
                'rounded-full border px-4 py-2 text-xs transition',
                latestOnly ? 'border-cyan-300 bg-cyan-400/10 text-cyan-100' : 'border-white/20 text-white hover:bg-white/10'
              )}
            >
              {latestOnly ? '仅最新 6 条' : '显示全部'}
            </button>
            <button
              onClick={() => setFileFilter('')}
              className="rounded-full border border-white/20 px-4 py-2 text-xs text-white transition hover:bg-white/10"
            >
              清空筛选
            </button>
          </div>
        </div>

        {isTaskCenterLoading && (
          <p className="mt-6 text-sm text-white/60">正在同步任务中心数据...</p>
        )}
        {isTaskCenterError && (
          <p className="mt-6 text-sm text-rose-200">任务中心加载失败，请检查 Gateway 与 Task Service 链路。</p>
        )}
        {isTaskCenterPartialError && (
          <p className="mt-6 text-sm text-amber-100">部分任务源加载失败，当前展示的是可用数据。</p>
        )}
        {!isTaskCenterLoading && !isTaskCenterError && importedTasks.length === 0 && (
          <p className="mt-6 text-sm text-white/60">暂无导入任务。可先上传文件、粘贴文本或导入 URL。</p>
        )}

        {!isTaskCenterLoading && !isTaskCenterError && importedTasks.length > 0 && (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {importedTasks.map((task) => (
              <article
                key={task.id}
                data-testid="kb-task-card"
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: taskTypeColorMap[task.type] }}
                    />
                    {taskTypeMap[task.type]}
                  </span>
                  <span>{new Date(task.updatedAt).toLocaleString()}</span>
                </div>
                <h3 className="mt-4 line-clamp-2 text-base font-semibold text-white">{getTaskCardTitle(task)}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/70">{getTaskCardSummary(task)}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
                  <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1">#{task.type}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1">#{task.status}</span>
                  <span className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1">
                    {task.source === 'realtime' ? '#实时' : '#历史'}
                  </span>
                  {task.error && (
                    <span className="rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-rose-100">
                      #error
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between text-xs text-white/50">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/40" />
                    {statusBadgeMap[task.status]}
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 font-mono">ID {task.id.slice(-8)}</span>
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
