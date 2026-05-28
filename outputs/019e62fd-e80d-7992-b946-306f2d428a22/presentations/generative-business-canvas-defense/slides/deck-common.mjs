const ROOT = '/Users/qianyingtao/code/Starlink'
const WORK = `${ROOT}/outputs/019e62fd-e80d-7992-b946-306f2d428a22/presentations/generative-business-canvas-defense`
const FIG = `${ROOT}/docs/paper/figures`
const ASSET = `${WORK}/assets`

export const C = {
  bg: '#F6F1E8',
  bg2: '#EFE7D8',
  paper: '#FBF8F1',
  ink: '#161C24',
  muted: '#5E6673',
  line: '#D5CABC',
  dark: '#12161D',
  accent: '#0E87A6',
  accent2: '#C25532',
  green: '#4D7D5B',
  amber: '#C18B2D',
  violet: '#665C8E',
  white: '#FFFFFF',
}

const assets = {
  cover: `${ASSET}/image2-cover-background.png`,
  workflow: `${FIG}/fig1-1-workflow.png`,
  threePillar: `${FIG}/fig3-1-three-pillar.png`,
  arch: `${FIG}/fig4-0-5layer.png`,
  lifecycle: `${FIG}/fig4-0b-lifecycle-v2.png`,
  agents: `${FIG}/table3-1-agents-by-band.png`,
  coverage: `${FIG}/table3-2-coverage-matrix.png`,
  coverageCheck: `${FIG}/fig-startup-coverage-check.png`,
  supervisor: `${FIG}/fig3-5-supervisor.png`,
  debate: `${FIG}/fig3-6-debate.png`,
  citation: `${FIG}/fig3-7-citation-v2.png`,
  retrieval: `${FIG}/fig3-8-retrieval.png`,
  embedding: `${FIG}/table3-4-embedding-providers.png`,
  chatEntry: `${FIG}/screenshot-chat-entry.png`,
  wizard: `${FIG}/screenshot-wizard-7step.png`,
  knowledge: `${FIG}/screenshot-knowledge-upload.png`,
  canvasFree: `${FIG}/screenshot-canvas-freeform.png`,
  bmcGrid: `${FIG}/screenshot-bmc-grid-alt.png`,
  cardDetail: `${FIG}/screenshot-card-detail.png`,
  report: `${FIG}/screenshot-report-drawer.png`,
  memory: `${FIG}/screenshot-memory-panel.png`,
  dualMode: `${FIG}/screenshot-dual-mode.png`,
  stage: `${FIG}/screenshot-stage-strip.png`,
  timeline: `${FIG}/screenshot-timeline-event.png`,
  recallTable: `${FIG}/table3-6-recall-jitter.png`,
  aggregate: `${FIG}/table3-7-aggregate.png`,
  ablation: `${FIG}/fig3-10-ablation.png`,
}

export const slides = [
  {
    kind: 'cover',
    kicker: '本科毕业设计答辩',
    title: '基于多智能体协同的生成式商业画布系统',
    subtitle: 'Design and Implementation of a Generative Business Canvas System Based on Multi-Agent Collaboration',
    meta: ['学生：钱营涛', '指导老师：王琼', '软件工程（中外合作办学）', '2026年6月'],
  },
  {
    kind: 'agenda',
    kicker: '答辩主线',
    title: '从“九宫格生成”推进到“可追溯的画布工作流”。',
    sections: [
      ['01', '问题与目标', '单次生成难以保证九维覆盖、证据链和可修改过程。'],
      ['02', '方法设计', '用多智能体、共享黑板、混合检索和引用对象拆开问题。'],
      ['03', '系统实现', '把画布本身做成主交互界面，承载内容、证据和运行状态。'],
      ['04', '实验结论', '覆盖修复和混合检索提升结构稳定性，局限也明确。'],
    ],
  },
  {
    kind: 'problem',
    kicker: '研究背景',
    title: '早期商业想法不完整，商业画布需要的是协同分析而非一次性写作。',
    lead: '商业模式画布包含九个互相关联的维度，但创业者最初往往只提供产品想法。系统需要追问、检索、生成、校验和修改，而不是只返回一段文本。',
    problems: [
      ['输入缺口', '客户、收入、风险、验证路径常常缺失'],
      ['结构约束', '九个维度必须同时被覆盖和互相解释'],
      ['证据要求', '商业判断需要能回到材料和来源'],
      ['交互需求', '结果要能按单元检查、编辑和复用'],
    ],
  },
  {
    kind: 'comparison',
    kicker: '核心矛盾',
    title: '单次 LLM 调用把覆盖、证据和过程压进一个黑箱事务。',
    leftTitle: 'Single-call baseline',
    rightTitle: 'Starlink workflow',
    left: ['一个模板提示', '一次模型响应', '九格内容依赖注意力分配', '证据和过程不可检查'],
    right: ['预画布追问', '分工智能体', '黑板状态与覆盖检查', '结构化引用和可编辑画布'],
    claim: '本文的系统设计目标，是把“生成答案”改造成“生成可审计的商业分析工件”。',
  },
  {
    kind: 'contribution',
    kicker: '研究目标',
    title: 'Starlink 的贡献在于把 BMC 生成组织成可检查、可恢复、可交互的系统过程。',
    points: [
      ['渐进式构建', 'Ideation Coach 先补全上下文，再进入画布生成。'],
      ['多智能体分工', '市场、产品、财务等角色分别负责不同 BMC 维度。'],
      ['共享黑板与覆盖检查', '每轮扫描九个维度，缺失维度可被重新分派。'],
      ['双语混合检索', '语义检索与中文/英文词法匹配用 RRF 融合。'],
      ['画布即界面', '内容、引用、冲突、记忆和运行状态都在同一工作区中可见。'],
    ],
  },
  {
    kind: 'imageRight',
    kicker: '总体流程',
    title: 'Starlink 把一个想法推进成带证据、带状态、可修改的画布。',
    image: assets.workflow,
    bullets: [
      '单次 LLM 基线只输出一个完整响应，缺少中间状态。',
      'Starlink 将输入澄清、检索、智能体生成、审查和画布呈现拆成阶段。',
      '每个阶段都留下可检查的状态或引用对象，为后续修改提供入口。',
    ],
    caption: '图：论文 Figure 1-1 工作流对比',
  },
  {
    kind: 'imageLeft',
    kicker: '系统框架',
    title: '三支柱结构把推理、证据和界面分开治理。',
    image: assets.threePillar,
    bullets: [
      'Reasoning core：监督器、领域生成器、critic、synthesizer 和 utility agents。',
      'Retrieval layer：面向 agent 绑定的知识库检索，不是全局无差别注入。',
      'Canvas interface：每个画布单元成为可引用、可展开、可编辑的对象。',
    ],
    caption: '图：Starlink progressive canvas construction framework',
  },
  {
    kind: 'imageRight',
    kicker: '可部署架构',
    title: '五层架构让多智能体画布从研究原型落到可运行系统。',
    image: assets.arch,
    bullets: [
      'Frontend 负责画布工作区、引用交互、运行状态和浮层布局。',
      'GraphQL gateway 统一订阅、查询、鉴权和运行时事件。',
      'Reasoning、Knowledge、Persistence 分层，避免业务状态散落在模型响应中。',
      '共享类型库保证前后端契约一致。',
    ],
    caption: '图：论文 Figure 4-1 五层可部署架构',
  },
  {
    kind: 'twoImages',
    kicker: '预画布阶段',
    title: '生成前先补足上下文，降低“凭空补全”的风险。',
    images: [assets.knowledge, assets.wizard],
    labels: ['知识库上传与绑定', '七步 Ideation Coach'],
    bullets: [
      '知识库可来自文本种子、URL、文件和管理端 SQL。',
      'Coach 通过结构化问题补齐用户没有说清的客户、价值、成本和验证信息。',
      '两者都进入后续黑板和记忆层，成为生成时可复用的上下文。',
    ],
  },
  {
    kind: 'agents',
    kicker: '多智能体分工',
    title: '智能体数量不是重点，职责边界和能力绑定才是重点。',
    image: assets.agents,
    groups: [
      ['Market', '客户细分 / 渠道 / 客户关系'],
      ['Product', '价值主张 / 关键资源 / 关键活动 / 关键伙伴'],
      ['Finance', '收入来源 / 成本结构'],
      ['Review', '冲突检查 / 有限辩论 / 裁决'],
      ['Utility', '问答 / 深度研究 / 报告生成'],
    ],
  },
  {
    kind: 'imageLeft',
    kicker: '覆盖约束',
    title: '九个画布维度先有责任地图，再让模型生成。',
    image: assets.coverage,
    bullets: [
      '能力矩阵记录每个 agent 对每个 BMC 维度的 generate / validate / insight 绑定。',
      '启动时检查每个维度至少有一个生成责任主体。',
      '运行时扫描黑板中已填充的 cell，缺失项在有界轮次内重新分派。',
      '这不是保证内容正确，而是防止结构性遗漏被隐藏。',
    ],
    caption: '图：Table 3-2 capability coverage matrix',
  },
  {
    kind: 'flow',
    kicker: '共享黑板',
    title: '并行生成依靠黑板合并，而不是靠多轮聊天自然收敛。',
    nodes: [
      ['用户问题', 'question + workspace context'],
      ['SupervisorDispatch', '选择 active agents 与执行模式'],
      ['领域智能体', 'Market / Product / Finance 并行写入'],
      ['BlackboardUpdate', 'merge-by-identity 合并状态'],
      ['Critic + Synthesizer', '冲突、洞察、结构关系'],
      ['Canvas Persist', '持久化画布、引用和 trace'],
    ],
    note: '核心原则：所有状态变更通过统一 update primitive，列表字段按 id 合并，控制字段 last-write-wins。这样并行写入不会互相覆盖。'
  },
  {
    kind: 'imageRight',
    kicker: '调度与评审',
    title: '监督器先路由，再用有限评审处理严重跨维冲突。',
    image: assets.supervisor,
    bullets: [
      '画布生成首轮并行调用三个领域生成器。',
      '高严重度冲突会把 opponent 与 moderator 加入下一轮。',
      '评审循环有三轮上限，避免开放式多智能体对话失控。',
      '客户端同时收到 HITL interrupt，用户可接受、修订或忽略裁决。',
    ],
    caption: '图：Supervisor routing flowchart',
  },
  {
    kind: 'imageLeft',
    kicker: '引用溯源',
    title: '引用不是脚注，而是贯穿证据、智能体输出和画布单元的系统对象。',
    image: assets.citation,
    bullets: [
      '文档证据、结构关系、critic 冲突和 synthesizer insight 被区分为不同引用类型。',
      '用户可以从画布 claim 打开证据，也可以从证据反查引用它的所有画布单元。',
      'report-writer 额外用 unsupported marker 标明非检索推断。',
    ],
    caption: '图：Citation lifecycle',
  },
  {
    kind: 'imageRight',
    kicker: '双语混合检索',
    title: '检索层把语义质量和故障韧性分开设计。',
    image: assets.retrieval,
    bullets: [
      'Dense channel 使用嵌入向量处理语义相似度。',
      'Lexical channel 用 Unicode 类别分词：英文保留长度≥3词，中文用二元组。',
      'Reciprocal Rank Fusion 融合两路排序，避免分数标定依赖。',
      '当 embedding 服务降级时，词法通道仍能保留可用证据。',
    ],
    caption: '图：Hybrid retrieval pipeline',
  },
  {
    kind: 'process',
    kicker: '生成流水线',
    title: '画布生成的主路径是有界 DAG，只有评审是受控循环。',
    steps: [
      ['1', '组装状态', 'question / KB / memory / workspace'],
      ['2', '监督分派', 'classify intent and active agents'],
      ['3', '检索证据', 'bound KB top-K evidence'],
      ['4', '并行生成', 'market / product / finance'],
      ['5', '审查修复', 'critic + limited review'],
      ['6', '综合持久化', 'synthesizer + canvas update'],
    ],
    note: '答辩口径：系统的创新点不是“让很多 agent 聊天”，而是把固定结构工件的生成过程变成可检查状态机。'
  },
  {
    kind: 'imageRight',
    kicker: '主交互界面',
    title: '画布不只是结果展示，它承载覆盖、引用、冲突和修改入口。',
    image: assets.canvasFree,
    bullets: [
      '每个 BMC 维度是一个可展开、可编辑的 canvas cell。',
      '聊天、引用、单元详情、记忆和运行状态在同一工作区中浮动呈现。',
      '用户能从生成内容进入证据，也能从证据回到相关 cell。',
    ],
    caption: '图：Canvas viewport in freeform mode',
  },
  {
    kind: 'twoImages',
    kicker: '双模式画布',
    title: '同一批节点既能自由探索，也能收束成九宫格呈现。',
    images: [assets.dualMode, assets.bmcGrid],
    labels: ['Freeform / Grid 双模式', '完成后的九维 BMC 网格'],
    bullets: [
      '探索阶段允许自由排布和多候选比较。',
      '展示阶段切换到严格九格布局，让结构覆盖一眼可见。',
      '节点语义不变，只替换布局策略，避免在模式切换中丢失状态。',
    ],
  },
  {
    kind: 'twoImages',
    kicker: '输出复用',
    title: '报告和记忆让一次画布运行进入后续工作，而不是会话结束即消失。',
    images: [assets.report, assets.memory],
    labels: ['Report writer 输出八段战略报告', 'Memory panel 保留摘要、决策和 user-skill'],
    bullets: [
      '报告读取九个 cell、critic 日志、synthesizer insight 和引用证据。',
      '记忆按 session / workspace / user 作用域保存，配合 importance 与 confidence 衰减。',
      '用户可接受或拒绝推断出的 user-skill，形成后续 supervisor routing 的输入。',
    ],
  },
  {
    kind: 'observability',
    kicker: '运行可观测性',
    title: '用户和开发者都能看见系统慢在哪里、谁贡献了什么。',
    images: [assets.stage, assets.timeline],
    bullets: [
      'Mention 层：用户交互是否触发预期能力。',
      'Subgraph 层：各 agent 调用、耗时和错误率。',
      'Tool 层：每个声明能力对应的工具调用流。',
      'Stage strip：input / generate / review / synthesize / report 五阶段状态。',
    ],
  },
  {
    kind: 'evaluation',
    kicker: '实验设计',
    title: '评价聚焦可度量机制：九维覆盖、检索韧性和机制消融。',
    cards: [
      ['12 个 YC 案例', 'Stripe、Airbnb、Replit、Notion、Coinbase 等，用公开材料构造 ground-truth BMC。'],
      ['0-27 分 rubric', '每个 BMC 维度 0-3 分，衡量 must-cover concept presence。'],
      ['两类后端', '强模型 DeepSeek-V3 与中能力 MiniMax-M2.5，观察覆盖修复在不同能力层的作用。'],
      ['检索压力测试', '健康 embedding 与强制 local-hash fallback 的 recall@5 对比。'],
    ],
  },
  {
    kind: 'retrievalResult',
    kicker: '检索结果',
    title: 'Embedding 降级时，混合检索保留了更多可用证据。',
    image: assets.recallTable,
    metric: ['+28.4%', 'Recall@5 uplift under forced dense-channel degradation'],
    bullets: [
      '健康状态下 dense channel 已饱和，Top-1 正确率达到 100%，混合检索没有显著空间增加质量。',
      '强制降级后，纯向量召回下降，词法通道保留中文/英文关键词命中。',
      '结论：混合检索主要是可靠性机制，不是常态质量提升技巧。',
    ],
  },
  {
    kind: 'bars',
    kicker: '质量对比',
    title: '覆盖检查在中能力模型上放大优势，在强模型上主要修复结构遗漏。',
    bars: [
      ['DeepSeek-V3 单次 LLM', 20.2, C.muted],
      ['DeepSeek-V3 Starlink', 20.8, C.accent],
      ['MiniMax-M2.5 单次 LLM', 15.2, C.muted],
      ['MiniMax-M2.5 Starlink', 22.0, C.accent2],
    ],
    bullets: [
      '强模型上均分只提升 +0.6，但 baseline 的 Key Partnerships 在 12/12 案例中为空。',
      '中能力模型上均分提升 +6.8，并取得 8/12 case-wise wins。',
      '解释：覆盖检查不是质量魔法，而是恢复低显著维度的结构保险。'
    ],
    image: assets.aggregate,
  },
  {
    kind: 'imageRight',
    kicker: '机制消融',
    title: '当前 rubric 下，检索 grounding 是最明确的可测驱动。',
    image: assets.ablation,
    bullets: [
      '移除 RAG 后，均值从 21.83 降到 21.17，worst-case 也下降。',
      '单独移除 critic 或 debate 对 must-cover rubric 影响不明显。',
      '这不说明评审无用，而是当前 benchmark 没有直接测跨维冲突发现。',
      '下一步需要 conflict-injection benchmark 来评价 review loop。',
    ],
    caption: '图：五条件机制消融',
  },
  {
    kind: 'closing',
    kicker: '结论与展望',
    title: 'Starlink 证明了：生成式商业画布可以被做成可审计的系统工件。',
    conclusions: [
      ['系统结论', '十二个专门智能体、监督分派、共享黑板、混合检索和引用对象共同支撑渐进式 BMC 构建。'],
      ['实验结论', '覆盖检查稳定修复低显著维度；混合检索在 embedding 降级时保留更多证据。'],
      ['主要局限', '样本主要来自软件/SaaS/金融科技；单一 judge；用户研究规模小；流式粒度仍是 section-level。'],
      ['后续工作', 'partial jitter、冲突注入、跨模型族复现、多语种检索、在线 agent 重配置和偏好蒸馏。'],
    ],
  },
]

function bg(slide, ctx, dark = false) {
  ctx.addShape(slide, {
    x: 0,
    y: 0,
    w: ctx.W,
    h: ctx.H,
    fill: dark ? C.dark : C.bg,
    line: ctx.line('#00000000', 0),
  })
}

function txt(slide, ctx, text, x, y, w, h, opts = {}) {
  return ctx.addText(slide, {
    text,
    x,
    y,
    w,
    h,
    size: opts.size ?? 20,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    typeface: opts.face ?? 'PingFang SC',
    align: opts.align ?? 'left',
    valign: opts.valign ?? 'top',
    fill: opts.fill ?? '#00000000',
    line: opts.line ?? ctx.line('#00000000', 0),
    insets: opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 },
    name: opts.name,
  })
}

function rect(slide, ctx, x, y, w, h, fill, line = C.line, name) {
  return ctx.addShape(slide, {
    x,
    y,
    w,
    h,
    fill,
    line: ctx.line(line, line === '#00000000' ? 0 : 1),
    name,
  })
}

function marker(slide, ctx, x, y, color = C.accent) {
  rect(slide, ctx, x, y + 6, 24, 2, color, '#00000000', 'kicker-marker')
}

function header(slide, ctx, spec, dark = false, titleSize = 34) {
  marker(slide, ctx, 64, 34, dark ? C.accent2 : C.accent)
  txt(slide, ctx, spec.kicker || '', 96, 24, 420, 24, {
    size: 12,
    bold: true,
    color: dark ? '#E6DCCC' : C.accent,
    name: 'kicker-label',
    valign: 'middle',
  })
  txt(slide, ctx, spec.title, 64, 58, 1060, 88, {
    size: titleSize,
    bold: true,
    color: dark ? C.white : C.ink,
    face: 'PingFang SC',
  })
}

function footer(slide, ctx, n) {
  txt(slide, ctx, 'Starlink · Generative Business Canvas System', 64, 684, 520, 16, {
    size: 9,
    color: C.muted,
  })
  txt(slide, ctx, String(n).padStart(2, '0'), 1170, 678, 46, 22, {
    size: 12,
    color: C.muted,
    align: 'right',
    face: 'Aptos Mono',
  })
}

function bulletList(slide, ctx, items, x, y, w, opts = {}) {
  const gap = opts.gap ?? 48
  items.forEach((item, i) => {
    const top = y + i * gap
    rect(slide, ctx, x, top + 8, 8, 8, opts.color ?? C.accent, '#00000000')
    txt(slide, ctx, item, x + 22, top, w - 22, gap - 4, {
      size: opts.size ?? 20,
      color: opts.textColor ?? C.ink,
      face: 'PingFang SC',
    })
  })
}

async function framedImage(slide, ctx, image, x, y, w, h, caption) {
  rect(slide, ctx, x - 12, y - 12, w + 24, h + 24, C.paper, C.line)
  await ctx.addImage(slide, { path: image, x, y, w, h, fit: 'contain', alt: caption || 'figure' })
  if (caption) {
    txt(slide, ctx, caption, x, y + h + 15, w, 18, { size: 10, color: C.muted })
  }
}

function metric(slide, ctx, value, label, x, y, w, color = C.accent) {
  rect(slide, ctx, x, y, w, 112, C.dark, '#00000000')
  txt(slide, ctx, value, x + 20, y + 14, w - 40, 48, { size: 42, bold: true, color, face: 'Aptos Display' })
  txt(slide, ctx, label, x + 22, y + 70, w - 44, 28, { size: 14, color: '#DAD2C4' })
}

function sectionCard(slide, ctx, num, title, body, x, y, w, h, color) {
  rect(slide, ctx, x, y, w, h, C.paper, C.line)
  txt(slide, ctx, num, x + 20, y + 20, 54, 32, { size: 24, bold: true, color, face: 'Aptos Mono' })
  txt(slide, ctx, title, x + 82, y + 20, w - 104, 30, { size: 22, bold: true, color: C.ink })
  txt(slide, ctx, body, x + 82, y + 58, w - 104, h - 76, { size: 16, color: C.muted })
}

async function renderCover(slide, ctx, spec) {
  await ctx.addImage(slide, { path: assets.cover, x: 0, y: 0, w: ctx.W, h: ctx.H, fit: 'cover', alt: 'image2.0 cover background' })
  rect(slide, ctx, 0, 0, 536, ctx.H, '#F8F4ECAA', '#00000000')
  marker(slide, ctx, 70, 62, C.accent)
  txt(slide, ctx, spec.kicker, 102, 52, 260, 26, { size: 13, bold: true, color: C.accent, valign: 'middle' })
  txt(slide, ctx, spec.title, 70, 130, 520, 148, { size: 42, bold: true, color: C.ink })
  txt(slide, ctx, spec.subtitle, 72, 306, 490, 72, { size: 17, color: C.muted, face: 'Aptos' })
  rect(slide, ctx, 72, 414, 354, 1, C.line, '#00000000')
  spec.meta.forEach((m, i) => txt(slide, ctx, m, 72, 442 + i * 34, 360, 24, { size: 17, color: C.ink }))
}

async function renderAgenda(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec)
  const colors = [C.accent, C.green, C.amber, C.accent2]
  spec.sections.forEach((s, i) => {
    const x = 86 + i * 292
    rect(slide, ctx, x, 214, 218, 3, colors[i], '#00000000')
    txt(slide, ctx, s[0], x, 238, 70, 54, { size: 40, bold: true, color: colors[i], face: 'Aptos Display' })
    txt(slide, ctx, s[1], x, 310, 200, 34, { size: 24, bold: true })
    txt(slide, ctx, s[2], x, 360, 210, 122, { size: 17, color: C.muted })
  })
  rect(slide, ctx, 88, 554, 1104, 1, C.line, '#00000000')
}

async function renderProblem(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 32)
  txt(slide, ctx, spec.lead, 72, 170, 486, 118, { size: 22, color: C.ink })
  const coords = [[634, 180], [910, 180], [634, 396], [910, 396]]
  spec.problems.forEach((p, i) => {
    const [x, y] = coords[i]
    rect(slide, ctx, x, y, 224, 138, C.paper, C.line)
    txt(slide, ctx, `0${i + 1}`, x + 18, y + 18, 48, 30, { size: 20, bold: true, color: [C.accent, C.green, C.amber, C.accent2][i], face: 'Aptos Mono' })
    txt(slide, ctx, p[0], x + 18, y + 56, 180, 28, { size: 21, bold: true })
    txt(slide, ctx, p[1], x + 18, y + 90, 184, 34, { size: 15, color: C.muted })
  })
  txt(slide, ctx, '固定结构 + 不完整输入 + 证据要求 = 需要系统化协同，而不是单次补全文本。', 72, 520, 500, 64, { size: 26, bold: true, color: C.accent2 })
}

async function renderComparison(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec)
  const y = 188
  rect(slide, ctx, 76, y, 496, 332, '#EEE6D7', C.line)
  rect(slide, ctx, 708, y, 496, 332, C.paper, C.line)
  txt(slide, ctx, spec.leftTitle, 104, y + 28, 420, 34, { size: 26, bold: true, color: C.muted })
  txt(slide, ctx, spec.rightTitle, 736, y + 28, 420, 34, { size: 26, bold: true, color: C.accent })
  bulletList(slide, ctx, spec.left, 108, y + 86, 390, { gap: 48, color: C.muted, size: 18 })
  bulletList(slide, ctx, spec.right, 740, y + 86, 390, { gap: 48, color: C.accent, size: 18 })
  txt(slide, ctx, '→', 606, 318, 60, 54, { size: 44, color: C.accent2, align: 'center', face: 'Aptos Display' })
  rect(slide, ctx, 150, 574, 980, 52, C.dark, '#00000000')
  txt(slide, ctx, spec.claim, 178, 588, 922, 26, { size: 20, bold: true, color: C.white, valign: 'middle' })
}

async function renderContribution(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  spec.points.forEach((p, i) => {
    const x = i < 3 ? 80 + i * 372 : 268 + (i - 3) * 372
    const y = i < 3 ? 198 : 428
    rect(slide, ctx, x, y, 310, 148, C.paper, C.line)
    txt(slide, ctx, `0${i + 1}`, x + 18, y + 18, 42, 28, { size: 19, bold: true, color: [C.accent, C.green, C.amber, C.violet, C.accent2][i], face: 'Aptos Mono' })
    txt(slide, ctx, p[0], x + 66, y + 18, 218, 28, { size: 20, bold: true })
    txt(slide, ctx, p[1], x + 24, y + 64, 260, 60, { size: 15, color: C.muted })
  })
}

async function renderImageRight(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  bulletList(slide, ctx, spec.bullets, 72, 190, 452, { gap: 58, size: 19, color: C.accent })
  await framedImage(slide, ctx, spec.image, 594, 170, 568, 398, spec.caption)
}

async function renderImageLeft(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  await framedImage(slide, ctx, spec.image, 76, 172, 560, 396, spec.caption)
  bulletList(slide, ctx, spec.bullets, 704, 190, 440, { gap: 55, size: 18, color: C.accent2 })
}

async function renderTwoImages(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  await framedImage(slide, ctx, spec.images[0], 78, 174, 492, 276)
  await framedImage(slide, ctx, spec.images[1], 710, 174, 492, 276)
  txt(slide, ctx, spec.labels[0], 78, 474, 492, 24, { size: 15, bold: true, color: C.accent })
  txt(slide, ctx, spec.labels[1], 710, 474, 492, 24, { size: 15, bold: true, color: C.accent2 })
  bulletList(slide, ctx, spec.bullets, 160, 542, 938, { gap: 30, size: 16, color: C.green })
}

async function renderAgents(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  await framedImage(slide, ctx, spec.image, 70, 170, 602, 378)
  spec.groups.forEach((g, i) => {
    const y = 176 + i * 76
    rect(slide, ctx, 740, y, 368, 54, i === 3 ? '#F3E2D9' : C.paper, C.line)
    txt(slide, ctx, g[0], 762, y + 10, 102, 24, { size: 18, bold: true, color: [C.accent, C.green, C.amber, C.accent2, C.violet][i], face: 'Aptos Display' })
    txt(slide, ctx, g[1], 876, y + 12, 210, 22, { size: 15, color: C.ink })
  })
  txt(slide, ctx, '答辩强调：agent 是职责边界，不是“越多越聪明”。', 742, 584, 374, 42, { size: 20, bold: true, color: C.accent2 })
}

async function renderFlow(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  const coords = [[70, 202], [432, 202], [794, 202], [70, 404], [432, 404], [794, 404]]
  spec.nodes.forEach((n, i) => {
    const [x, y] = coords[i]
    rect(slide, ctx, x, y, 300, 118, C.paper, C.line)
    txt(slide, ctx, n[0], x + 20, y + 18, 250, 28, { size: 21, bold: true, color: i % 2 ? C.accent2 : C.accent })
    txt(slide, ctx, n[1], x + 20, y + 58, 250, 36, { size: 15, color: C.muted, face: 'Aptos' })
    if (i === 0 || i === 1 || i === 3 || i === 4) {
      txt(slide, ctx, '→', x + 316, y + 38, 42, 42, { size: 34, color: C.line, align: 'center', face: 'Aptos Display' })
    }
  })
  txt(slide, ctx, spec.note, 106, 586, 1040, 52, { size: 17, color: C.ink, bold: true })
}

async function renderProcess(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  spec.steps.forEach((s, i) => {
    const x = 78 + i * 190
    rect(slide, ctx, x, 210, 150, 186, C.paper, C.line)
    txt(slide, ctx, s[0], x + 18, 230, 52, 44, { size: 34, bold: true, color: [C.accent, C.green, C.amber, C.accent2, C.violet, C.accent][i], face: 'Aptos Display' })
    txt(slide, ctx, s[1], x + 18, 286, 114, 34, { size: 18, bold: true })
    txt(slide, ctx, s[2], x + 18, 334, 112, 42, { size: 12, color: C.muted, face: 'Aptos' })
    if (i < spec.steps.length - 1) txt(slide, ctx, '→', x + 158, 282, 28, 32, { size: 24, color: C.line, align: 'center' })
  })
  rect(slide, ctx, 160, 500, 960, 64, C.dark, '#00000000')
  txt(slide, ctx, spec.note, 188, 516, 900, 30, { size: 19, bold: true, color: C.white, valign: 'middle' })
}

async function renderObservability(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  await framedImage(slide, ctx, spec.images[0], 74, 174, 560, 240)
  await framedImage(slide, ctx, spec.images[1], 74, 476, 560, 94)
  bulletList(slide, ctx, spec.bullets, 716, 188, 410, { gap: 52, size: 18, color: C.accent })
}

async function renderEvaluation(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  const coords = [[86, 200], [662, 200], [86, 404], [662, 404]]
  spec.cards.forEach((c, i) => {
    const [x, y] = coords[i]
    sectionCard(slide, ctx, `0${i + 1}`, c[0], c[1], x, y, 476, 132, [C.accent, C.green, C.amber, C.accent2][i])
  })
}

async function renderRetrievalResult(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  metric(slide, ctx, spec.metric[0], spec.metric[1], 76, 180, 340, C.accent2)
  bulletList(slide, ctx, spec.bullets, 76, 326, 460, { gap: 52, size: 17, color: C.accent })
  await framedImage(slide, ctx, spec.image, 642, 214, 440, 204, 'Table 3-5：degraded embedding 条件下的 recall@5')
}

async function renderBars(slide, ctx, spec) {
  bg(slide, ctx)
  header(slide, ctx, spec, false, 31)
  const max = 27
  const x = 104
  const y0 = 210
  spec.bars.forEach((b, i) => {
    const y = y0 + i * 68
    txt(slide, ctx, b[0], x, y + 4, 250, 24, { size: 15, color: C.ink })
    rect(slide, ctx, x + 270, y, 392, 28, '#E8DED0', '#00000000')
    rect(slide, ctx, x + 270, y, 392 * (b[1] / max), 28, b[2], '#00000000')
    txt(slide, ctx, String(b[1].toFixed(1)), x + 682, y + 1, 70, 26, { size: 18, bold: true, color: b[2], face: 'Aptos Mono' })
  })
  bulletList(slide, ctx, spec.bullets, 126, 520, 730, { gap: 30, size: 16, color: C.accent2 })
  await framedImage(slide, ctx, spec.image, 896, 214, 266, 134, 'Table 3-6 摘要')
}

async function renderClosing(slide, ctx, spec) {
  bg(slide, ctx, true)
  header(slide, ctx, spec, true, 33)
  spec.conclusions.forEach((c, i) => {
    const x = i < 2 ? 84 + i * 560 : 84 + (i - 2) * 560
    const y = i < 2 ? 204 : 424
    rect(slide, ctx, x, y, 496, 142, i === 0 ? '#1B2630' : '#181D25', i === 3 ? C.accent2 : '#2E3744')
    txt(slide, ctx, c[0], x + 24, y + 22, 160, 28, { size: 20, bold: true, color: [C.accent, C.green, C.amber, C.accent2][i] })
    txt(slide, ctx, c[1], x + 24, y + 62, 430, 54, { size: 16, color: '#E9E0D0' })
  })
  txt(slide, ctx, 'Q&A', 1088, 608, 96, 42, { size: 28, bold: true, color: C.accent2, align: 'right', face: 'Aptos Display' })
}

export async function renderSlide(presentation, ctx, index) {
  const spec = slides[index - 1]
  const slide = presentation.slides.add()
  if (spec.kind === 'cover') await renderCover(slide, ctx, spec)
  else if (spec.kind === 'agenda') await renderAgenda(slide, ctx, spec)
  else if (spec.kind === 'problem') await renderProblem(slide, ctx, spec)
  else if (spec.kind === 'comparison') await renderComparison(slide, ctx, spec)
  else if (spec.kind === 'contribution') await renderContribution(slide, ctx, spec)
  else if (spec.kind === 'imageRight') await renderImageRight(slide, ctx, spec)
  else if (spec.kind === 'imageLeft') await renderImageLeft(slide, ctx, spec)
  else if (spec.kind === 'twoImages') await renderTwoImages(slide, ctx, spec)
  else if (spec.kind === 'agents') await renderAgents(slide, ctx, spec)
  else if (spec.kind === 'flow') await renderFlow(slide, ctx, spec)
  else if (spec.kind === 'process') await renderProcess(slide, ctx, spec)
  else if (spec.kind === 'observability') await renderObservability(slide, ctx, spec)
  else if (spec.kind === 'evaluation') await renderEvaluation(slide, ctx, spec)
  else if (spec.kind === 'retrievalResult') await renderRetrievalResult(slide, ctx, spec)
  else if (spec.kind === 'bars') await renderBars(slide, ctx, spec)
  else if (spec.kind === 'closing') await renderClosing(slide, ctx, spec)
  else throw new Error(`Unknown slide kind: ${spec.kind}`)
  if (spec.kind !== 'cover') footer(slide, ctx, index)
  return slide
}
