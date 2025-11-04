'use client'

import { useCanvasStore } from '@/store/canvas-store'

type CanvasToolbarProps = {
  onAddNode: () => void | Promise<void>
  onToggleDocuments: () => void
  onTogglePalette: () => void
  onRunAnalysis: () => void
}

export function CanvasToolbar({ onAddNode, onToggleDocuments, onTogglePalette, onRunAnalysis }: CanvasToolbarProps) {
  const zoom = useCanvasStore((state) => state.zoom)
  const setZoom = useCanvasStore((state) => state.setZoom)
  const togglePanel = useCanvasStore((state) => state.togglePanel)

  return (
    <div className="flex items-center justify-between border-b border-[#E3E6FF] bg-white/70 px-8 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          className="rounded-full border border-[#E3E6FF] px-4 py-1 text-xs text-slate-600 hover:bg-white"
          onClick={onAddNode}
          type="button"
        >
          + 添加节点
        </button>
        <button className="rounded-full border border-[#E3E6FF] px-4 py-1 text-xs text-slate-600 hover:bg-white">
          AI 大纲
        </button>
        <button className="rounded-full border border-[#E3E6FF] px-4 py-1 text-xs text-slate-600 hover:bg-white">
          自动排版
        </button>
        <button
          className="rounded-full border border-[#E3E6FF] px-4 py-1 text-xs text-slate-600 hover:bg-white"
          onClick={onTogglePalette}
          type="button"
        >
          节点库
        </button>
        <button
          className="rounded-full border border-[#E3E6FF] px-4 py-1 text-xs text-purple-500 hover:bg-white"
          onClick={onRunAnalysis}
          type="button"
        >
          AI 拆分
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <button
          className="rounded-full border border-[#E3E6FF] px-3 py-1 hover:bg-white"
          onClick={onToggleDocuments}
          type="button"
        >
          文档抽屉
        </button>
        <button
          onClick={() => {
            togglePanel('assistant')
          }}
          className="rounded-full border border-[#E3E6FF] px-3 py-1 hover:bg-white"
          type="button"
        >
          助手
        </button>
        <div className="flex items-center gap-2 rounded-full border border-[#E3E6FF] px-3 py-1">
          <button
            onClick={() => setZoom(Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10))}
            className="text-slate-500 hover:text-slate-700"
            type="button"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2, Math.round((zoom + 0.1) * 10) / 10))}
            className="text-slate-500 hover:text-slate-700"
            type="button"
          >
            ＋
          </button>
        </div>
      </div>
    </div>
  )
}
