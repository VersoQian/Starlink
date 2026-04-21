'use client'

import { Boxes } from 'lucide-react'
import { COMFY_NODE_PALETTE } from '../canvas-config'
import { useComfyShellContext } from '../workspace-shell-context'

export function NodePalettePanel() {
  const { onAddNode } = useComfyShellContext()

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-xl shadow-black/10 backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
          <Boxes className="h-4 w-4 text-slate-200" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">Node Library</p>
          <h3 className="mt-1 text-sm font-black text-white title-font">可拖拽业务组件</h3>
        </div>
      </div>

      <div className="space-y-3">
        {COMFY_NODE_PALETTE.map((node) => (
          <button
            key={node.type}
            type="button"
            onClick={() => onAddNode(node.type)}
            className="group relative w-full overflow-hidden rounded-2xl text-left"
          >
            <div className={`absolute inset-0 bg-gradient-to-r opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100 ${node.gradient}`} />
            <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-3 transition group-hover:-translate-y-0.5 group-hover:border-white/25 group-hover:bg-white/10 group-hover:shadow-xl">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-lg transition group-hover:rotate-6 ${node.gradient}`}>
                {node.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white title-font">{node.label}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">{node.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
