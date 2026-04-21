'use client'

import { BookOpenCheck } from 'lucide-react'
import { useComfyStore } from '../../store'

export function KnowledgeEvidencePanel() {
  const knowledgeEvidence = useComfyStore((state) => state.knowledgeEvidence)

  if (!knowledgeEvidence || knowledgeEvidence.length === 0) return null

  return (
    <section className="rounded-[28px] border border-cyan-300/15 bg-cyan-400/[0.07] p-4 shadow-xl shadow-cyan-950/20 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/15">
            <BookOpenCheck className="h-4 w-4 text-cyan-200" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-200">Evidence</p>
            <h3 className="mt-1 text-sm font-black text-white title-font">知识库证据</h3>
          </div>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-400/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
          {knowledgeEvidence.length}
        </span>
      </div>

      <div className="space-y-3">
        {knowledgeEvidence.slice(0, 4).map((evidence, index) => (
          <div
            key={`${evidence.docId ?? 'evidence'}-${index}`}
            className="rounded-2xl border border-white/10 bg-slate-950/25 p-3"
          >
            <p className="truncate text-[11px] font-semibold text-cyan-100">
              {evidence.docId ?? '未命名证据'}
            </p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">
              {evidence.snippet ?? '暂无摘要'}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
