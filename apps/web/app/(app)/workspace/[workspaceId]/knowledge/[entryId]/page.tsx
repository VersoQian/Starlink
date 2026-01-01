import { notFound } from 'next/navigation'
import Link from 'next/link'
import { KnowledgeEntryDetail } from '@/features/knowledge/components/entry-detail'
import { knowledgeEntries, insightHistory } from '@/features/knowledge/components/mock-data'
import type { InsightLog } from '@/types/knowledge'

type KnowledgeDetailPageProps = {
  params: {
    workspaceId: string
    entryId: string
  }
}

export default function KnowledgeDetailPage({ params }: KnowledgeDetailPageProps) {
  const entry = knowledgeEntries.find((item) => item.id === params.entryId)

  if (!entry) {
    notFound()
  }

  const relatedInsights: InsightLog[] = insightHistory.filter((log) => log.entryId === entry.id)

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col bg-[#F4F5FF]/60">
      <header className="flex items-center justify-between border-b border-[#E3E6FF] bg-white/90 px-8 py-5">
        <div>
          <nav className="text-xs text-slate-400">
            <Link href={`/workspace/${params.workspaceId}/knowledge`} className="hover:text-[#4338CA]">
              知识库
            </Link>
            <span className="mx-1">/</span>
            <span>条目详情</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{entry.title}</h1>
          <p className="mt-1 text-sm text-slate-500">查看完整内容、AI 洞察与流程状态。</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/workspace/${params.workspaceId}/knowledge`}
            className="rounded-lg border border-[#E3E6FF] px-4 py-2 text-slate-500 hover:bg-white"
          >
            返回列表
          </Link>
          <button className="rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] px-5 py-2 font-semibold text-white shadow">
            发布 / 分享
          </button>
        </div>
      </header>

      <main className="flex flex-1 gap-6 overflow-hidden p-6">
        <KnowledgeEntryDetail entry={entry} insightLogs={relatedInsights} />
        <aside className="w-80 rounded-3xl border border-[#E3E6FF] bg-white/90 p-5 shadow-inner">
          <h3 className="text-sm font-semibold text-slate-900">下一步建议</h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">
            <li>• 使用右上角按钮将内容同步到画布或社群。</li>
            <li>• 在列表页使用 AI 洞察助手生成行动项和总结。</li>
            <li>• 关注流程状态，确保条目及时发布。</li>
          </ul>
        </aside>
      </main>
    </div>
  )
}
