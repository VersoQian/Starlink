import { ChevronRight, Sparkles, TrendingUp, Wand2, X } from 'lucide-react'

const TUTORIAL_STEPS = [
  {
    title: '欢迎来到智绘画布',
    description: '通过 AI 驱动的可视化画布，让商业想法变成现实。',
    icon: <Sparkles className="w-10 h-10 text-amber-400" />,
  },
  {
    title: '描述你的愿景',
    description: '用自然语言描述你的商业想法，AI 将为你构建初始结构。',
    icon: <Wand2 className="w-10 h-10 text-emerald-400" />,
  },
  {
    title: '实时协作优化',
    description: '拖拽节点、建立连接，AI 助手会持续提供专业建议。',
    icon: <TrendingUp className="w-10 h-10 text-blue-400" />,
  },
]

type CanvasTutorialDialogProps = {
  open: boolean
  tutorialStep: number
  onClose: () => void
  onNext: () => void
}

export function CanvasTutorialDialog({
  open,
  tutorialStep,
  onClose,
  onNext,
}: CanvasTutorialDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-fade-in-up">
      <div className="glass-effect border-2 border-white/20 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden glow-border">
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 px-8 py-6 flex items-center justify-between animate-gradient">
          <h3 className="text-white font-black text-xl title-font">快速入门</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/20 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10 text-center">
          <div className="mb-6 flex justify-center transform hover:scale-110 transition-transform">
            {TUTORIAL_STEPS[tutorialStep].icon}
          </div>
          <h4 className="text-2xl font-black text-white mb-3 title-font">
            {TUTORIAL_STEPS[tutorialStep].title}
          </h4>
          <p className="text-slate-300 mb-8 leading-relaxed">
            {TUTORIAL_STEPS[tutorialStep].description}
          </p>

          <div className="flex items-center justify-center gap-2.5 mb-8">
            {TUTORIAL_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all duration-500 ${
                  index === tutorialStep
                    ? 'w-10 bg-gradient-to-r from-amber-400 to-emerald-400'
                    : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3.5 rounded-xl glass-effect border border-white/20 hover:bg-white/10 transition-all text-slate-200 font-semibold"
            >
              跳过
            </button>
            <button
              onClick={onNext}
              className="flex-1 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-500 hover:to-emerald-500 text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
            >
              {tutorialStep < TUTORIAL_STEPS.length - 1 ? '下一步' : '开始使用'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
