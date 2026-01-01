'use client'

import { useMemo, useState } from 'react'
import { useTheme, cn } from '@/lib/theme'

const knowledgeBases = [
  { id: 'kb-001', name: '新建 Knowledge Base', description: '您的 AI 交互个人 Knowledge Base' },
  { id: 'kb-002', name: '市场情报库', description: '汇总竞争对手与行业动态' }
]

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

const importedEntries = [
  {
    id: 'entry-001',
    title: '项目亮点',
    summary: '北京大意嘉溥项目亮点与资源梳理，包含核心卖点、关键客户反馈与下一步建议。',
    format: 'PPT',
    seeds: 1,
    tags: ['#project_highlights'],
    lastUpdated: '1 小时前',
    color: '#F97316'
  },
  {
    id: 'entry-002',
    title: '市场竞品调研',
    summary: '整理近三月竞品推新节奏、渠道促销策略与区域表现，附重点风险提示。',
    format: 'PDF',
    seeds: 3,
    tags: ['#market_intel', '#风险预警'],
    lastUpdated: '昨天',
    color: '#6366F1'
  },
  {
    id: 'entry-003',
    title: '访客访谈纪要',
    summary: '华北经销商访谈摘录，涵盖返点诉求、培训需求与合作形式建议。',
    format: 'DOCX',
    seeds: 2,
    tags: ['#sales_feedback'],
    lastUpdated: '2 天前',
    color: '#10B981'
  }
]

export default function KnowledgePage({ params }: { params: { workspaceId: string } }) {
  const { theme } = useTheme()
  const [activeBaseId, setActiveBaseId] = useState(knowledgeBases[0]?.id ?? '')
  const [inputText, setInputText] = useState('')
  const [activeImport, setActiveImport] = useState<'file' | 'link'>('file')
  const [linkValue, setLinkValue] = useState('')
  const [aiMode, setAiMode] = useState<'ai' | 'manual'>('ai')

  const activeBase = useMemo(
    () => knowledgeBases.find((item) => item.id === activeBaseId) ?? knowledgeBases[0],
    [activeBaseId]
  )

  return (
    <div className={cn('flex flex-1 flex-col gap-8 px-8 py-6', theme.colors.background.primary, theme.colors.text.primary)}>
      <section className={cn('rounded-3xl border px-8 py-6 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.brand.solid.replace('bg-', 'text-'))}>Workspace {params.workspaceId}</p>
            <h1 className={cn('mt-2 text-2xl font-semibold', theme.colors.text.primary)}>{activeBase?.name}</h1>
            <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>{activeBase?.description ?? '欢迎来到您的知识花园'}</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button className={cn('rounded-lg border px-4 py-2 transition', theme.colors.border.default, theme.colors.text.secondary, theme.colors.interactive.hover)}>
              分享
            </button>
            <button className={cn('rounded-lg px-5 py-2 font-semibold text-white shadow bg-gradient-to-r', theme.colors.brand.from, theme.colors.brand.to)}>
              发布
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
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
              <p className={cn('mt-1 text-xs', theme.colors.text.muted)}>{kb.description}</p>
            </button>
          ))}
          <button className={cn('rounded-2xl border border-dashed px-4 py-3 text-sm transition', theme.colors.border.default, theme.colors.brand.solid.replace('bg-', 'text-'), theme.colors.interactive.hover)}>
            + 新建 Knowledge Base
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className={cn('rounded-3xl border p-6 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="在此输入或粘贴文本，或上传 Seeds 到 Knowledge Base..."
            className={cn('h-48 w-full rounded-2xl border px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.primary, `focus:${theme.colors.border.hover}`)}
          />
          <div className={cn('mt-4 flex flex-wrap items-center gap-3 text-xs', theme.colors.text.muted)}>
            <button className={cn('rounded-lg border px-3 py-2 transition', theme.colors.border.default, theme.colors.text.secondary, theme.colors.interactive.hover)}>
              添加
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
                <input
                  value={linkValue}
                  onChange={(event) => setLinkValue(event.target.value)}
                  placeholder="输入网址"
                  className={cn('mt-3 w-full rounded-xl border px-3 py-2 text-xs placeholder:text-slate-400 focus:outline-none', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.secondary, `focus:${theme.colors.border.hover}`)}
                />
              ) : (
                <div className={cn('mt-3 rounded-xl border border-dashed px-3 py-3 text-xs', theme.colors.border.default, theme.colors.text.muted)}>
                  点击选择文件，支持批量上传
                </div>
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

      <section className="rounded-3xl bg-gradient-to-br from-[#0F1729] via-[#10172B] to-[#111C30] p-8 text-white shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">已导入的 Seeds</h2>
            <p className="mt-1 text-sm text-white/60">
              AI 已将文件拆解为结构化的知识卡片，可继续补充标签、生成洞察或同步到画布。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
              <span>筛选标签：</span>
              <input
                placeholder="# 标签 / 文件类型"
                className="w-36 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              />
            </label>
            <button className="rounded-full border border-white/20 px-4 py-2 text-xs text-white transition hover:bg-white/10">
              只看最新
            </button>
            <button className="rounded-full border border-white/20 px-4 py-2 text-xs text-white transition hover:bg-white/10">
              管理分组
            </button>
          </div>
        </header>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {importedEntries.map((entry) => (
            <article
              key={entry.id}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.05] p-5 transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-white/60">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.format}
                </span>
                <span>{entry.lastUpdated}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{entry.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-white/70">{entry.summary}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
                {entry.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between text-xs text-white/50">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/40" />
                  {entry.seeds} 种子
                </span>
                <div className="flex items-center gap-2">
                  <button className="rounded-full border border-white/20 px-3 py-1 transition hover:bg-white/10">
                    查看拆解
                  </button>
                  <button className="rounded-full border border-white/20 px-3 py-1 transition hover:bg-white/10">
                    AI 总结
                  </button>
                  <button className="rounded-full border border-white/20 px-3 py-1 transition hover:bg-white/10">
                    同步画布
                  </button>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition group-hover:opacity-100" />
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-white/50">
          <span>下一步：</span>
          <button className="rounded-full border border-dashed border-white/30 px-4 py-2 transition hover:border-white/50">
            + 上传更多文件
          </button>
          <button className="rounded-full border border-white/20 px-4 py-2 transition hover:bg-white/10">
            批量生成摘要
          </button>
          <button className="rounded-full border border-white/20 px-4 py-2 transition hover:bg-white/10">
            连接 Supabase
          </button>
        </div>
      </section>
    </div>
  )
}
