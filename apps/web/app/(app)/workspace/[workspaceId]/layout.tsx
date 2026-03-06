'use client'

import { ReactNode, useMemo } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { usePathname } from 'next/navigation'
import { useTheme, cn, bgToText } from '@/lib/theme'
import { ThemeToggle } from '@/components/theme-toggle'

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
  const { theme } = useTheme()

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
          description: '语言转换、文化洞察与���告撰写工具集成在此。',
          href: `${basePath}/cultural-tools`
        },
        {
          key: 'translate',
          label: '快速翻译',
          description: '工作区内的轻量文本翻译。',
          href: `${basePath}/translate`
        },
        {
          key: 'deep-research',
          label: '深度研究',
          description: 'AI驱动的智能研究分析，多源信息整合与专业洞察。',
          href: `${basePath}/deep-research`
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
        },
        {
          key: 'comfy',
          label: '智绘·无限商业画布',
          description: 'MACRA架构驱动的智能画布，AI多Agent协作生成商业模型。',
          href: `${basePath}/comfy`
        },
        {
          key: 'agents',
          label: 'Agent 面板',
          description: '按角色查看每个 Agent 的规划、执行与思考摘要。',
          href: `${basePath}/agents`
        },
        {
          key: 'seminar',
          label: '研讨会',
          description: '多智能体模拟公司研讨，聚合冲突质询与决策收敛。',
          href: `${basePath}/seminar`
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
    <div className={cn('grid min-h-screen grid-cols-[280px_1fr]', theme.colors.background.primary, theme.colors.text.primary)}>
      <aside className={cn('flex h-full flex-col border-r p-6 backdrop-blur', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn('text-xs font-medium uppercase tracking-widest', theme.colors.text.muted)}>Workspace</p>
            <h2 className={cn('text-lg font-semibold', theme.colors.text.primary)}>{params.workspaceId}</h2>
          </div>
          <button className={cn('rounded-full border p-2 hover:bg-opacity-80', theme.colors.border.default, theme.colors.text.muted, theme.colors.interactive.hover)} aria-label="更多">
            ⋮
          </button>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href && item.href !== basePath && pathname.startsWith(item.href))
            return item.href ? (
              <Link
                key={item.key}
                href={item.href as Route}
                className={cn(
                  'block rounded-xl border px-4 py-3 text-sm font-medium transition',
                  isActive
                    ? cn('border-cyan-400/60 text-cyan-500', theme.colors.brand.light)
                    : cn(theme.colors.text.tertiary, theme.colors.interactive.hover, 'border-transparent')
                )}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                className={cn('w-full cursor-not-allowed rounded-xl border border-dashed px-4 py-3 text-left text-sm font-medium', theme.colors.border.default, theme.colors.text.muted)}
              >
                {item.label}
                <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[10px]', theme.colors.brand.light, bgToText(theme.colors.brand.solid))}>即将上线</span>
              </button>
            )
          })}
        </nav>

        <div className="mt-auto space-y-4">
          <div>
            <p className={cn('text-xs uppercase tracking-widest', theme.colors.text.muted)}>成员</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {mockMembers.map((member) => (
                <span
                  key={member.id}
                  className={cn('flex items-center gap-2 rounded-full border px-3 py-1 text-xs', theme.colors.border.default, theme.colors.text.secondary)}
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: member.color }} />
                  {member.name}
                </span>
              ))}
            </div>
          </div>
          <Link href="/dashboard" className={cn('inline-flex items-center gap-2 text-xs transition', theme.colors.text.muted, 'hover:text-slate-400')}>
            ← 返回工作台
          </Link>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className={cn('flex items-center justify-between border-b px-8 py-5 backdrop-blur', theme.colors.border.default, theme.colors.background.secondary)}>
          <div>
            <h1 className={cn('text-2xl font-semibold', theme.colors.text.primary)}>{activeNav.label}</h1>
            <p className={cn('mt-1 text-sm', theme.colors.text.muted)}>{activeNav.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button className={cn('rounded-lg border px-4 py-2 text-sm transition-colors', theme.colors.border.default, theme.colors.text.secondary, theme.colors.interactive.hover)}>
              分享
            </button>
            <button className={cn('rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all bg-gradient-to-r', theme.colors.brand.from, theme.colors.brand.to)}>
              发布
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  )
}
