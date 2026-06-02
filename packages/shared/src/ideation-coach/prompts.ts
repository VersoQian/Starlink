/**
 * Ideation Coach prompt templates (Wave F.2).
 *
 * The system prompt + user message builder. Identical wording across
 * Next.js REST route and the Apollo GraphQL resolver — single source of
 * truth.
 *
 * Lifted from `apps/web/app/api/ideation/reflect/route.ts` so both
 * runtimes consume the same string. If you tweak the prompt here, both
 * the REST and GraphQL paths see the change.
 */

import type { ReflectionRequest } from './schemas.js'
import { COACH_CONTENT_MAX_CHARS } from './schemas.js'
import {
  COACH_DEFLECTION_HINT_THRESHOLD,
  shouldHintCoachDeflection
} from './policy.js'

// =============================================================================
// Dimension coverage heatmap
// =============================================================================

/**
 * Each dimension has a `key` (the heatmap bucket name), a `label` (human
 * name), and `patterns` — substring arrays to match in chat/canvas text
 * (case-insensitive). The 9 BMC dimensions derive from the BMC domain
 * model; the pre-BMC entries cover the 7-step wizard. Revenue is already
 * represented by the BMC `revenue-streams` bucket.
 */
export const DIMENSION_KEYWORDS: Array<{
  key: string
  label: string
  patterns: string[]
}> = [
    // ── BMC 9 dimensions ──
    {
      key: 'customer-segments',
      label: '客户细分',
      patterns: ['客户细分', '客户群', '目标用户', '用户画像', '细分', 'target customer', 'ICP', 'ideal customer', '目标客户', '消费者', 'B2B', 'B2C', 'SMB', 'mid-market', 'enterprise', '用户类型', '客群'],
    },
    {
      key: 'value-proposition',
      label: '价值主张',
      patterns: ['价值主张', '价值定位', 'value prop', 'unique value', '核心价值', '差异化', '竞争壁垒', '护城河', 'USP', 'unique selling', '为什么是你', '为什么选你', '解决什么', '定位', '价值点'],
    },
    {
      key: 'channels',
      label: '渠道通路',
      patterns: ['渠道通路', '渠道', '通路', 'channel', '分销', '获客渠道', '线上', '线下', '直销', '代理商', '经销商', '平台', '广告投放', 'SEO', 'SEM', '引流', '触达', '推广方式'],
    },
    {
      key: 'customer-relationships',
      label: '客户关系',
      patterns: ['客户关系', 'customer rel', '粘性', '留存', '复购', '续费率', 'NPS', '净推荐值', '客服', '售后', '社区', '会员', '订阅', '忠诚度', '流失', 'churn', 'LTV', '用户生命周期'],
    },
    {
      key: 'revenue-streams',
      label: '收入来源',
      patterns: ['收入来源', '营收', '收入', 'revenue', '定价', '定价策略', '付费', '抽成', '佣金', '广告收入', 'license', 'SaaS', '一次性', '年费', '月费', 'freemium', '免费增值', 'ARR', 'MRR', '客单价'],
    },
    {
      key: 'key-resources',
      label: '核心资源',
      patterns: ['核心资源', 'key resource', '资产', '技术壁垒', '专利', 'IP', '域名', '数据', '人才', '团队', '供应链', '生产能力', '品牌', '用户基础', '独家', '牌照', '资质'],
    },
    {
      key: 'key-activities',
      label: '关键业务',
      patterns: ['关键业务', 'key activ', '日常运营', '核心流程', '生产', '研发', '开发', '交付', '运营', '维护', '迭代', '内容生产', '营销', '销售', 'BD', '商务拓展', '招聘', '融资', '路演'],
    },
    {
      key: 'key-partnerships',
      label: '重要合作',
      patterns: ['重要合作', '合作', '伙伴', 'partner', '战略合作', '联盟', '供应商', '外包', '代工厂', '渠道合作', '技术合作', '联合', '生态', '上下游', '绑定', '独家合作', '互补'],
    },
    {
      key: 'cost-structure',
      label: '成本结构',
      patterns: ['成本结构', '成本', 'cost', '固定成本', '可变成本', '烧钱', '利润率', '毛利', 'gross margin', '单位经济', 'unit eco', 'CAC', '获客成本', 'ROI', '回报周期', '盈亏', 'break even', '现金流', '预算', '资金'],
    },
    // ── Ideation dimensions (pre-BMC 7-step wizard) ──
    {
      key: 'core-idea',
      label: '核心想法',
      patterns: ['核心想法', '创意', '点子', '想法', 'core idea', '概念', '做什么', '产品', '服务', 'solution'],
    },
    {
      key: 'customer-pain',
      label: '客户痛点',
      patterns: ['痛点', 'paint point', '问题', '需求', '困扰', '不便', '低效', '浪费', '想要', '期望'],
    },
    {
      key: 'value-angle',
      label: '价值切入',
      patterns: ['价值切入', '价值角度', '独特价值', '为什么是你', 'value angle', '差异点', '替代方案', '更好在哪里'],
    },
    {
      key: 'hypothesis',
      label: '假设与验证',
      patterns: ['假设', '验证', 'hypothesis', '实验', 'AB test', 'A/B', '可证伪', 'falsifiable', '猜测', '推测', '测试', '数据验证', '访谈'],
    },
    {
      key: 'validation-channel',
      label: '验证路径',
      patterns: ['验证路径', '验证渠道', 'validation channel', 'MVP', '最小可行', '落地页', '问卷', '访谈', '试点', '灰度', '验证方式'],
    },
    {
      key: 'risk',
      label: '风险与竞争',
      patterns: ['风险', 'risk', '失败', '竞品', '竞争', '竞争对手', '政策', '法规', '合规', '监管', '市场变化', '技术变化', '团队风险'],
    },
    {
      key: 'evidence',
      label: '一手证据',
      patterns: ['证据', 'evidence', '数据', 'data', '调研', '调查', '报告', '统计', '客户访谈', '一手资料', '二手资料', '来源', '引用'],
    },
  ]

/**
 * Scan recent chat + canvas text for dimension keyword hits.
 * Returns Record<dimensionKey, matchCount> ordered from least- to
 * most-covered so the prompt builder can sort naturally.
 *
 * Chat text: each message contributes once per dimension if any keyword
 * matches (prevents one rambling message from distorting the heatmap).
 * Canvas text: each node label/content contributes once per dimension.
 *
 * Dimensions with count=0 are "unexplored" — the coach is instructed to
 * prioritise these.
 */
export function computeDimensionCoverage(
  recentChat: Array<{ role: string; content: string }>,
  canvasLabels: string[]
): Record<string, number> {
  const coverage: Record<string, number> = {}
  for (const dim of DIMENSION_KEYWORDS) {
    let count = 0
    const lowerPatterns = dim.patterns.map((p) => p.toLowerCase())

    // Chat: count messages that hit any keyword (cap at 1 per message)
    for (const msg of recentChat) {
      const lower = msg.content.toLowerCase()
      if (lowerPatterns.some((p) => lower.includes(p))) {
        count += 1
      }
    }

    // Canvas: count nodes that hit any keyword (cap at 1 per node)
    for (const label of canvasLabels) {
      const lower = label.toLowerCase()
      if (lowerPatterns.some((p) => lower.includes(p))) {
        count += 1
      }
    }

    coverage[dim.key] = count
  }
  return coverage
}

/**
 * Coach system prompt (Meflex philosophy).
 *
 * Must be in English for stable JSON-mode output across providers.
 * The user-facing answer the LLM produces is in Chinese (zh-CN), but
 * the system instructions live in English to keep DeepSeek's JSON mode
 * stable.
 */
export const COACH_SYSTEM_PROMPT = `You are a entrepreneurship coach for the Starlink Ideation Canvas.

CRITICAL ROLE BOUNDARIES :
1. You ask ONE focused reflection question per response — but that question
   MUST build on the user's previous answer, NOT restart from scratch.
   Acknowledge what they said, then drill deeper.
2. You scaffold the user's thinking; you DO NOT replace it.
3. You DO NOT propose specific node content, copy, or answers.
4. Output is in 中文 (zh-CN), 2–3 substantive paragraphs, Markdown allowed
   for *emphasis*. You have up to ${COACH_CONTENT_MAX_CHARS} chars (~250-300 汉字) —
   use the space to acknowledge their previous answer, then ask a deepening
   follow-up.

PICK ONE SCAFFOLD KIND for each response:
- "why"             — challenge the user's reasoning / surface assumptions
- "how"             — push them on cheap validation / mechanics
- "so-what"         — surface implications / falsifiability / consequences
- "evidence-needed" — flag missing first-hand evidence
- "meta"            — cross-node observation about coverage gaps

DEPTH-FIRST THEN BREADTH (depth ladder):
Do NOT treat each question as a fresh start. When the user answers a
question about a topic, your NEXT question should CLIMB ONE RUNG on the
SAME dimension before rotating to a new one. Follow this ladder:

  1. SURFACE    — "what" / "which" — clarify the raw claim
  2. SPECIFICS  — "how exactly" / "who specifically" / "when" / "at what scale"
  3. EVIDENCE   — "what data / experience / observable facts support this?"
  4. IMPLICATIONS — "so what?" / "what changes if you're wrong?" / second-order effects
  5. CONNECTIONS — "how does this relate to dimension Y?" (bridge to NEW dimension)

Each round, climb ONE rung. If the user gives a vague answer, go DOWN one
rung ("help me be more specific") rather than sideways to a new dimension.
Skip rungs only when the user voluntarily provides that level of detail.

DIMENSION ROTATION RULES:
- Stay on the SAME dimension for at most 3 rounds of deepening.
- After 3 rounds (or when the dimension feels exhausted), ROTATE to a
  different dimension. EXPLICITLY bridge: "刚才我们聊了 X，那 Y 方面呢？
  这两者其实有联系..." — connect the old dimension to the new one.
- Prefer dimensions with ZERO coverage in the ## 维度覆盖图 section.
- ANTI-JUMPING: if the user just answered a question about revenue, do NOT
  jump to an unrelated topic like partnerships — drill deeper on revenue first.

DEFLECTION DETECTION & ANTI-HAMMERING (P15.6 · highest priority):
Users sometimes give very short or off-topic answers when they're not ready
to engage with a particular line of questioning. You MUST detect this and
adapt immediately — do NOT keep asking the same thing.

1. SHORT-ANSWER DETECTION: If the user's last response is < ${COACH_DEFLECTION_HINT_THRESHOLD} Chinese
   characters OR clearly doesn't address the substance of your question,
   treat it as DEFLECTION. Examples: "没有", "还行", "站得住脚", "听起来不做",
   "你帮我生成提纲", "我打算这周谨行恶事" (changing the subject entirely).

2. ON DEFLECTION: Do NOT re-ask the same question or rephrase it. Acknowledge
   in ≤1 short sentence and immediately PIVOT to a DIFFERENT, SPECIFIC dimension.
   **禁止套话**：不要说"我们换个角度"、"你目前最不确定的是哪个方面"、
   "有没有没聊到但你觉得重要的点"这类泛泛的开放问题。
   **正确做法**：从 ⚠ 未探索维度中挑一个，给出 2-3 个具体选项让用户选。
   示例："好，先不聊痛点。说获客：你觉得第一个客户会从哪来？社区居委介绍、
   医院候诊搭话、还是子女微信群？"
   Your response should be SHORTER than normal (1 paragraph) — don't write
   2-3 paragraphs when the user is clearly disengaged.

3. ANTI-HAMMERING (硬限制): You may ask about the SAME concrete topic at
   most TWICE (once with one scaffold, once with a different scaffold for
   follow-up). After two attempts on the same topic, if the user hasn't
   engaged substantively, you MUST pivot to a completely different
   dimension. Never cycle back to a topic the user has already deflected
   on twice — even if you switch scaffolds. Example: if you asked about
   "水果配送定价" with scaffold='evidence-needed' and got deflection, then
   asked again with scaffold='why' and got deflection again, the third
   question MUST be about something totally different (e.g., "客户细分" or
   "渠道通路"), NOT another angle on pricing.

4. GRACEFUL CLOSURE: When the user says things like "站得住脚", "没问题",
   "就这样", "我觉得可以", "这个方向没问题" — these often signal
   satisfaction/closure, not deflection. Accept it briefly ("好的，这个方向
   先确认下来") and BRIDGE to a new dimension: "那 [新维度] 方面你考虑过吗？
   这两者其实有联系..."

5. TOPIC TRACKING: In your internal reasoning (not shown to user), track
   which concrete topics you've already asked about. If you asked about
   topic X twice and got deflections both times, the third question MUST
   be on a completely different subject — pick from ⚠ 未探索 dimensions.
   Do NOT cycle back to X later in the conversation.

IDEATION_NODE_KIND vocabulary (you'll see these in the canvas snapshot):
- Pre-BMC ideation kinds (wizard 7-step):
  core-idea, customer-pain, value-angle, hypothesis, validation-channel, revenue, risk, evidence, reflection.
- BMC kinds (post-graduation, generated by multi-agent pipeline):
  cc-bmc-card, agent-avatar, insight-note, conflict-alert, data-source, report-card.

CRITICAL · BMC IS THE CANVAS:
Once cc-bmc-card kind nodes appear (any count > 0), the canvas is NOT
"empty". DO NOT say "画布完全空白" or "你已多次表达想法但画布仍为空".
The user has already graduated from ideation to BMC. Your role shifts
from "explore more" to "examine the BMC critically": ask probing
questions about specific BMC cells (use scaffold='why' or
'evidence-needed' on a chosen cell), or suggest @critic / @synthesizer
mentions for cross-cell analysis. NEVER suggest /wizard if BMC cells exist.

USING THE USER'S LONG-TERM PROFILE (when present):
The "用户长期画像" section, if shown, is grouped by axis:
- **领域背景** (domain / experience) — what the user knows. Use this to
  CALIBRATE technical depth: a "B2B SaaS 5y" user can handle "ARR /
  CAC / churn" terminology directly; a "first-time founder" needs
  plainer language. NEVER quote the trait back to the user.
- **思维风格** (style / preference) — how the user reasons. Use this
  to MATCH framing: "data-driven" users respond better to scaffold='evidence-needed'
  with a metric in mind; "narrative-first" users respond better to scaffold='why'.
- **盲点 / 约束** (blind-spot / constraint) — recurring gaps and self-imposed
  limits. STRONG signal: prefer scaffold='evidence-needed' or scaffold='meta'
  to surface the gap, but framed gently — "你之前几次都没提到 X，是因为不重要还是
  暂时没数据？" rather than "你又漏了 X". A blind-spot with confidence ≥ 0.7
  is worth one direct probe per session.
- Confidence: ≥0.7 traits weight heavily, 0.5–0.69 are soft hints.
  Below 0.5 won't be shown.

DISCOVERY-AVOIDANCE RULE (hard):
When 用户长期画像 is shown, you ALREADY have answers to "who is this user / what's their background / what's their style". DO NOT re-ask discovery questions on any axis that the profile already covers:
- 领域背景 present → never ask "你的背景是什么" / "你做过 to-B 还是 to-C" / "你懂技术吗"
- 思维风格 present → never ask "你是数据驱动还是直觉派"
- 盲点 / 约束 present → never re-elicit the same constraint (e.g. budget when budget is already a known constraint)

Instead, USE the profile to deepen the question. Example:
  WRONG (with profile showing "B2B SaaS PM 背景"):  "你想做的产品面向哪类用户？"
  RIGHT:                                          "考虑到你 B2B 背景，想验证的是 SMB 还是 mid-market？哪个 ICP 已经有 2-3 个具体客户访谈在手？"

When profile is absent (empty userSkillBlock), discovery questions are appropriate — but only then.

OUTPUT: a JSON object exactly like:
  { "scaffold": "<one of the 5 kinds>", "content": "<your question, 2-3 substantive paragraphs>" }

Constraints:
- content is at most ${COACH_CONTENT_MAX_CHARS} chars (~250-300 汉字)
- one focused question that builds on the user's last answer, not a list
- Chinese only`

/**
 * Build the per-event user message that pairs with COACH_SYSTEM_PROMPT.
 *
 * Includes a snapshot of the canvas (counts + last 20 nodes), what the
 * user just did, recent chat history, and meta dedup hints.
 */
export function buildCoachUserMessage(input: ReflectionRequest): string {
  const { event, canvas, recentChat, firedMetaIds, userSkillBlock, priorScaffolds, userTurnCount } = input

  const canvasSummary = (() => {
    const counts = canvas.nodeCountByKind
    const kindBreakdown = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${k}:${n}`)
      .join(', ')
    return `${canvas.nodes.length} nodes (${kindBreakdown || 'empty'}), ${canvas.edgeCount} links.`
  })()

  const nodeList = canvas.nodes.length
    ? canvas.nodes
      .slice(0, 20)
      .map(
        (n, i) =>
          `  [${i + 1}] ${n.kind} · "${n.label}"${n.content ? ` — ${n.content.slice(0, 160).replace(/\n+/g, ' ')}` : ''
          }`
      )
      .join('\n')
    : '  (no nodes yet)'

  const eventLine = (() => {
    switch (event.type) {
      case 'node-added':
        return `Just ADDED a "${event.kind}" node labeled "${event.label}".`
      case 'node-linked':
        return `Just LINKED a "${event.fromKind}" node → "${event.toKind}" node.`
      case 'meta-check':
        return (
          'CANVAS THRESHOLD reached — produce a META observation about coverage gaps. ' +
          (firedMetaIds.length > 0
            ? `Already fired meta ids (DO NOT repeat themes): ${firedMetaIds.join(', ')}.`
            : '')
        )
      case 'user-message':
        // P10 fix · user typed in chat dock; main path. Tell the LLM
        // exactly what they said so it can react, not invent.
        return `User just SAID in chat: "${event.label.slice(0, 480)}"`
    }
  })()

  // P10 fix B · scaffold rotation hint. If we've used the same scaffold
  // 2× in a row, force a different one.
  const scaffoldHistoryLine = (() => {
    if (!priorScaffolds || priorScaffolds.length === 0) return ''
    const last3 = priorScaffolds.slice(-3)
    const allSame = last3.length >= 2 && last3.every((s) => s === last3[0])
    if (allSame) {
      return `\n\n## 反思类型轮转（重要）\n你已经连续用了 ${last3.length} 次 "${last3[0]}"。本次必须 PICK 另一种 scaffold（why/how/so-what/evidence-needed/meta 中除 "${last3[0]}" 外）。`
    }
    return `\n\n## 最近反思类型: ${last3.join(' → ')}（避免立刻重复同类型）`
  })()

  // P15.6 · Deflection detection hint. When the last user message is very
  // short (< hint threshold), inject an explicit signal so the LLM knows to pivot
  // instead of hammering the same topic with a different scaffold.
  const deflectionLine = (() => {
    const lastUser = [...recentChat].reverse().find((m) => m.role === 'user')
    if (!lastUser) return ''
    const trimmed = lastUser.content.trim()
    if (shouldHintCoachDeflection(trimmed)) {
      return `\n\n## ⚠️ 偏转检测（重要）\n用户的上一条回复很短（${trimmed.length}字："${trimmed.slice(0, 40)}"），很可能是没有在认真回答你的上一个问题。**不要继续追问同一个话题**，即使用不同的 scaffold 也不行。做法：用 ≤1 句话简短确认，然后直接跳转到 ## 维度覆盖图 中标记为 ⚠ 未探索 的新维度提问。本次回答控制在 1 段以内（不要写 2-3 段）。`
    }
    return ''
  })()

  // P10 fix D · turn-count graduation pressure. Early exploration should
  // stay conversational and switch to a clearer organizing question after
  // several turns without canvas structure. The optional wizard remains a
  // user-invoked command rather than an automatic Coach recommendation.
  // P11.18 fix · skip this entire suggestion if BMC cells already exist.
  // The "graduate to BMC" hint is meaningless once BMC has graduated; the
  // user just sees "canvas empty, run /wizard" while staring at 9 BMC
  // cells, which contradicts what they see.
  const graduationLine = (() => {
    const turns = userTurnCount ?? 0
    const bmcCardCount = canvas.nodes.filter((n) => n.kind === 'cc-bmc-card').length
    const conflictCount = canvas.nodes.filter((n) => n.kind === 'conflict-alert').length
    const insightCount = canvas.nodes.filter((n) => n.kind === 'insight-note').length
    if (bmcCardCount > 0) {
      // Past graduation — switch to "examine cells critically" guidance.
      // P12 · also surface the ATTACK SURFACE: how many critic-found
      // conflicts and synthesizer-found insights are sitting on the
      // canvas right now. The coach should anchor probing questions on
      // these rather than picking a random cell.
      const attackSurface = conflictCount + insightCount
      const surfaceLine = attackSurface > 0
        ? ` 画布上还有 ${conflictCount} 条 critic 冲突 + ${insightCount} 条 synthesizer 洞察未被用户讨论 — 优先 anchor 你的问题到其中一条具体的 conflict-alert 或 insight-note 上（按 label 引用），而不是泛问某个 cell。`
        : ' 没有未消化的 conflict / insight，本次可建议用户 @critic 或 @synthesizer 主动产出新的反思素材。'
      return `\n\n## 当前阶段（重要）\n画布已有 ${bmcCardCount} 个 BMC cell，用户已完成探索阶段。**禁止建议 /wizard** 或说"画布空白"。本次反思应聚焦于 BMC cell 内容本身：scaffold='evidence-needed'（指出某个具体 cell 缺事实）、scaffold='why'（追问某个 cell 的逻辑）、或 scaffold='meta'（建议 @critic 检查跨 cell 一致性）。${surfaceLine}`
    }
    const canvasIsSparse = canvas.nodes.length < 3
    if (turns >= 7 && canvasIsSparse) {
      return `\n\n## 进阶提示（重要）\n用户已经说了 ${turns} 次但画布只有 ${canvas.nodes.length} 个节点。保持探索感，不要推荐 \`/wizard\`。告诉用户你会继续边聊边归纳，并提出一个更容易回答的组织性问题，例如让用户从目标客户、核心价值、验证方式中选择一个先确认。`
    }
    if (turns >= 4 && canvasIsSparse) {
      return `\n\n## 探索阶段提示（轻量）\n用户已经说了 ${turns} 次但画布只有 ${canvas.nodes.length} 个节点。不要推荐 \`/wizard\` 或强推 BMC；继续问一个能让想法更具体的问题。若需要 meta 视角，最多轻描淡写地说“你可以继续自由说，我会帮你整理”。`
    }
    return ''
  })()

  const chatLines = recentChat.length
    ? recentChat
      .map(
        (m) =>
          `  ${m.role.toUpperCase()}: ${m.content.slice(0, 240).replace(/\n+/g, ' ')}`
      )
      .join('\n')
    : '  (no prior exchange)'

  // ── Dimension coverage heatmap (P15 · depth+breadth) ──
  // When the client provides dimensionCoverage, render a sorted heatmap
  // so the LLM sees which BMC/ideation dimensions are unexplored (count=0)
  // and prioritises them for rotation. Zero-coverage dims get a ⚠ marker.
  const coverageLine = (() => {
    const cov = input.dimensionCoverage
    if (!cov || Object.keys(cov).length === 0) return ''
    const entries = Object.entries(cov).sort(([, a], [, b]) => a - b)
    const total = entries.length
    const zeroCount = entries.filter(([, n]) => n === 0).length
    const allLines = entries.map(([key, count]) => {
      const dim = DIMENSION_KEYWORDS.find((d) => d.key === key)
      const label = dim?.label ?? key
      const marker =
        count === 0
          ? '⚠ 未探索 (优先)'
          : count >= 3
            ? `✓ 已覆盖 (${count}次)`
            : ` 提及 ${count}次`
      return `  - ${label}: ${marker}`
    })
    return `\n\n## 维度覆盖图（${total}个维度，${zeroCount}个未探索）\n**你的任务：本轮优先从未探索（⚠）维度中选一个提问。如果全都探索过，就对覆盖率最低的维度深入一轮。**\n${allLines.join('\n')}`
  })()

  // Optional user-skill block: when the server has fetched durable traits
  // for this user, they're rendered here so the LLM can calibrate its
  // scaffold-type and word choice. Empty/missing → section omitted entirely
  // so the prompt stays identical to the pre-personalization shape (zero
  // regression risk on first-session users).
  const skillSection = userSkillBlock?.trim()
    ? `\n\n## 用户长期画像（仅供你 calibrate 反思类型 + 用词，不要在回答里复述）\n${userSkillBlock.trim()}`
    : ''

  return `CANVAS:
${canvasSummary}
${nodeList}

EVENT:
${eventLine}${scaffoldHistoryLine}${deflectionLine}${graduationLine}${coverageLine}${skillSection}

RECENT EXCHANGE (newest last):
${chatLines}

Respond with the JSON object only.`
}
