'use client'

import { useMemo, useState } from 'react'
import {
  CalendarIcon,
  ChatBubbleIcon,
  ClipboardIcon,
  FileTextIcon,
  GlobeIcon,
  LightningBoltIcon,
  MagicWandIcon,
  PersonIcon,
  RocketIcon,
  StackIcon,
  TargetIcon
} from '@radix-ui/react-icons'
import { motion } from 'framer-motion'
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

type IconType = typeof LightningBoltIcon

type HeroStat = {
  value: string
  label: string
  detail: string
}

type QuickHighlight = {
  title: string
  description: string
  icon: IconType
}

type ProjectModule = {
  title: string
  description: string
  tags: string[]
  icon: IconType
}

type ProjectMilestone = {
  time: string
  title: string
  detail: string
}

type ProjectDeliverable = {
  title: string
  detail: string
  format: string
}

type UseCase = {
  title: string
  description: string
  outputs: string[]
  icon: IconType
}

type FaqItem = {
  question: string
  answer: string
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
          '我先为你在画布中心创建"新能源市场进入策略"主节点,并分出「市场吸引力」「进入路径」「关键行动」三个维度。'
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
          '已在时间线记录中标记"会议复盘-01"，可随时回放当时的画布形态。'
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

const heroStats: HeroStat[] = [
  {
    value: '30+',
    label: '行业模板',
    detail: '策略/增长/复盘'
  },
  {
    value: '5 种',
    label: '输出格式',
    detail: 'PPT/Notion/Markdown'
  },
  {
    value: '实时',
    label: '协作状态',
    detail: '节点、行动同步'
  }
]

const quickHighlights: QuickHighlight[] = [
  {
    title: '对话秒级结构化',
    description: '提问后即时生成节点、假设与行动项，避免在文档中迷路。',
    icon: MagicWandIcon
  },
  {
    title: '引用可追溯',
    description: '上传文档或数据后自动抽取引用，节点内即可追溯原文。',
    icon: ClipboardIcon
  },
  {
    title: '输出即交付',
    description: '画布内容一键生成报告、分享摘要或行动清单，直接对外输出。',
    icon: FileTextIcon
  },
  {
    title: '协作同步推进',
    description: '支持多人共编、评论和版本回放，团队决策对齐更快。',
    icon: GlobeIcon
  }
]

const projectModules: ProjectModule[] = [
  {
    title: '问题定义',
    description: '明确目标、范围与关键指标，形成统一的项目起点。',
    tags: ['目标清单', '约束范围', '成功指标'],
    icon: TargetIcon
  },
  {
    title: '洞察沉淀',
    description: '收敛调研与访谈证据，把洞察挂载到画布节点。',
    tags: ['引文归档', '关键数据', '假设记录'],
    icon: ClipboardIcon
  },
  {
    title: '方案推演',
    description: '围绕关键路径构建多方案对比，明确权衡与优先级。',
    tags: ['路径对比', '风险评估', '资源测算'],
    icon: StackIcon
  },
  {
    title: '协作推进',
    description: '跨角色同步进展与责任，确保行动持续落地。',
    tags: ['行动追踪', '里程碑', '复盘记录'],
    icon: CalendarIcon
  }
]

const projectMilestones: ProjectMilestone[] = [
  {
    time: 'Week 1',
    title: '问题对齐与假设树',
    detail: '完成目标拆解、核心假设与初步节点结构。'
  },
  {
    time: 'Week 2',
    title: '证据收集与洞察归纳',
    detail: '完成关键访谈与资料整理，形成证据链。'
  },
  {
    time: 'Week 3',
    title: '方案推演与优先级排序',
    detail: '输出多方案对比，形成可执行路径。'
  },
  {
    time: 'Week 4',
    title: '交付与复盘沉淀',
    detail: '完成对外报告、行动清单与复盘模板。'
  }
]

const projectDeliverables: ProjectDeliverable[] = [
  {
    title: '策略画布',
    detail: '可复用的多维节点结构，连线清晰。',
    format: 'Canvas'
  },
  {
    title: '研究报告',
    detail: '引用可追溯，适合对外沟通。',
    format: 'PPT / PDF'
  },
  {
    title: '行动清单',
    detail: '负责人、截止时间与风险同步。',
    format: 'Notion / CSV'
  },
  {
    title: '复盘总结',
    detail: '关键决策与迭代建议沉淀。',
    format: 'Markdown'
  }
]

const useCases: UseCase[] = [
  {
    title: '战略与行业研究',
    description: '快速拆解市场与竞争格局，把调研结论沉淀为可复用节点。',
    outputs: ['市场进入路线图', '关键假设清单', '可交付研究报告'],
    icon: TargetIcon
  },
  {
    title: '产品规划与需求拆解',
    description: '将目标拆分为清晰模块与优先级，跨角色协作更顺畅。',
    outputs: ['功能优先级矩阵', '里程碑计划', '资源分配建议'],
    icon: StackIcon
  },
  {
    title: '会议复盘与执行推进',
    description: '会议内容即时沉淀成行动清单，持续追踪负责人和截止时间。',
    outputs: ['复盘重点摘要', '行动责任清单', '风险提醒计划'],
    icon: CalendarIcon
  }
]

const faqItems: FaqItem[] = [
  {
    question: '没有画布经验也能用吗？',
    answer: '可以。Branching Chat 会根据提问自动生成主节点与分支结构。'
  },
  {
    question: '支持导出到哪些格式？',
    answer: '支持导出 PPT、Notion、Markdown 或 PDF，并保留引用与行动项。'
  },
  {
    question: '是否支持团队协作？',
    answer: '支持多人同步编辑、评论与时间线回放，方便团队对齐决策。'
  },
  {
    question: '适合哪些团队或场景？',
    answer: '战略研究、产品规划、项目复盘、社群共创等场景都很合适。'
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
    icon: LightningBoltIcon,
    emoji: '💭'
  },
  {
    title: '扩展画布',
    description: '通过对话或拖拽节点不断细化维度，上传素材后自动生成引用与摘要。',
    icon: StackIcon,
    emoji: '🌱'
  },
  {
    title: '协作推进',
    description: '与团队同步编辑画布，借助时间线回放和对话记录追踪每个决策。',
    emoji: '🤝'
  },
  {
    title: '沉淀与分享',
    description: '一键生成知识库条目、行动清单或社群分享模板，持续复用。',
    emoji: '✨'
  }
] as const

const integrationHighlights = [
  {
    title: '知识库联动',
    description:
      '画布节点与知识库条目双向同步：任何对话生成的节点都可追溯到原始引用，反之亦然。支持全文检索、标签体系与语义推荐。',
    points: ['引用定位到原文段落', '模板化入库流程', '自定义字段与权限'],
    emoji: '📚'
  },
  {
    title: '社群共创',
    description:
      '把画布或知识条目发布到主题圈子，获取实践者反馈。系统会根据你的关注点推送动态，帮助你持续巡航灵感。',
    points: ['行业圈子共编', 'Workshop 周更新', '精选案例收藏夹'],
    emoji: '🌟'
  },
  {
    title: '自动化 Agent',
    description:
      '将画布工作流配置成巡航 Agent：定期抓取数据、重新计算节点状态，并输出报告或提醒到协作工具。',
    points: ['可视化流程编排', 'Webhook/REST 集成', '定时推送与告警'],
    emoji: '🤖'
  }
] as const

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const floatingAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: 'easeInOut'
  }
}

export default function LandingPage() {
  const [activeMode, setActiveMode] = useState<ModeKey>('canvas')

  const currentMode = useMemo(
    () => previewModes.find((mode) => mode.key === activeMode) ?? previewModes[0],
    [activeMode]
  )

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-[#FFF4E6] via-[#FFE8D6] to-[#FFF8F0] text-neutral-800">
      {/* Organic Background Decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Warm blob shapes */}
        <motion.div
          animate={floatingAnimation}
          className="absolute -left-20 top-[-100px] h-[500px] w-[500px] rounded-[45%_55%_60%_40%/50%_60%_40%_50%] bg-gradient-to-br from-[#FFB4A2]/30 to-[#FF9B8A]/20 blur-3xl"
        />
        <motion.div
          animate={{ ...floatingAnimation, transition: { ...floatingAnimation.transition, delay: 1 } }}
          className="absolute right-[-100px] top-[200px] h-[600px] w-[600px] rounded-[40%_60%_55%_45%/55%_45%_55%_45%] bg-gradient-to-br from-[#FFD4A3]/25 to-[#FFC888]/15 blur-3xl"
        />
        <motion.div
          animate={{ ...floatingAnimation, transition: { ...floatingAnimation.transition, delay: 2 } }}
          className="absolute bottom-[-150px] left-1/3 h-[450px] w-[450px] rounded-[55%_45%_50%_50%/45%_55%_45%_55%] bg-gradient-to-br from-[#A8D5BA]/20 to-[#7FC89D]/15 blur-3xl"
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Sidebar */}
      <aside className="relative z-10 hidden w-64 shrink-0 flex-col border-r border-[#FFB4A2]/20 bg-white/60 pb-6 pt-8 backdrop-blur-xl supports-[backdrop-filter]:bg-white/40 lg:flex">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 px-6 pb-8"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#FF9B8A] to-[#FFB4A2] text-base font-semibold text-white shadow-lg shadow-[#FF9B8A]/30">
            BC
          </div>
          <div>
            <div className="font-serif text-base font-semibold text-neutral-800">Branching Chat</div>
            <div className="text-xs text-neutral-500">对话即画布</div>
          </div>
        </motion.div>

        <nav className="flex flex-1 flex-col gap-6 px-4">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {navItems.map((item, index) => {
              const isActive = item.key === activeMode
              return (
                <motion.button
                  key={item.key}
                  variants={fadeInUp}
                  transition={{ delay: index * 0.1 }}
                  type="button"
                  onClick={() => setActiveMode(item.key)}
                  className={clsx(
                    'group flex w-full flex-col rounded-[20px] px-4 py-3.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9B8A]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white/70',
                    isActive
                      ? 'bg-gradient-to-br from-[#FF9B8A] via-[#FFB4A2] to-[#FFC8B8] text-white shadow-xl shadow-[#FF9B8A]/25'
                      : 'bg-white/50 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 hover:shadow-md hover:shadow-[#FFB4A2]/10'
                  )}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-[16px] text-base transition-all',
                        isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-600 group-hover:bg-[#FFB4A2]/20'
                      )}
                    >
                      <item.icon />
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">{item.label}</span>
                      <span
                        className={clsx(
                          'text-xs',
                          isActive ? 'text-white/75' : 'text-neutral-500'
                        )}
                      >
                        {item.description}
                      </span>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-3 rounded-[20px] border border-[#FFB4A2]/30 bg-gradient-to-br from-white/70 to-[#FFF4E6]/50 p-5 text-xs text-neutral-600 shadow-sm shadow-[#FFB4A2]/10"
          >
            <p className="font-serif font-semibold text-neutral-800">如何开始？</p>
            <p className="leading-relaxed">
              选择一个场景（项目规划、研究拆解或复盘），和 Branching Chat 对话。画布会随对话实时生成。
            </p>
            <a
              href="/workspace/demo"
              className="inline-flex items-center gap-1 text-[#FF9B8A] transition-colors hover:text-[#FF8876]"
            >
              查看 Demo →
            </a>
          </motion.div>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-auto px-6"
        >
          <div className="rounded-[24px] bg-gradient-to-br from-neutral-800 via-neutral-900 to-[#5A5555] px-5 py-6 text-sm text-white shadow-xl shadow-neutral-900/20">
            <p className="font-serif font-semibold">内测招募</p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              加入 Branching Canvas 内测群，抢先体验多维画布与 Agent 自动化。
            </p>
            <a
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-white/25 hover:shadow-lg"
            >
              <RocketIcon className="h-3.5 w-3.5" />
              报名内测
            </a>
          </div>
        </motion.div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:px-10 lg:px-16">

          {/* Hero Section */}
          <motion.section
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="space-y-12"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <motion.span
                variants={fadeInUp}
                className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-medium text-[#FF9B8A] shadow-md shadow-[#FFB4A2]/20 backdrop-blur-sm"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF9B8A]" />
                Branching Canvas Chat · 多维画布内的对话式研究
              </motion.span>
              <motion.a
                variants={fadeInUp}
                href={currentMode.cta.url}
                className="inline-flex items-center gap-1 rounded-full border border-[#FFB4A2]/40 bg-white/70 px-4 py-2 text-xs font-medium text-[#FF9B8A] shadow-sm backdrop-blur-sm transition-all hover:border-[#FF9B8A] hover:bg-white hover:shadow-md"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                了解工作台 →
              </motion.a>
            </div>

            <div className="grid gap-12 lg:grid-cols-[minmax(340px,420px),1fr]">
              {/* Left: Text Content */}
              <motion.div variants={fadeInUp} className="space-y-8">
                <div className="space-y-5">
                  <h1 className="font-serif text-5xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-6xl">
                    对话即画布，<br />
                    <span className="bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2] bg-clip-text text-transparent">
                      画布即推理
                    </span>
                  </h1>
                  <p className="text-lg leading-relaxed text-neutral-600">
                    Branching Chat 用多维画布承载每一次对话，将聊天内容实时映射成节点、连线与行动项。
                    复杂议题不再停留在文本里，而是在画布上逐步成形、追踪与复用。
                  </p>
                </div>

                <motion.div
                  variants={fadeInUp}
                  className="rounded-[28px] border border-[#FFB4A2]/30 bg-gradient-to-br from-white/80 to-[#FFF4E6]/60 p-6 shadow-xl shadow-[#FFB4A2]/10 backdrop-blur-sm"
                  whileHover={{ y: -4, shadow: '0 20px 40px rgba(255, 155, 138, 0.15)' }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9B8A]">
                    {currentMode.headline}
                  </span>
                  <h2 className="mt-3 font-serif text-xl font-semibold text-neutral-900">
                    {currentMode.highlight}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    {currentMode.description}
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm text-neutral-600">
                    {currentMode.metrics.map((metric) => (
                      <li key={metric} className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2]" />
                        <span>{metric}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                <div className="flex flex-wrap items-center gap-4">
                  <motion.a
                    href={currentMode.cta.url}
                    className="rounded-full bg-gradient-to-r from-neutral-900 to-neutral-800 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-neutral-900/20 transition-all hover:shadow-2xl hover:shadow-neutral-900/30"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {currentMode.cta.label}
                  </motion.a>
                  <motion.a
                    href="/dashboard"
                    className="rounded-full border-2 border-neutral-200 px-6 py-3 text-sm font-medium text-neutral-700 transition-all hover:border-[#FFB4A2] hover:bg-white/50 hover:text-[#FF9B8A]"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    查看更多场景
                  </motion.a>
                </div>

                <motion.div variants={fadeInUp} className="grid gap-4 sm:grid-cols-3">
                  {heroStats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-[22px] border border-white/70 bg-white/70 px-4 py-4 text-xs text-neutral-500 shadow-lg shadow-[#FFB4A2]/10 backdrop-blur"
                    >
                      <div className="text-lg font-semibold text-neutral-900">{stat.value}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[#FF9B8A]">
                        {stat.label}
                      </div>
                      <div className="mt-2 text-xs text-neutral-500">{stat.detail}</div>
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right: Preview */}
              <motion.div variants={fadeInUp} className="relative">
                <div className="absolute -top-4 right-8 hidden rounded-full bg-white/90 px-4 py-1.5 text-xs font-medium text-neutral-500 shadow-md backdrop-blur-sm sm:inline-flex">
                  {currentMode.label} · 预览状态
                </div>

                <motion.div
                  className="rounded-[36px] border border-white/60 bg-white/70 p-7 shadow-2xl shadow-[#FFB4A2]/15 backdrop-blur-md"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.4 }}
                >
                  {/* Conversation Preview */}
                  <div className="rounded-[24px] border border-[#FFB4A2]/20 bg-gradient-to-br from-white via-[#FFF8F0] to-white p-6 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                        <LightningBoltIcon className="h-4 w-4 text-[#FF9B8A]" />
                        Branching 对话
                      </span>
                      <span className="flex items-center gap-1.5 rounded-full bg-[#A8D5BA]/15 px-3 py-1 text-[11px] font-medium text-[#7FC89D]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7FC89D]" />
                        实时同步
                      </span>
                    </div>

                    <div className="mt-5 space-y-3.5">
                      {currentMode.conversation.map((message, index) => {
                        const isUser = message.speaker === '你'
                        return (
                          <motion.div
                            key={`${message.speaker}-${index}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.15 }}
                            className={clsx(
                              'max-w-[88%] rounded-[20px] px-5 py-3.5 text-sm leading-relaxed shadow-lg',
                              isUser
                                ? 'ml-auto bg-gradient-to-br from-[#FF9B8A] to-[#FFB4A2] text-white shadow-[#FF9B8A]/20'
                                : 'mr-auto bg-white text-neutral-700 shadow-neutral-200/50'
                            )}
                          >
                            <div
                              className={clsx(
                                'mb-1 text-[10px] font-semibold uppercase tracking-wider',
                                isUser ? 'text-white/75' : 'text-[#FF9B8A]'
                              )}
                            >
                              {message.speaker}
                            </div>
                            {message.content}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Nodes Preview */}
                  <div className="mt-6 rounded-[24px] border border-[#FFB4A2]/20 bg-gradient-to-br from-white to-[#FFF8F0] p-6 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                        <TargetIcon className="h-4 w-4 text-[#FF9B8A]" />
                        画布节点快照
                      </span>
                      <span className="text-xs text-neutral-400">节点与引用实时同步</span>
                    </div>

                    <div className="mt-5 grid gap-3.5 sm:grid-cols-2">
                      {currentMode.nodes.map((node, index) => (
                        <motion.div
                          key={node.title}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="rounded-[18px] border border-[#FFB4A2]/25 bg-white px-4 py-4 text-xs text-neutral-600 shadow-md shadow-[#FFB4A2]/10 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-[#FFB4A2]/15"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-serif text-sm font-semibold text-neutral-800">
                              {node.title}
                            </span>
                            <span className="shrink-0 rounded-full bg-[#FF9B8A]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#FF9B8A]">
                              {node.meta}
                            </span>
                          </div>
                          <p className="mt-2.5 leading-relaxed text-neutral-600">{node.detail}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Mode Switcher */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-5 flex items-center justify-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-lg shadow-neutral-200/50 backdrop-blur-md"
                >
                  {previewModes.map((mode) => {
                    const isCurrent = mode.key === activeMode
                    return (
                      <motion.button
                        key={mode.key}
                        type="button"
                        onClick={() => setActiveMode(mode.key)}
                        className={clsx(
                          'rounded-full px-4 py-1.5 text-[11px] font-medium transition-all',
                          isCurrent
                            ? 'bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2] text-white shadow-lg shadow-[#FF9B8A]/30'
                            : 'text-neutral-600 hover:bg-[#FFB4A2]/10 hover:text-[#FF9B8A]'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {mode.label}
                      </motion.button>
                    )
                  })}
                </motion.div>
              </motion.div>
            </div>
          </motion.section>

          {/* Highlights Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-10 rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl font-bold text-neutral-900">更清晰，也更可交付</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                  Branching Chat 把对话、画布与知识库串成一体，让每次讨论都能沉淀为可复用的成果。
                </p>
              </div>
              <motion.a
                href="/workspace/demo"
                className="rounded-full border-2 border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:border-[#FFB4A2] hover:bg-white/50 hover:text-[#FF9B8A]"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                预约体验 →
              </motion.a>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
            >
              {quickHighlights.map((highlight) => (
                <motion.div
                  key={highlight.title}
                  variants={fadeInUp}
                  className="group flex flex-col gap-4 rounded-[26px] border border-[#FFB4A2]/20 bg-gradient-to-br from-white to-[#FFF8F0] p-6 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-[#FFB4A2]/15"
                  whileHover={{ y: -8 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#FFB4A2]/15 text-[#FF9B8A]">
                      <highlight.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-serif text-lg font-bold text-neutral-900">{highlight.title}</h3>
                  </div>
                  <p className="leading-relaxed text-neutral-600">{highlight.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Workflow Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl font-bold text-neutral-900">多维画布工作流</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                  一套流程将对话、画布、知识与行动串联起来。随时切换场景，分支结构与上下文永远保持一致。
                </p>
              </div>
              <motion.a
                href="/workspace/demo"
                className="rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2] px-5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-[#FF9B8A]/25 transition-all hover:shadow-2xl hover:shadow-[#FF9B8A]/35"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                查看完整流程 →
              </motion.a>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="mt-10 grid gap-6 lg:grid-cols-4"
            >
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  variants={fadeInUp}
                  className="group relative flex flex-col gap-5 rounded-[28px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white to-[#FFF8F0] p-7 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-[#FFB4A2]/15"
                  whileHover={{ y: -8 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#FF9B8A]">Step {index + 1}</span>
                    <span className="text-3xl transition-transform group-hover:scale-110">
                      {step.emoji}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-neutral-900">{step.title}</h3>
                  <p className="leading-relaxed text-neutral-600">{step.description}</p>

                  {/* Connection line */}
                  {index < workflowSteps.length - 1 && (
                    <div className="absolute -right-3 top-1/2 hidden h-0.5 w-6 bg-gradient-to-r from-[#FFB4A2] to-transparent lg:block" />
                  )}
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Project Blueprint Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-10 rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl font-bold text-neutral-900">项目内容蓝图</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                  用结构化模块、时间线与可交付物，构成一整套项目推进内容，确保每一次对话都能落到结果。
                </p>
              </div>
              <motion.a
                href="/workspace/demo"
                className="rounded-full border-2 border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:border-[#FFB4A2] hover:bg-white/50 hover:text-[#FF9B8A]"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                下载项目模板 →
              </motion.a>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  {projectModules.map((module) => (
                    <motion.div
                      key={module.title}
                      variants={fadeInUp}
                      className="group flex flex-col gap-4 rounded-[26px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white to-[#FFF8F0] p-6 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-[#FFB4A2]/15"
                      whileHover={{ y: -6 }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#FFB4A2]/15 text-[#FF9B8A]">
                          <module.icon className="h-5 w-5" />
                        </span>
                        <h3 className="font-serif text-lg font-bold text-neutral-900">{module.title}</h3>
                      </div>
                      <p className="leading-relaxed text-neutral-600">{module.description}</p>
                      <div className="flex flex-wrap gap-2 text-[11px] font-medium text-[#FF9B8A]">
                        {module.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[#FFB4A2]/40 bg-white/80 px-2.5 py-1"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="rounded-[28px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white to-[#FFF8F0] p-6 shadow-lg shadow-[#FFB4A2]/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl font-bold text-neutral-900">核心交付物</h3>
                      <p className="mt-2 text-sm text-neutral-600">
                        每个项目模块都会生成可分享、可复用的交付成果。
                      </p>
                    </div>
                    <span className="rounded-full bg-[#FFB4A2]/20 px-3 py-1 text-xs font-semibold text-[#FF9B8A]">
                      自动汇总
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {projectDeliverables.map((deliverable) => (
                      <div
                        key={deliverable.title}
                        className="rounded-[20px] border border-[#FFB4A2]/20 bg-white/80 px-4 py-4 text-xs text-neutral-600 shadow-md shadow-[#FFB4A2]/5"
                      >
                        <div className="text-sm font-semibold text-neutral-900">{deliverable.title}</div>
                        <div className="mt-1 text-[11px] font-medium text-[#FF9B8A]">
                          {deliverable.format}
                        </div>
                        <p className="mt-2 leading-relaxed text-neutral-600">{deliverable.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white via-[#FFF8F0] to-white p-7 shadow-xl shadow-[#FFB4A2]/10">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-xl font-bold text-neutral-900">四周推进节奏</h3>
                  <span className="text-xs text-neutral-500">可自定义节奏</span>
                </div>
                <div className="mt-6 space-y-4">
                  {projectMilestones.map((milestone) => (
                    <div
                      key={milestone.title}
                      className="rounded-[22px] border border-[#FFB4A2]/20 bg-white/80 px-5 py-4 text-sm text-neutral-600 shadow-md shadow-[#FFB4A2]/5"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2]" />
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FF9B8A]">
                            {milestone.time}
                          </div>
                          <div className="mt-1 text-base font-semibold text-neutral-900">
                            {milestone.title}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                            {milestone.detail}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Use Cases Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-10 rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl font-bold text-neutral-900">适配你的核心场景</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                  从战略研究到团队复盘，把问题拆解、知识沉淀与执行推进整合在一张画布里。
                </p>
              </div>
              <motion.a
                href="/dashboard"
                className="rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2] px-5 py-2.5 text-sm font-semibold text-white shadow-xl shadow-[#FF9B8A]/25 transition-all hover:shadow-2xl hover:shadow-[#FF9B8A]/35"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                查看模板库 →
              </motion.a>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-8 lg:grid-cols-3"
            >
              {useCases.map((useCase) => (
                <motion.div
                  key={useCase.title}
                  variants={fadeInUp}
                  className="group flex flex-col gap-5 rounded-[28px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white to-[#FFF8F0] p-8 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-[#FFB4A2]/15"
                  whileHover={{ y: -8 }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[#FFB4A2]/15 text-[#FF9B8A]">
                      <useCase.icon className="h-5 w-5" />
                    </span>
                    <h3 className="font-serif text-xl font-bold text-neutral-900">{useCase.title}</h3>
                  </div>
                  <p className="leading-relaxed text-neutral-600">{useCase.description}</p>
                  <ul className="space-y-2 text-sm">
                    {useCase.outputs.map((output) => (
                      <li key={output} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2]" />
                        <span className="text-neutral-600">{output}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Integration Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-10 rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 className="font-serif text-3xl font-bold text-neutral-900">画布之外的延展能力</h2>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                  对话与画布是起点，知识库、社群与自动化才是长期复利的关键。Branching Chat 将它们全部串起来。
                </p>
              </div>
              <motion.a
                href="/dashboard"
                className="rounded-full border-2 border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-all hover:border-[#FFB4A2] hover:bg-white/50 hover:text-[#FF9B8A]"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                浏览工作台 →
              </motion.a>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-8 lg:grid-cols-3"
            >
              {integrationHighlights.map((highlight) => (
                <motion.div
                  key={highlight.title}
                  variants={fadeInUp}
                  className="group flex flex-col gap-5 rounded-[28px] border border-[#FFB4A2]/25 bg-gradient-to-br from-white to-[#FFF8F0] p-8 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5 transition-all hover:-translate-y-2 hover:shadow-xl hover:shadow-[#FFB4A2]/15"
                  whileHover={{ y: -8 }}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl font-bold text-neutral-900">
                      {highlight.title}
                    </h3>
                    <span className="text-3xl transition-transform group-hover:scale-110">
                      {highlight.emoji}
                    </span>
                  </div>
                  <p className="leading-relaxed text-neutral-600">{highlight.description}</p>
                  <ul className="space-y-2.5 text-sm">
                    {highlight.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2]" />
                        <span className="text-neutral-600">{point}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* FAQ Section */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className="space-y-10 rounded-[40px] border border-white/60 bg-white/70 p-10 shadow-2xl shadow-[#FFB4A2]/10 backdrop-blur-md"
          >
            <div>
              <h2 className="font-serif text-3xl font-bold text-neutral-900">常见问题</h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                我们整理了最常被问到的问题，帮助你快速判断 Branching Chat 是否适合你的团队。
              </p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-6 lg:grid-cols-2"
            >
              {faqItems.map((item, index) => (
                <motion.div
                  key={item.question}
                  variants={fadeInUp}
                  className="rounded-[26px] border border-[#FFB4A2]/20 bg-gradient-to-br from-white to-[#FFF8F0] p-6 text-sm text-neutral-600 shadow-lg shadow-[#FFB4A2]/5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFB4A2]/20 text-xs font-semibold text-[#FF9B8A]">
                      Q{index + 1}
                    </span>
                    <div>
                      <h3 className="font-serif text-lg font-semibold text-neutral-900">{item.question}</h3>
                      <p className="mt-2 leading-relaxed text-neutral-600">{item.answer}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Final CTA */}
          <motion.section
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="pb-12"
          >
            <div className="rounded-[36px] border border-[#FFB4A2]/30 bg-gradient-to-br from-white/80 to-[#FFF4E6]/60 p-8 shadow-2xl shadow-[#FFB4A2]/15 backdrop-blur-sm">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-neutral-900">
                    准备把你的议题搬进画布了吗？
                  </h3>
                  <p className="mt-2 text-base text-neutral-600">
                    预约导览或直接进入 Demo，与 Branching Chat 一起体验&quot;对话即画布&quot;的工作方式。
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <motion.a
                    href="/workspace/demo"
                    className="rounded-full border-2 border-neutral-200 px-5 py-2.5 font-medium text-neutral-700 transition-all hover:border-[#FFB4A2] hover:bg-white/70 hover:text-[#FF9B8A]"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    进入 Demo
                  </motion.a>
                  <motion.a
                    href="/dashboard"
                    className="rounded-full bg-gradient-to-r from-[#FF9B8A] to-[#FFB4A2] px-5 py-2.5 font-semibold text-white shadow-xl shadow-[#FF9B8A]/25 transition-all hover:shadow-2xl hover:shadow-[#FF9B8A]/35"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    预约导览
                  </motion.a>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
