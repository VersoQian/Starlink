import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-160px)] w-full max-w-5xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="space-y-4">
        <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs tracking-[0.3em] text-slate-300/70">
          QUEST · CHAPTER · LESSON
        </span>
        <h1 className="text-4xl font-semibold text-white md:text-5xl">
          Branching Canvas 新架构
        </h1>
        <p className="text-base text-slate-300/80 md:text-lg">
          基于 Quest-驱动课程模型、Supabase 数据源与 Dify AI 工作流的多维学习工作台。当前为重构预览，功能逐步迁移中。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-200/80">
        <Link
          href="/dashboard"
          className="rounded-full bg-sky-500 px-6 py-2 font-medium text-white shadow-md shadow-sky-500/30 transition hover:bg-sky-400"
        >
          进入旧版工作台
        </Link>
        <Link
          href="/lesson/demo"
          className="rounded-full border border-white/10 px-6 py-2 hover:bg-white/10"
        >
          预览 Lesson 编辑器
        </Link>
      </div>
    </main>
  )
}
