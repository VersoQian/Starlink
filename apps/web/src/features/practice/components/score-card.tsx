'use client'

import type { ScoreBreakdown } from '../hooks'
import { useTheme, cn } from '@/lib/theme'

type ScoreCardProps = {
  score: ScoreBreakdown
}

export function ScoreCard({ score }: ScoreCardProps) {
  const { theme } = useTheme()

  const gradeColors = {
    S: 'from-yellow-400 to-orange-500',
    A: 'from-green-400 to-emerald-500',
    B: 'from-blue-400 to-cyan-500',
    C: 'from-purple-400 to-pink-500',
    D: 'from-slate-400 to-slate-500'
  }

  const gradeColor = gradeColors[score.grade]

  return (
    <div className={cn('p-4 rounded-2xl border shadow-sm', theme.colors.background.card, theme.colors.border.default)}>
      {/* 总分和等级 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={cn('text-sm font-medium mb-1', theme.colors.text.muted)}>当前得分</h3>
          <div className={cn('text-3xl font-bold', theme.colors.text.primary)}>{score.total}</div>
        </div>
        <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${gradeColor} flex items-center justify-center shadow-lg`}>
          <span className="text-2xl font-bold text-white">{score.grade}</span>
        </div>
      </div>

      {/* 反馈 */}
      <p className={cn('text-xs mb-4 leading-relaxed', theme.colors.text.secondary)}>{score.feedback}</p>

      {/* 详细评分 */}
      <div className="space-y-2">
        <ScoreBar label="参与度" value={score.engagement} max={25} color="sky" />
        <ScoreBar label="文化意识" value={score.cultural} max={30} color="purple" />
        <ScoreBar label="质量" value={score.quality} max={25} color="green" />
        <ScoreBar label="响应性" value={score.responsiveness} max={20} color="amber" />
      </div>
    </div>
  )
}

function ScoreBar({
  label,
  value,
  max,
  color
}: {
  label: string
  value: number
  max: number
  color: 'sky' | 'purple' | 'green' | 'amber'
}) {
  const { theme } = useTheme()
  const safeMax = max > 0 ? max : 1
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(0, value), safeMax) : 0
  const percentage = Math.min(100, Math.max(0, (safeValue / safeMax) * 100))

  const colorClasses = {
    sky: 'from-sky-400 to-cyan-500',
    purple: 'from-indigo-400 to-purple-500',
    green: 'from-emerald-400 to-green-500',
    amber: 'from-amber-400 to-orange-500'
  }

  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={theme.colors.text.muted}>{label}</span>
        <span className={cn('font-medium', theme.colors.text.secondary)}>{safeValue}/{safeMax}</span>
      </div>
      <div className={cn('h-1.5 rounded-full overflow-hidden', theme.colors.background.card, theme.colors.border.default)}>
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} transition-all duration-500`}
          style={{ width: `${percentage}%`, minWidth: percentage > 0 ? '6%' : '0%' }}
        />
      </div>
    </div>
  )
}
