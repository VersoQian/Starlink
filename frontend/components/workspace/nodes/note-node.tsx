'use client'

import type { NodeProps } from 'reactflow'
import type { CanvasNodeData } from '@/types/graph'
import { NodeCard } from './node-card'

type NoteNodeData = Extract<CanvasNodeData, { type: 'note' }>

const footerIcons = ['📎', '@', '🌐', '🤖']

const dimensionLabelMap: Record<string, string> = {
  value_proposition: '价值主张',
  customer_segment: '客户细分',
  channels: '渠道路径',
  revenue_streams: '收入模式',
  cost_structure: '成本结构',
  key_resources: '关键资源',
  key_partners: '合作伙伴',
  key_activities: '关键活动'
}

const categoryConfig = {
  task: { icon: '🗂️', badge: '核心任务', tone: 'purple' as const },
  step: { icon: '🪄', badge: '澄清', tone: 'blue' as const },
  dimension: { icon: '📊', badge: '分析板块', tone: 'purple' as const },
  action: { icon: '🚀', badge: '下一步', tone: 'green' as const },
  evidence: { icon: '📎', badge: '证据', tone: 'orange' as const }
}

const resolveCategory = (data: NoteNodeData) => {
  const category = data.category ?? (() => {
    if (data.variant === 'primary') return 'task'
    if (data.variant === 'timeline-step') return 'step'
    if (data.variant === 'timeline-dimension' || data.variant === 'insight') return 'dimension'
    if (data.variant === 'timeline-action') return 'action'
    return 'task'
  })()
  return categoryConfig[category as keyof typeof categoryConfig] ?? categoryConfig.task
}

const renderDefaultBody = (data: NoteNodeData) => (
  <div className="rounded-2xl bg-[#F5F6FF] px-4 py-4 text-sm leading-relaxed text-slate-700 shadow-inner">
    {data.content}
  </div>
)

export function NoteNode({ data }: NodeProps<NoteNodeData>) {
  const category = resolveCategory(data)

  if (data.variant === 'primary') {
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={data.title}
          subtitle={data.subtitle}
          width={440}
          badgeLabel={category.badge}
          badgeTone={category.tone}
          footer={
            <div className="flex items-center gap-3 text-lg">
              {footerIcons.map((icon) => (
                <span key={icon}>{icon}</span>
              ))}
            </div>
          }
          bodyClassName="space-y-3"
        >
          <div className="rounded-[24px] border border-[#E5E8FF] bg-[#F8F9FF] px-5 py-6 text-base leading-relaxed text-slate-700 shadow-inner">
            {data.content}
          </div>
          {data.footerText && <p className="text-xs text-[#8A8FB4]">{data.footerText}</p>}
        </NodeCard>
      </div>
    )
  }

  if (data.variant === 'list') {
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={data.title}
          subtitle={data.subtitle}
          width={460}
          badgeLabel={category.badge}
          badgeTone={category.tone}
          footer={<span className="text-xs text-[#7C80A9]">复杂的办公任务，从规划开始</span>}
        >
          <div className="space-y-4">
            {data.content && <p className="text-sm leading-relaxed text-slate-700">{data.content}</p>}
            {data.bullets && data.bullets.length > 0 && (
              <ol className="space-y-3 rounded-2xl bg-[#F5F6FF] px-5 py-4 text-sm text-slate-700 shadow-inner">
                {data.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="text-[#9B87F5]">{index + 1}.</span>
                    <span className="flex-1 leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </NodeCard>
      </div>
    )
  }

  if (data.variant === 'insight') {
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={data.title}
          subtitle={data.subtitle ?? '商业模式板块'}
          width={360}
          badgeLabel={category.badge}
          badgeTone={category.tone}
        >
          <div className="space-y-3">
            {data.content && (
              <div className="rounded-2xl bg-[#F7F8FF] px-4 py-3 text-sm text-slate-600">{data.content}</div>
            )}
            {data.bullets && data.bullets.length > 0 && (
              <ul className="space-y-2 text-sm text-slate-600">
                {data.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
                    <span className="text-[#9B87F5]">•</span>
                    <span className="flex-1 leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </NodeCard>
      </div>
    )
  }

  if (data.variant === 'timeline-step') {
    const stepTitle = data.title ?? '拆分步骤'
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={stepTitle}
          subtitle={data.subtitle}
          width={420}
          badgeLabel={category.badge}
          badgeTone={category.tone}
          footer={<span className="text-xs text-[#7C80A9]">连续的业务分析任务</span>}
        >
          {data.content && (
            <div className="rounded-2xl border border-[#E4E7FD] bg-[#F7F8FF] px-5 py-4 text-sm leading-relaxed text-slate-700">
              {data.content}
            </div>
          )}
          {data.bullets && data.bullets.length > 0 && (
            <ol className="mt-3 space-y-3 text-sm text-slate-600">
              {data.bullets.map((bullet, index) => (
                <li key={index} className="flex gap-3">
                  <span className="text-[#9B87F5]">{index + 1}.</span>
                  <span className="flex-1 leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ol>
          )}
        </NodeCard>
      </div>
    )
  }

  if (data.variant === 'timeline-dimension') {
    const subLabel = data.subCategory ? dimensionLabelMap[data.subCategory] ?? data.subCategory : '商业模式板块'
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={data.title}
          subtitle={subLabel}
          width={360}
          badgeLabel={category.badge}
          badgeTone={category.tone}
        >
          <div className="space-y-3">
            {data.content && <p className="text-sm text-slate-600">{data.content}</p>}
            {data.bullets && data.bullets.length > 0 && (
              <ul className="space-y-2 text-sm text-slate-600">
                {data.bullets.map((bullet, index) => (
                  <li key={index} className="flex gap-3 rounded-xl bg-white px-3 py-2 shadow-sm">
                    <span className="text-[#9B87F5]">•</span>
                    <span className="flex-1 leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </NodeCard>
      </div>
    )
  }

  if (data.variant === 'timeline-action') {
    return (
      <div data-testid="canvas-node-note">
        <NodeCard
          icon={category.icon}
          title={data.title ?? '下一步行动'}
          subtitle={data.subtitle ?? '执行路线'}
          width={360}
          badgeLabel={category.badge}
          badgeTone={category.tone}
        >
          <div className="space-y-2 text-sm text-slate-600">
            {data.bullets?.map((bullet, index) => (
              <div key={index} className="flex gap-3 rounded-xl border border-[#E4E7FD] bg-[#F7F8FF] px-3 py-2">
                <span className="text-[#7A6EEF]">●</span>
                <span className="flex-1 leading-relaxed">{bullet}</span>
              </div>
            ))}
            {data.content && <p className="rounded-xl bg-white px-3 py-2 text-xs text-slate-400">{data.content}</p>}
          </div>
        </NodeCard>
      </div>
    )
  }

  return (
    <div data-testid="canvas-node-note">
      <NodeCard
        icon={category.icon}
        title={data.title}
        subtitle={data.subtitle}
        bodyClassName="space-y-3"
        badgeLabel={category.badge}
        badgeTone={category.tone}
      >
        {renderDefaultBody(data)}
      </NodeCard>
    </div>
  )
}
