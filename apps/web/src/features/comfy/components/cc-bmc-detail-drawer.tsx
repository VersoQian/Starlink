'use client'

/**
 * CCBMCDetailDrawer — Editorial Boardroom v2 (2026-05-02).
 *
 * Right-side drawer that opens when the user clicks "详情" on a BMC
 * card node. v1 was glass + amber gradients + Sparkles icon + amber
 * shadow glow; v2 is brutalist 1.5px paper border on ink-ash1 with
 * mono kicker section heads and Fraunces titles.
 *
 * Functional surface unchanged: 4 tabs (overview / quiz / edit /
 * resources), Quiz API integration with mock fallback, store-bound
 * open/close. Only visual chrome was rewritten.
 */

import { useState } from 'react'
import { useComfyStore } from '../store'
import { X, FileText, MessageSquare, Edit3, Link2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { QuizPanel, type QuizQuestion } from './quiz-panel'

type TabType = 'overview' | 'quiz' | 'edit' | 'resources'

// 9 BMC domains → 3 owner bylines (mirrors business-langgraph
// agentNodeForBmcDomain). Used to tint the kicker glyph in the
// drawer header.
const BYLINE_BY_DOMAIN: Record<string, { glyph: string; tint: string }> = {
  '客户细分':       { glyph: 'M', tint: 'text-byline-market' },
  '客户关系':       { glyph: 'M', tint: 'text-byline-market' },
  '渠道通路':       { glyph: 'M', tint: 'text-byline-market' },
  '价值主张':       { glyph: 'P', tint: 'text-byline-product' },
  '核心资源':       { glyph: 'P', tint: 'text-byline-product' },
  '关键业务':       { glyph: 'P', tint: 'text-byline-product' },
  '重要合作':       { glyph: 'P', tint: 'text-byline-product' },
  '收入来源':       { glyph: 'F', tint: 'text-byline-finance' },
  '成本结构':       { glyph: 'F', tint: 'text-byline-finance' },
}

const TAB_BASE =
  'inline-flex items-center gap-1.5 px-3 py-1.5 font-instr text-[10px] uppercase tracking-kicker transition-colors'
const TAB_ACTIVE = 'bg-paper text-ink'
const TAB_IDLE   = 'bg-transparent text-paper-ash3 hover:text-paper'

export function CCBMCDetailDrawer() {
  const detailPanel = useComfyStore((state) => state.detailPanel)
  const closeDetailPanel = useComfyStore((state) => state.closeDetailPanel)
  const nodeData = useComfyStore((state) => {
    if (!state.detailPanel?.nodeId) return null
    return state.macraNodes.get(state.detailPanel.nodeId) ?? null
  })
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  if (!detailPanel?.isOpen || !detailPanel?.nodeId) {
    return null
  }

  const nodeWithDetails = nodeData as (typeof nodeData & { summary?: string; fullContent?: string }) | null

  if (!nodeData) {
    return null
  }

  const fullContent = nodeWithDetails?.fullContent || nodeData.content || ''
  const summary = nodeWithDetails?.summary || nodeData.content || ''
  const byline = nodeData.domain ? BYLINE_BY_DOMAIN[nodeData.domain] : undefined

  // Quiz 生成处理函数 - 调用真实的 AI API
  const handleGenerateQuiz = async (): Promise<QuizQuestion[]> => {
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeLabel: nodeData.label,
          nodeDomain: nodeData.domain || '',
          nodeContent: fullContent || summary || nodeData.content || ''
        })
      })

      if (!response.ok) {
        console.error('Quiz API 调用失败:', response.status)
        throw new Error(`Quiz API error: ${response.status}`)
      }

      const questions = await response.json()
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid quiz response format')
      }
      return questions
    } catch (error) {
      console.error('生成 Quiz 失败:', error)
      // 降级：返回 Mock 数据
      return [
        {
          id: '1',
          question: `关于 ${nodeData.domain} 维度，以下哪个描述最符合 ${nodeData.label} 的核心价值？`,
          options: [
            '通过降低成本提升竞争力',
            '通过创新服务增强客户粘性',
            '通过规模化运营提高效率',
            '通过差异化定位占领市场'
          ],
          correctAnswer: 1,
          explanation: `基于 ${nodeData.label} 的内容分析，该方案的核心在于通过创新服务来增强客户粘性，这与 ${nodeData.domain} 的战略定位高度一致。`,
          difficulty: 'medium'
        },
        {
          id: '2',
          question: `在 ${nodeData.domain} 的实施过程中，最关键的风险因素是什么？`,
          options: ['市场需求不确定性', '技术实现复杂度', '资源投入不足', '竞争对手模仿'],
          correctAnswer: 0,
          explanation: '市场需求的不确定性是该维度最需要关注的风险因素，需要通过持续的市场验证和快速迭代来降低风险。',
          difficulty: 'hard'
        },
        {
          id: '3',
          question: `${nodeData.label} 与哪个 CC-BMC 维度的协同效应最强？`,
          options: [
            '价值主张 (Value Propositions)',
            '客户细分 (Customer Segments)',
            '关键资源 (Key Resources)',
            '成本结构 (Cost Structure)'
          ],
          correctAnswer: 0,
          explanation: '价值主张与该要素之间存在强协同关系，两者相互支撑构成商业模式的核心逻辑。',
          difficulty: 'easy'
        }
      ]
    }
  }

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'overview',  label: '概览',     icon: <FileText className="w-3 h-3" strokeWidth={1.5} /> },
    { id: 'quiz',      label: 'QUIZ',     icon: <MessageSquare className="w-3 h-3" strokeWidth={1.5} /> },
    { id: 'edit',      label: '编辑',     icon: <Edit3 className="w-3 h-3" strokeWidth={1.5} /> },
    { id: 'resources', label: '资源',     icon: <Link2 className="w-3 h-3" strokeWidth={1.5} /> }
  ]

  return (
    <>
      {/* 遮罩层 — ink at 70% */}
      <div
        className="fixed inset-0 bg-ink/70 z-40 animate-editorial-swap"
        onClick={closeDetailPanel}
      />

      {/* 抽屉主体 — brutalist 1.5px 边，无阴影无圆角 */}
      <aside
        className="fixed right-0 top-0 bottom-0 w-[500px] max-w-[100vw] bg-ink-ash1 border-l-[1.5px] border-paper/30 z-50 flex flex-col animate-editorial-publish"
        role="dialog"
        aria-modal="true"
      >
        {/* 头部 — byline glyph + Fraunces 标题 + mono 维度 kicker */}
        <header className="flex items-start justify-between gap-3 px-6 py-4 border-b-[1.5px] border-paper/30 shrink-0">
          <div className="flex items-baseline gap-3 min-w-0">
            {byline ? (
              <span
                aria-hidden="true"
                className={`shrink-0 font-display font-[700] text-[28px] leading-none ${byline.tint}`}
              >
                {byline.glyph}
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-instr text-[10px] uppercase tracking-kicker text-paper-ash3">
                {nodeData.domain || 'BMC CELL'}
              </p>
              <h2
                className="font-display font-[700] text-[20px] tracking-[0.02em] text-paper truncate mt-0.5"
                title={nodeData.label}
              >
                {nodeData.label}
              </h2>
            </div>
          </div>
          <button
            onClick={closeDetailPanel}
            className="shrink-0 p-1.5 border-[0.5px] border-ink-ash3/40 text-paper-ash3 hover:border-paper/40 hover:text-paper transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </header>

        {/* 标签栏 — brutalist 1px paper 边的 segmented */}
        <div className="px-6 py-3 border-b-[0.5px] border-ink-ash3/30 shrink-0">
          <div className="flex items-stretch border-[1px] border-paper/30 w-fit">
            {tabs.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  TAB_BASE,
                  activeTab === tab.id ? TAB_ACTIVE : TAB_IDLE,
                  idx > 0 ? 'border-l-[1px] border-paper/20' : '',
                ].join(' ')}
                aria-pressed={activeTab === tab.id}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {activeTab === 'overview' && (
            <>
              {/* 摘要 */}
              <Section label="核心摘要" sublabel="SUMMARY">
                <div className="prose prose-sm prose-invert max-w-measure-body font-body text-[13px] leading-[1.55] text-paper/85">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
              </Section>

              {/* 完整内容 */}
              <Section label="详细分析" sublabel="DETAILED ANALYSIS">
                <div className="prose prose-sm prose-invert max-w-measure-body font-body text-[13px] leading-[1.6] text-paper/85">
                  <ReactMarkdown>{fullContent}</ReactMarkdown>
                </div>
              </Section>

              {/* 元数据 */}
              {nodeData.metadata && (
                <Section label="元信息" sublabel="METADATA">
                  <dl className="space-y-2.5 font-instr text-[11px] uppercase tracking-kicker">
                    {nodeData.metadata.agent_signature && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-paper-ash3">CREATED BY</dt>
                        <dd className={byline?.tint ?? 'text-paper'}>
                          {nodeData.metadata.agent_signature}
                        </dd>
                      </div>
                    )}
                    {nodeData.metadata.confidence && (
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-paper-ash3">CONF</dt>
                        <dd className="text-paper">{nodeData.metadata.confidence}</dd>
                      </div>
                    )}
                    {nodeData.metadata.source && (
                      <div className="space-y-1.5">
                        <dt className="text-paper-ash3">SOURCE</dt>
                        <dd className="font-instr text-[11px] tabular-nums text-paper border-l-[1.5px] border-ink-ash3/40 px-2 py-1 normal-case tracking-normal">
                          {nodeData.metadata.source}
                        </dd>
                      </div>
                    )}
                    {nodeData.metadata.cultural_context && (
                      <div className="space-y-1.5">
                        <dt className="text-paper-ash3">CULTURAL CONTEXT</dt>
                        <dd className="font-instr text-[11px] text-paper border-l-[1.5px] border-ink-ash3/40 px-2 py-1 normal-case tracking-normal">
                          {nodeData.metadata.cultural_context}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Section>
              )}
            </>
          )}

          {activeTab === 'quiz' && (
            <QuizPanel
              nodeId={detailPanel.nodeId}
              nodeLabel={nodeData.label}
              domain={nodeData.domain || ''}
              onGenerateQuiz={handleGenerateQuiz}
            />
          )}

          {activeTab === 'edit' && (
            <Placeholder
              icon={<Edit3 className="w-6 h-6 text-paper-ash3" strokeWidth={1.25} />}
              title="编辑功能即将推出"
              detail="您将能够直接修改节点内容和属性"
            />
          )}

          {activeTab === 'resources' && (
            <Placeholder
              icon={<Link2 className="w-6 h-6 text-paper-ash3" strokeWidth={1.25} />}
              title="资源链接功能即将推出"
              detail="相关研究资料和参考链接将显示在此处"
            />
          )}
        </div>
      </aside>
    </>
  )
}

function Section({
  label,
  sublabel,
  children,
}: {
  label: string
  sublabel: string
  children: React.ReactNode
}) {
  return (
    <section>
      <header className="flex items-baseline justify-between mb-2.5 pb-1.5 border-b-[0.5px] border-ink-ash3/30">
        <h3 className="font-display font-[700] text-[13px] tracking-[0.04em] uppercase text-paper">
          {label}
        </h3>
        <span className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4">
          {sublabel}
        </span>
      </header>
      <div className="border-[0.5px] border-ink-ash3/30 bg-ink-ash2/20 px-4 py-3">
        {children}
      </div>
    </section>
  )
}

function Placeholder({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="border-[0.5px] border-ink-ash3/30 bg-ink-ash2/20 px-4 py-8 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="font-display font-[700] text-[14px] text-paper">{title}</p>
      <p className="font-instr text-[10px] uppercase tracking-kicker text-ink-ash4 mt-2">
        {detail}
      </p>
    </div>
  )
}
