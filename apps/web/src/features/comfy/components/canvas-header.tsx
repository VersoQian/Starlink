import { FileText, Sparkles, Zap } from 'lucide-react'

type CanvasHeaderProps = {
  isAnimating: boolean
  onOpenTutorial: () => void
}

export function CanvasHeader({ isAnimating, onOpenTutorial }: CanvasHeaderProps) {
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
