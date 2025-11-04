'use client'

import { ReactNode, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

type WorkspaceLayoutProps = {
  children: ReactNode
  params: { workspaceId: string }
}

const mockMembers = [
  { id: 'u1', name: 'Alice', color: '#38bdf8' },
  { id: 'u2', name: 'Bob', color: '#a855f7' },
  { id: 'u3', name: 'Carol', color: '#f97316' }
]

export default function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const pathname = usePathname()
  const basePath = `/workspace/${params.workspaceId}`

  const navItems = useMemo(
    () =>
      [
        {
          key: 'canvas',
          label: '多维画布',
          description: '整合资料、AI 与协作者，共创可溯源的知识地图。',
          href: basePath
        },
        {
          key: 'knowledge',
          label: '知识库',
          description: '上传与导入资料，自动分析并同步到画布引用。',
          href: `${basePath}/knowledge`
        },
        {
          key: 'cultural-tools',
          label: '跨文化助手',
          description: '语言转换、文化洞察与报告撰写工具集成在此。',
          href: `${basePath}/cultural-tools`
        },
        {
          key: 'templates',
          label: '模板库',
          description: '精选分支画布模板与行业范式，敬请期待。',
          href: null
        },
        {
          key: 'insights',
          label: '数据洞察',
          description: '上传文件、可视化表格并生成 AI 洞察。',
          href: `${basePath}/insights`
        }
      ] as const,
    [basePath]
  )

  const activeNav = useMemo(() => {
    return (
      navItems.find((item) => {
        if (!item.href) return false
        if (item.href === basePath) {
          return pathname === item.href
        }
        return pathname.startsWith(item.href)
      }) ?? navItems[0]
    )
  }, [basePath, navItems, pathname])

  return (
    <div className="grid min-h-screen grid-cols-[280px_1fr] bg-[#F4F5FF] text-slate-900">
      <aside className="flex h-full flex-col border-r border-[#E3E6FF] bg-white/80 p-6 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Workspace</p>
            <h2 className="text-lg font-semibold text-slate-900">{params.workspaceId}</h2>
          </div>
          <button className="rounded-full border border-[#E3E6FF] p-2 text-slate-400 hover:bg-white" aria-label="更多">
            ⋮
          </button>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) =>
            item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className={clsx(
                  'block rounded-xl border border-transparent px-4 py-3 text-sm font-medium transition',
                  pathname === item.href || (item.href !== basePath && pathname.startsWith(item.href))
                    ? 'border-[#C8CBFF] bg-[#EEF0FF] text-[#4338CA]'
                    : 'text-slate-600 hover:border-[#E3E6FF] hover:bg-[#F2F4FF]'
                )}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                className="w-full cursor-not-allowed rounded-xl border border-dashed border-[#E3E6FF] px-4 py-3 text-left text-sm font-medium text-slate-400/80"
              >
                {item.label}
                <span className="ml-2 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10px] text-[#6366F1]">即将上线</span>
              </button>
            )
          )}
        </nav>

        <div className="mt-auto space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">成员</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {mockMembers.map((member) => (
                <span
                  key={member.id}
                  className="flex items-center gap-2 rounded-full border border-[#E3E6FF] px-3 py-1 text-xs text-slate-600"
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />
                  {member.name}
                </span>
              ))}
            </div>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-700">
            ← 返回工作台
          </Link>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-[#E3E6FF] bg-white/90 px-8 py-5 backdrop-blur">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{activeNav.label}</h1>
            <p className="mt-1 text-sm text-slate-500">{activeNav.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-[#E3E6FF] px-4 py-2 text-sm text-slate-600 hover:bg-white">
              分享
            </button>
            <button className="rounded-lg bg-gradient-to-r from-[#9B87F5] to-[#7A6EEF] px-5 py-2 text-sm font-semibold text-white shadow-lg hover:from-[#8E7EEE] hover:to-[#6E60E6]">
              发布
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
