'use client'

import Link from 'next/link'
import { useMemo } from 'react'

const mockProjects = [
  {
    id: 'proj-001',
    name: 'AI 竞品分析',
    updatedAt: '2024-01-12',
    contributors: 5,
    status: 'active'
  },
  {
    id: 'proj-002',
    name: '市场调研 - 教育行业',
    updatedAt: '2024-01-10',
    contributors: 3,
    status: 'active'
  },
  {
    id: 'proj-003',
    name: '新产品 PRD 草案',
    updatedAt: '2024-01-06',
    contributors: 4,
    status: 'draft'
  }
]

export default function DashboardPage() {
  const projects = useMemo(() => mockProjects, [])

  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-white/5 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">工作台</h1>
            <p className="mt-1 text-sm text-slate-300/80">浏览最近的画布、模板与文档。</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10">
              创建空间
            </button>
            <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-400">
              新建画布
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/workspace/${project.id}`}
              className="group rounded-3xl border border-white/5 bg-white/5 p-6 transition hover:border-sky-500/40 hover:bg-sky-500/5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{project.name}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    project.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-slate-500/20 text-slate-200'
                  }`}
                >
                  {project.status === 'active' ? '进行中' : '草稿'}
                </span>
              </div>
              <dl className="mt-4 space-y-2 text-sm text-slate-300/80">
                <div className="flex justify-between">
                  <dt>协作者</dt>
                  <dd>{project.contributors} 人</dd>
                </div>
                <div className="flex justify-between">
                  <dt>最近更新</dt>
                  <dd>{project.updatedAt}</dd>
                </div>
              </dl>
              <div className="mt-5 text-sm text-sky-300/80 opacity-0 transition group-hover:opacity-100">
                查看画布 →
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

