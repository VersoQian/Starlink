import { FileText, PanelsTopLeft, LayoutGrid, Sparkles, Zap } from 'lucide-react'
import { WORKFLOW_STAGE_LABELS, WORKFLOW_STAGE_ORDER, type WorkflowStage } from '../store/workflow-stage'

type CanvasHeaderProps = {
  isAnimating: boolean
  onOpenTutorial: () => void
  viewMode?: 'freeform' | 'bmc'
  onViewModeChange?: (mode: 'freeform' | 'bmc') => void
  workflowStage: WorkflowStage
}

export function CanvasHeader({
  isAnimating,
  onOpenTutorial,
  viewMode = 'freeform',
  onViewModeChange,
  workflowStage
}: CanvasHeaderProps) {
  return (
    <header
      className={`flex items-center justify-between px-8 py-4 glass-effect border-b border-white/10 z-20 ${
        isAnimating ? 'opacity-0' : 'animate-fade-in-up'
      }`}
      style={{ animationDelay: '0.1s' }}
    >
      <div className="flex items-center gap-5">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-white title-font tracking-tight">智绘·无限画布</h1>
          <p className="text-xs text-slate-400 mono-font mt-0.5">MACRA Business Intelligence</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <div className="hidden items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/40 px-3 py-2 shadow-xl shadow-slate-950/30 xl:flex">
          {WORKFLOW_STAGE_ORDER.map((stage) => (
            <span
              key={stage}
              className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                workflowStage === stage
                  ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-500'
              }`}
            >
              {WORKFLOW_STAGE_LABELS[stage]}
            </span>
          ))}
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-center">
          <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-200">Workflow</div>
          <div className="mt-1 text-xs font-bold text-white">{WORKFLOW_STAGE_LABELS[workflowStage]}</div>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/40 p-1 shadow-xl shadow-slate-950/30">
          <button
            onClick={() => onViewModeChange?.('freeform')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
              viewMode === 'freeform'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <PanelsTopLeft className="w-4 h-4" />
            自由画布
          </button>
          <button
            onClick={() => onViewModeChange?.('bmc')}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
              viewMode === 'bmc'
                ? 'bg-gradient-to-r from-cyan-400 to-sky-500 text-white shadow-lg shadow-cyan-500/30'
                : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            BMC 九宫格
          </button>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-effect border border-white/20 hover:border-amber-400/50 hover:bg-white/10 transition-all text-sm font-semibold text-slate-200 hover:text-white">
          <FileText className="w-4 h-4" />
          导出
        </button>
        <button
          onClick={onOpenTutorial}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white text-sm font-bold transition-all shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 hover:scale-105"
        >
          <Zap className="w-4 h-4" />
          快速入门
        </button>
      </div>
    </header>
  )
}
