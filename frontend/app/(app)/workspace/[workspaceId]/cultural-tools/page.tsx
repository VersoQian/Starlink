'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'

type ToolTag = 'language' | 'dialogue' | 'reports'

type ToolCard = {
  id: ToolTag
  label: string
  description: string
  icon: string
}

const toolCards: ToolCard[] = [
  { id: 'language', label: '语言转换', description: '繁简 · 方言 · 双语校对', icon: '🌐' },
  { id: 'dialogue', label: '跨文化对话', description: '礼仪提醒 · 场景脚本', icon: '🤝' },
  { id: 'reports', label: '报告撰写', description: '模板匹配 · 法务条款', icon: '📝' }
]

const toolDefinitions: Record<
  ToolTag,
  {
    title: string
    subtitle: string
    description: string
    highlights: { title: string; detail: string }[]
    cta: string
    placeholders: { input: string; output: string }
    presets: string[]
  }
> = {
  language: {
    title: '语言转换工作台',
    subtitle: '保持术语统一，快速完成多语体与方言版本。',
    description:
      '将原始内容转换为符合目标读者的语言风格，支持繁简互转、口语化、商务书信等模式。同时提供 AI 语气优化建议与术语对照表。',
    highlights: [
      { title: '语体转换', detail: '商务正式 / 口语轻松 / 市场营销 / 公文格式' },
      { title: '方言支持', detail: '粤语、闽南语、上海话等场景化表达' },
      { title: '跨语言审校', detail: '双语并排校对，突出术语差异与警示' }
    ],
    cta: '执行语言转换',
    placeholders: {
      input: '示例：请将这段营销文案转成繁体中文，并添加粤语版本的社交媒体文案…',
      output: '转换结果与对照将展示在此。'
    },
    presets: ['繁简互转', '方言适配', '双语校对', '语气微调']
  },
  dialogue: {
    title: '跨文化对话模拟',
    subtitle: '模拟真实商务沟通，提前洞察礼仪与节日营销时机。',
    description:
      '导入会议议题或客户需求，获得分角色对话脚本、敏感点提醒与文化习俗提示。结合行业库呈现多轮模拟。',
    highlights: [
      { title: '角色脚本', detail: '客户/销售/高管多角色台词与意图分析' },
      { title: '礼仪雷达', detail: '高危表述预警，附替代建议与备注' },
      { title: '节日策略', detail: '针对节日与特殊时点给出营销创意' }
    ],
    cta: '启动对话模拟',
    placeholders: {
      input: '示例：模拟与华东经销商的年度复盘会议，对方关注返点与新品节奏…',
      output: '模拟对话、提醒与节日策略将展示在此。'
    },
    presets: ['商务拜访', '渠道会议', '节日营销', '危机沟通']
  },
  reports: {
    title: '报告/合同初稿助手',
    subtitle: '匹配专业模板，输出符合格式的结构化草稿。',
    description:
      '输入企业、产品与需求要点，自动生成行业化模板与章节建议，支持导出多格式并同步到知识库。',
    highlights: [
      { title: '模板库', detail: '覆盖人才计划、合作合同、市场调研等场景' },
      { title: '条款提示', detail: '标注风险条款与可选项，提供调整建议' },
      { title: '导出格式', detail: '支持 PDF / Word / PPT，保留结构与图示' }
    ],
    cta: '生成报告草稿',
    placeholders: {
      input: '示例：为大育英才计划撰写合作提案，重点突出师资优势与落地保障…',
      output: 'AI 将输出大纲、重点条款与下一步建议。'
    },
    presets: ['人才培养方案', '合作合同', '投标提案', '业务总结']
  }
}

const presetBadges = [
  '自动调用知识库片段',
  '支持多文件合并',
  '流程一次配置，多场景复用'
]

const exportOptions = [
  { id: 'pdf', label: '导出 PDF', description: '适合对外分享与存档' },
  { id: 'docx', label: '导出 Word', description: '后续可继续编辑调整内容' },
  { id: 'pptx', label: '导出 PPT', description: '自动生成可展示的视觉结构' }
]

const workflowStages = [
  {
    title: '1. 采集输入',
    detail: '上传文件 / 粘贴文本 / 选取知识库',
    decoration: '📥'
  },
  {
    title: '2. AI 适配',
    detail: '选择工具标签，设定策略与语调',
    decoration: '🧠'
  },
  {
    title: '3. 校对验证',
    detail: '对照原文校审，生成差异报告',
    decoration: '🕵️'
  },
  {
    title: '4. 导出协作',
    detail: '下载、生成分享链接或同步到画布',
    decoration: '🚀'
  }
]

const checklistItems = [
  '指派审核人，设置提醒时间',
  '同步到画布并建立引用关系',
  '添加节日营销或文化注释标签',
  '存档版本，保留多语言对照'
]

const referenceSources = [
  { name: '最新知识库节选', type: 'Knowledge Base', status: '已匹配 4 条', accent: '#818CF8' },
  { name: '市场营销话术模版', type: 'Template', status: 'AI 推荐', accent: '#F97316' },
  { name: 'Notes: 华北经销商访谈纪要', type: 'Notes', status: '可引用', accent: '#34D399' }
]

export default function CulturalToolsPage() {
  const [activeTag, setActiveTag] = useState<ToolTag>('language')
  const [inputText, setInputText] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [selectedExport, setSelectedExport] = useState<string>('pdf')

  const activeTool = useMemo(() => toolDefinitions[activeTag], [activeTag])

  return (
    <div className="flex flex-1 flex-col gap-8 bg-[#F4F5FF] px-8 py-6 text-slate-900">
      <section className="rounded-3xl border border-[#E1E5FF] bg-gradient-to-br from-white via-[#F7F8FF] to-white px-8 py-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[#6366F1]">Starlink Cultural Hub</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">跨文化智能工具工作台</h1>
            <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-slate-500">
              三大工具整合于单一视图：输入内容、挑选标签、配置策略，即可生成语言转换稿、跨文化对话脚本和专业报告初稿。
              支持批量导出并自动同步至知识库。
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#D9DCFF] bg-white/70 px-5 py-4 text-xs text-slate-600 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#4338CA]">
              <span className="text-2xl">⚡</span> 快速开始
            </div>
            <ul className="space-y-2">
              {presetBadges.map((badge) => (
                <li key={badge} className="flex items-center gap-2">
                  <span className="text-[#6366F1]">•</span>
                  <span>{badge}</span>
                </li>
              ))}
            </ul>
            <button className="rounded-full bg-gradient-to-r from-[#6366F1] to-[#7C3AED] px-4 py-1.5 text-xs font-semibold text-white shadow">
              创建自动流程
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {toolCards.map((card) => (
            <button
              key={card.id}
              onClick={() => setActiveTag(card.id)}
              className={clsx(
                'flex h-24 flex-col justify-between rounded-2xl border px-5 py-4 text-left transition shadow-sm',
                activeTag === card.id
                  ? 'border-[#C4C8FF] bg-white text-[#4338CA]'
                  : 'border-transparent bg-[#F5F6FF] text-slate-500 hover:border-[#E0E4FF]'
              )}
              type="button"
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>
                  {card.icon} {card.label}
                </span>
                <span className="text-[11px] text-slate-400">{card.description}</span>
              </div>
              <span className="text-[11px] text-slate-400">点击切换工具配置</span>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
            <header className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-slate-900">{activeTool.title}</h2>
              <p className="text-sm text-[#6366F1]">{activeTool.subtitle}</p>
              <p className="text-xs text-slate-500">{activeTool.description}</p>
            </header>

            <div className="mt-5 flex flex-wrap gap-2">
              {activeTool.presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSelectedPreset((prev) => (prev === preset ? null : preset))}
                  className={clsx(
                    'rounded-full border px-4 py-1.5 text-xs transition',
                    selectedPreset === preset
                      ? 'border-[#C4C8FF] bg-[#EEF0FF] text-[#4338CA]'
                      : 'border-[#E3E6FF] bg-[#F8F9FF] text-slate-500 hover:border-[#D6DAFF]'
                  )}
                  type="button"
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={activeTool.placeholders.input}
              className="mt-5 h-44 w-full rounded-2xl border border-[#D6DAFF] bg-[#FBFBFF] px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#6366F1] focus:outline-none"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <button className="rounded-full border border-[#C6CBFF] px-4 py-2 text-[#6366F1] transition hover:bg-[#EEF0FF]">
                {activeTool.cta}
              </button>
              <button className="rounded-full border border-[#E3E6FF] px-4 py-2 hover:bg-[#F6F7FF]">
                保存为工作流
              </button>
              <span>{selectedPreset ? `已选策略：${selectedPreset}` : '可从上方选择策略模板。'}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">流程节点</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {workflowStages.map((stage) => (
                <div
                  key={stage.title}
                  className="rounded-2xl border border-[#EEF0FF] bg-[#F9FAFF] px-4 py-3 text-xs text-slate-500"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{stage.decoration}</span>
                    <span className="font-medium text-slate-700">{stage.title}</span>
                  </div>
                  <p className="mt-2 leading-relaxed">{stage.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">参考资料与上下文</h3>
            <ul className="mt-4 space-y-3 text-xs text-slate-500">
              {referenceSources.map((source) => (
                <li
                  key={source.name}
                  className="flex items-center justify-between rounded-2xl border border-[#EEF0FF] bg-[#F9FAFF] px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{source.name}</p>
                    <p className="text-[11px] text-slate-400">{source.type}</p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-[11px] font-medium text-white"
                    style={{ backgroundColor: source.accent }}
                  >
                    {source.status}
                  </span>
                </li>
              ))}
            </ul>
            <button className="mt-4 w-full rounded-xl border border-dashed border-[#C6CBFF] px-4 py-2 text-xs text-[#6366F1] hover:bg-[#EEF0FF]">
              + 关联新的知识库资料
            </button>
          </div>

          <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">导出设置</h3>
            <p className="mt-2 text-xs text-slate-500">选择分发格式并附加可下载链接。</p>
            <div className="mt-4 space-y-3">
              {exportOptions.map((option) => (
                <label
                  key={option.id}
                  className={clsx(
                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-xs transition',
                    selectedExport === option.id
                      ? 'border-[#C4C8FF] bg-[#EEF0FF]'
                      : 'border-[#E4E7FF] bg-white hover:border-[#D6DAFF]'
                  )}
                >
                  <div>
                    <p className="font-medium text-slate-700">{option.label}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{option.description}</p>
                  </div>
                  <input
                    type="radio"
                    name="export"
                    value={option.id}
                    checked={selectedExport === option.id}
                    onChange={(event) => setSelectedExport(event.target.value)}
                    className="h-4 w-4 text-[#6366F1]"
                  />
                </label>
              ))}
            </div>
            <button className="mt-4 w-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#7C3AED] px-4 py-2 text-xs font-semibold text-white shadow">
              下载并分享
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">AI 输出预览</h3>
          <p className="mt-2 text-xs text-slate-500">
            运行后将在此显示分段结果，可按段落进行编辑、标记与版本对比。
          </p>
          <div className="mt-4 h-56 rounded-2xl border border-[#D6DAFF] bg-[#FBFBFF] px-4 py-3 text-xs text-slate-500">
            {activeTool.placeholders.output}
          </div>
          <div className="mt-3 flex gap-2 text-xs text-slate-500">
            <button className="rounded-full border border-[#E3E6FF] px-3 py-1 hover:bg-[#F6F7FF]">
              对比原文
            </button>
            <button className="rounded-full border border-[#E3E6FF] px-3 py-1 hover:bg-[#F6F7FF]">
              标记为重点
            </button>
            <button className="rounded-full border border-[#E3E6FF] px-3 py-1 hover:bg-[#F6F7FF]">
              同步至画布
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-[#E4E7FF] bg-white px-6 py-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">生成后待办</h3>
          <p className="mt-2 text-xs text-slate-500">完成输出后，可勾选以下事项保证交付质量。</p>
          <ul className="mt-4 space-y-2 text-xs text-slate-500">
            {checklistItems.map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[#EEF0FF] bg-[#F9FAFF] px-4 py-2"
              >
                <input type="checkbox" className="h-4 w-4 rounded border-[#D6DAFF] text-[#6366F1]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl border border-[#F0F2FF] bg-[#F8F9FF] px-4 py-3 text-[11px] text-slate-500">
            小提示：若需要持续追踪，可在画布内创建「跨文化运营」分支，让相关任务自动同步。
          </div>
        </div>
      </section>
    </div>
  )
}
