import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ContentGenerationToolbar } from './components/content-generation-toolbar'

type LessonPageProps = {
  params: { id: string }
}

export async function generateMetadata({ params }: LessonPageProps): Promise<Metadata> {
  return {
    title: `Lesson · ${params.id}`,
    description: '课时编辑器（开发中）'
  }
}

const MOCK_AVAILABLE_IDS = new Set(['demo'])

export default function LessonPage({ params }: LessonPageProps) {
  if (!MOCK_AVAILABLE_IDS.has(params.id)) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0f172a] text-slate-100">
      <header className="border-b border-white/10 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Lesson Editor · {params.id}</h1>
            <p className="mt-2 text-sm text-slate-300/70">
              Quest → Chapter → Lesson → Elements 数据结构重构进行中。
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-200/80">
            <span className="rounded-full border border-white/10 px-3 py-1">Learning</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Practice</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Challenge</span>
            <span className="rounded-full border border-white/10 px-3 py-1">Play</span>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr_360px] overflow-hidden">
        <aside className="border-r border-white/5 bg-white/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Quest Structure</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200/80">
            <li>Quest · Market Research Immersion</li>
            <li>Chapter · Define Hypothesis</li>
            <li className="text-white">Lesson · {params.id}</li>
          </ul>
        </aside>

        <section className="relative flex flex-col gap-6 overflow-y-auto bg-white/[0.03] p-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Lesson Elements</h2>
            <p className="mt-2 text-sm text-slate-300/80">
              Element 列表尚未接 Supabase。请参考 `docs/migration-plan.md` 更新状态。
            </p>
          </div>
        </section>

        <aside className="border-l border-white/5 bg-white/10 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Tools</p>
          <ContentGenerationToolbar lessonId={params.id} />
        </aside>
      </div>
    </div>
  )
}
