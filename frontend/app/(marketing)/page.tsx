'use client'

import { useMemo, useState } from 'react'
import {
  ChatBubbleIcon,
  LightningBoltIcon,
  PersonIcon,
  RocketIcon,
  StackIcon,
  TargetIcon
} from '@radix-ui/react-icons'
import clsx from 'clsx'

type ModeKey = 'canvas' | 'threads' | 'knowledge' | 'community'

type PreviewMessage = {
  speaker: '你' | 'Branching'
  content: string
}

type PreviewNode = {
  title: string
  detail: string
  meta: string
}

type ModeData = {
  key: ModeKey
  label: string
  description: string
  headline: string
  highlight: string
  metrics: string[]
  conversation: PreviewMessage[]
  nodes: PreviewNode[]
  cta: { label: string; url: string }
}

const previewModes: ModeData[] = [
  {
    key: 'canvas',
    label: '画布对话',
    description: '在多维画布内同步拓展节点、连线与行动项，聊天过程即是知识沉淀过程。',
    headline: '多维画布实时生长',
    highlight: '对话生成节点 · 节点反哺对话',
    metrics: ['问题树自动化拆解', '多模引用一键挂载', '实时共同编辑'],
    conversation: [
      {
        speaker: '你',
        content: '我们要输出一个新能源市场进入策略的路线图，从哪里开始拆解？'
      },
      {
        speaker: 'Branching',
        content:
          '我先为你在画布中心创建“新能源市场进入策略”主节点，并分出「市场吸引力」「进入路径」「关键行动」三个维度。'
      },
      {
        speaker: 'Branching',
        content:
          '你可以上传已有调研资料，我会自动抽取引文挂载到对应节点，同时生成第一批行动项。'
      }
    ],
    nodes: [
      {
        title: '市场吸引力',
        detail: '评估需求增长、政策扶持与竞争格局。',
        meta: '洞察节点 · 3 条引用'
      },
      {
        title: '进入路径',
        detail: '比较合资、独立品牌与收购三种方案。',
        meta: '策略节点 · 2 个子节点'
      },
      {
        title: '首月行动清单',
        detail: '完成六个关键访谈并验证定价假设。',
        meta: '行动节点 · 6 个待办'
      }
    ],
    cta: { label: '开启多维对话', url: '/workspace/demo' }
  },
  {
    key: 'threads',
    label: '对话记录',
    description: '保留每一次提问与推演的上下文，自动串联回应与画布节点。',
    headline: '不断延展的问题线程',
    highlight: '上下文追踪 · 变化高亮',
    metrics: ['多轮提问可回滚', '引用原文实时定位', '行动项自动汇总'],
    conversation: [
      {
        speaker: '你',
        content: '帮我梳理上一轮会议输出的风险点，并给出后续验证方式。'
      },
      {
        speaker: 'Branching',
        content:
          '我在「风险监控」分支收敛出三类风险：政策、供应链和销售渠道。已经为每一类生成未验证假设。'
      },
      {
        speaker: 'Branching',
        content:
          '已在时间线记录中标记“会议复盘-01”，可随时回放当时的画布形态。'
      }
    ],
    nodes: [
      {
        title: '政策风险',
        detail: '地方补贴退坡、指标获取不确定。',
        meta: '风险节点 · 2 条待验证'
      },
      {
        title: '供应链风险',
        detail: '关键零部件依赖进口，交付周期长。',
        meta: '风险节点 · 1 个紧急'
      },
      {
        title: '验证计划',
        detail: '两周内完成供应商访谈并模拟成本波动。',
        meta: '行动节点 · 截止 03.18'
      }
    ],
    cta: { label: '查看对话时间线', url: '/workspace/demo' }
  },
  {
    key: 'knowledge',
    label: '知识底座',
    description: '把对话与画布沉淀成可索引的知识库条目，跨项目复用。',
    headline: '随用随取的知识底座',
    highlight: '节点即知识 · 知识即上下文',
    metrics: ['多格式素材入库', '全文检索+语义推荐', '引用自动同步'],
    conversation: [
      {
        speaker: '你',
        content: '把这次项目的调研洞察整理成知识库条目，并生成分享摘要。'
      },
      {
        speaker: 'Branching',
        content:
          '已创建「新能源市场洞察」条目，引用了 12 份访谈纪要，并把关键结论推送回画布。'
      },
      {
        speaker: 'Branching',
        content: '摘要已生成，包含关键数据、假设与后续观察指标，随时可导出。'
      }
    ],
    nodes: [
      {
        title: '新能源市场洞察',
        detail: '高线人群对换车周期的延长带来潜在需求峰值。',
        meta: '知识条目 · 12 条引用'
      },
      {
        title: '关键数据集',
        detail: '终端价格带、销量、政策补贴三个维度。',
        meta: '数据节点 · 实时同步'
      },
      {
        title: '分享摘要',
        detail: '3 张图表、6 条要点，自动生成 PPT 草稿。',
        meta: '导出 · PPT/Notion'
      }
    ],
    cta: { label: '浏览知识工作台', url: '/dashboard' }
  },
  {
    key: 'community',
    label: '共创社群',
    description: '与同行共享画布与知识条目，获取灵感与反馈，驱动持续迭代。',
    headline: '社区共创的最佳实践',
    highlight: '案例共建 · 灵感巡航',
    metrics: ['圈子共编模板', '案例库自动推荐', 'Workshop 周更'],
    conversation: [
      {
        speaker: '你',
        content: '把这份画布分享到行业圈子，看看有没有优化建议。'
      },
      {
        speaker: 'Branching',
        content:
          '已将画布发布至「新能源增长」圈子，同时发起讨论话题，等待成员反馈。'
      },
      {
        speaker: 'Branching',
        content: '有两位成员建议补充政策敏感度分析，我已生成参考模板供你采纳。'
      }
    ],
    nodes: [
      {
        title: '圈子讨论',
        detail: '5 位成员参与，新增 8 条评论与 2 个附件。',
        meta: '社群节点 · 进行中'
      },
      {
        title: '共创模板',
        detail: '政策敏感度分析画布模板已加入收藏夹。',
        meta: '模板 · 已同步'
      },
      {
        title: '灵感巡航',
        detail: '每周三自动推送新能源行业资讯与案例。',
        meta: '自动化 · Agent'
      }
    ],
    cta: { label: '加入共创社群', url: '/dashboard' }
  }
]

const navItems = [
  {
    key: 'canvas' as ModeKey,
    label: '画布对话',
    description: 'Branching Canvas + Chat',
    icon: LightningBoltIcon
  },
  {
    key: 'threads' as ModeKey,
    label: '对话记录',
    description: '上下文时间线',
    icon: ChatBubbleIcon
  },
  {
    key: 'knowledge' as ModeKey,
    label: '知识底座',
    description: '跨项目沉淀',
    icon: StackIcon
  },
  {
    key: 'community' as ModeKey,
    label: '共创社群',
    description: '案例与灵感',
    icon: PersonIcon
  }
] as const

const workflowSteps = [
  {
    title: '提出问题',
    description: '从聊天开始描述你的目标或困惑，系统立即在画布中生成主节点与初始结构。',
    icon: LightningBoltIcon
  },
  {
    title: '扩展画布',
    description: '通过对话或拖拽节点不断细化维度，上传素材后自动生成引用与摘要。',
    icon: StackIcon
  },
  {
    title: '协作推进',
    description: '与团队同步编辑画布，借助时间线回放和对话记录追踪每个决策。'
  },
  {
    title: '沉淀与分享',
    description: '一键生成知识库条目、行动清单或社群分享模板，持续复用。'
  }
] as const

const integrationHighlights = [
  {
    title: '知识库联动',
    description:
      '画布节点与知识库条目双向同步：任何对话生成的节点都可追溯到原始引用，反之亦然。支持全文检索、标签体系与语义推荐。',
    points: ['引用定位到原文段落', '模板化入库流程', '自定义字段与权限']
  },
  {
    title: '社群共创',
    description:
      '把画布或知识条目发布到主题圈子，获取实践者反馈。系统会根据你的关注点推送动态，帮助你持续巡航灵感。',
    points: ['行业圈子共编', 'Workshop 周更新', '精选案例收藏夹']
  },
  {
    title: '自动化 Agent',
    description:
      '将画布工作流配置成巡航 Agent：定期抓取数据、重新计算节点状态，并输出报告或提醒到协作工具。',
    points: ['可视化流程编排', 'Webhook/REST 集成', '定时推送与告警']
  }
] as const

export default function LandingPage() {
  const [activeMode, setActiveMode] = useState<ModeKey>('canvas')

  const currentMode = useMemo(
    () => previewModes.find((mode) => mode.key === activeMode) ?? previewModes[0],
    [activeMode]
  )

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-[#eef2ff] via-[#f5f7ff] to-white text-slate-800">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-[-120px] h-72 w-72 rounded-full bg-indigo-300/40 blur-3xl" />
        <div className="absolute right-[-60px] top-[160px] h-96 w-96 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-violet-200/30 blur-3xl" />
      </div>

      <aside className="relative z-10 hidden w-60 shrink-0 flex-col border-r border-white/50 bg-white/70 pb-6 pt-8 backdrop-blur-xl supports-[backdrop-filter]:bg-white/55 lg:flex">
        <div className="flex items-center gap-3 px-6 pb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-semibold text-white">
            BC
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">Branching Chat</div>
            <div className="text-xs text-slate-500">Canvas-first AI Workspace</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-6 px-4">
          <div className="space-y-2">
            {navItems.map((item) => {
              const isActive = item.key === activeMode
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveMode(item.key)}
                  className={clsx(
                    'group flex w-full flex-col rounded-2xl px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white/70',
                    isActive
                      ? 'bg-gradient-to-br from-indigo-500 via-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-white/45 text-slate-600 hover:bg-white/75 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-base',
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      <item.icon />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span
                        className={clsx(
                          'text-xs lg:text-[11px]',
                          isActive ? 'text-white/80' : 'text-slate-500'
                        )}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="space-y-3 rounded-2xl border border-indigo-100/60 bg-white/70 p-4 text-xs text-slate-600 shadow-sm shadow-indigo-100/50">
            <p className="font-semibold text-slate-800">如何开始？</p>
            <p>
              选择一个场景（项目规划、研究拆解或复盘），和 Branching Chat 对话。画布会随对话实时生成。
            </p>
            <a
              href="/workspace/demo"
              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
            >
              查看 Demo →
            </a>
          </div>
        </nav>

        <div className="mt-auto px-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-900 px-4 py-5 text-sm text-white shadow-lg">
            <p className="font-semibold">内测招募</p>
            <p className="mt-1 text-xs text-white/70">
              加入 Branching Canvas 内测群，抢先体验多维画布与 Agent 自动化。
            </p>
            <a
              href="/dashboard"
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/20"
            >
              <RocketIcon className="h-3.5 w-3.5" />
              报名内测
            </a>
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 sm:px-10 lg:px-16">
          <section className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm shadow-indigo-100">
                Branching Canvas Chat · 多维画布内的对话式研究
              </span>
              <a
                href={currentMode.cta.url}
                className="inline-flex items-center gap-1 rounded-full border border-indigo-200/60 bg-white/80 px-4 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"
              >
                了解工作台 →
              </a>
            </div>

            <div className="grid gap-10 lg:grid-cols-[minmax(320px,360px),1fr]">
              <div className="space-y-6">
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                    对话即画布，画布即推理过程
                  </h1>
                  <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                    Branching Chat 用多维画布承载每一次对话，将聊天内容实时映射成节点、连线与行动项。
                    复杂议题不再停留在文本里，而是在画布上逐步成形、追踪与复用。
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-100/70 bg-white/70 p-5 shadow-md shadow-indigo-100/50">
                  <span className="text-xs font-medium uppercase tracking-wide text-indigo-500">
                    {currentMode.headline}
                  </span>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">{currentMode.highlight}</h2>
                  <p className="mt-2 text-sm text-slate-600">{currentMode.description}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {currentMode.metrics.map((metric) => (
                      <li key={metric} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        <span>{metric}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={currentMode.cta.url}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-slate-400/20 transition hover:bg-slate-800"
                  >
                    {currentMode.cta.label}
                  </a>
                  <a
                    href="/dashboard"
                    className="rounded-full border border-slate-200 px-5 py-2 text-sm text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                  >
                    查看更多场景
                  </a>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -top-5 right-6 hidden rounded-full bg-white/80 px-4 py-1 text-xs font-medium text-slate-500 shadow sm:inline-flex">
                  {currentMode.label} · 预览状态
                </div>
                <div className="rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-xl shadow-indigo-200/50 backdrop-blur">
                  <div className="rounded-2xl border border-indigo-100/70 bg-gradient-to-br from-white via-white to-indigo-50 p-5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <LightningBoltIcon className="h-4 w-4 text-indigo-500" />
                        Branching 对话
                      </span>
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                        实时同步
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {currentMode.conversation.map((message, index) => {
                        const isUser = message.speaker === '你'
                        return (
                          <div
                            key={`${message.speaker}-${index}`}
                            className={clsx(
                              'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                              isUser
                                ? 'ml-auto bg-indigo-500 text-white shadow-indigo-200'
                                : 'mr-auto bg-white text-slate-700 shadow-indigo-100'
                            )}
                          >
                            <div
                              className={clsx(
                                'mb-1 text-[11px] font-medium uppercase tracking-wide',
                                isUser ? 'text-white/70' : 'text-indigo-500'
                              )}
                            >
                              {message.speaker}
                            </div>
                            {message.content}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-indigo-100/70 bg-white/90 p-5 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <TargetIcon className="h-4 w-4 text-indigo-500" />
                        画布节点快照
                      </span>
                      <span className="text-xs text-slate-400">节点与引用实时同步</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {currentMode.nodes.map((node) => (
                        <div
                          key={node.title}
                          className="rounded-xl border border-indigo-100/70 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm shadow-indigo-100/40"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-800">{node.title}</span>
                            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                              {node.meta}
                            </span>
                          </div>
                          <p className="mt-2 leading-relaxed">{node.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-3 rounded-full bg-white/70 px-3 py-1 text-[11px] text-slate-500 shadow">
                  {previewModes.map((mode) => {
                    const isCurrent = mode.key === activeMode
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setActiveMode(mode.key)}
                        className={clsx(
                          'rounded-full px-3 py-1 transition',
                          isCurrent
                            ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                            : 'hover:bg-indigo-100 hover:text-indigo-600'
                        )}
                      >
                        {mode.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-100/50 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">多维画布工作流</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  一套流程将对话、画布、知识与行动串联起来。随时切换场景，分支结构与上下文永远保持一致。
                </p>
              </div>
              <a
                href="/workspace/demo"
                className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-indigo-400"
              >
                查看完整流程 →
              </a>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative flex flex-col gap-4 rounded-3xl border border-indigo-100/70 bg-gradient-to-br from-white to-slate-50 p-6 text-sm text-slate-600 shadow-sm shadow-indigo-100 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-500">Step {index + 1}</span>
                    {step.icon && (
                      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                        <step.icon />
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                  <p className="leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-8 rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-100/40 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">画布之外的延展能力</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                  对话与画布是起点，知识库、社群与自动化才是长期复利的关键。Branching Chat 将它们全部串起来。
                </p>
              </div>
              <a
                href="/dashboard"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
              >
                浏览工作台 →
              </a>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {integrationHighlights.map((highlight) => (
                <div
                  key={highlight.title}
                  className="flex flex-col gap-4 rounded-3xl border border-indigo-100/70 bg-gradient-to-br from-white to-slate-50 p-6 text-sm text-slate-600 shadow-sm shadow-indigo-100 transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <h3 className="text-lg font-semibold text-slate-900">{highlight.title}</h3>
                  <p className="leading-relaxed">{highlight.description}</p>
                  <ul className="space-y-2 text-sm">
                    {highlight.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-12">
            <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-md shadow-indigo-100/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">准备把你的议题搬进画布了吗？</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    预约导览或直接进入 Demo，与 Branching Chat 一起体验“对话即画布”的工作方式。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <a
                    href="/workspace/demo"
                    className="rounded-full border border-slate-200 px-4 py-2 text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
                  >
                    进入 Demo
                  </a>
                  <a
                    href="/dashboard"
                    className="rounded-full bg-indigo-500 px-4 py-2 font-medium text-white shadow hover:bg-indigo-400"
                  >
                    预约导览
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
