import { z } from 'zod'

export type TimelineNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export type AnalyzeAgentInput = {
  tenantId: string
  userId: string
  taskId: string
  question: string
  timeline: TimelineNode[]
  edges: Array<{ id: string; source: string; target: string; label?: string | null }>
}

export type AnalyzeAgentOutput = {
  nodes: TimelineNode[]
  edges: Array<{ id: string; source: string; target: string; label?: string | null }>
  summary: string
}

const dimensionSchema = z.object({
  label: z.string(),
  insight: z.string(),
  bullets: z.array(z.string()).optional()
})

const actionSchema = z.object({
  title: z.string(),
  description: z.string(),
  suggestedOwner: z.string().optional()
})

const analysisSchema = z.object({
  summary: z.string(),
  dimensions: z.array(dimensionSchema).min(4),
  actionItems: z.array(actionSchema).min(3)
})

type AnalysisPayload = z.infer<typeof analysisSchema>

const DEFAULT_TONGYI_ENDPOINT =
  process.env.TONGYI_API_URL ??
  process.env.DASHSCOPE_API_URL ??
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'

const DEFAULT_TONGYI_MODEL =
  process.env.TONGYI_MODEL ?? process.env.DASHSCOPE_MODEL ?? process.env.QWEN_MODEL ?? 'qwen-plus'

const DEFAULT_TONGYI_TEMPERATURE = Number(
  process.env.TONGYI_TEMPERATURE ??
    process.env.DASHSCOPE_TEMPERATURE ??
    process.env.QWEN_TEMPERATURE ??
    '0'
)

type TongyiResponse = {
  output?: {
    text?: string
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>
      }
    }>
  }
  message?: string
  msg?: string
  code?: number | string
}

async function callTongyiStructured(prompt: string) {
  const apiKey =
    process.env.DASHSCOPE_API_KEY ?? process.env.TONGYI_API_KEY ?? process.env.QWEN_API_KEY

  if (!apiKey) {
    throw new Error(
      'Tongyi Qianwen API key not found. Please set DASHSCOPE_API_KEY (or TONGYI_API_KEY).'
    )
  }

  const response = await fetch(DEFAULT_TONGYI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEFAULT_TONGYI_MODEL,
      input: {
        messages: [
          {
            role: 'system',
            content: '你是一名资深商业模式顾问，擅长将复杂问题拆解为结构化要点。'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        result_format: 'message',
        temperature: DEFAULT_TONGYI_TEMPERATURE
      }
    })
  })

  const data = (await response.json()) as TongyiResponse

  if (!response.ok) {
    const reason = data?.message ?? data?.msg ?? 'Unknown Tongyi Qianwen error'
    throw new Error(`Tongyi Qianwen request failed (${response.status}): ${reason}`)
  }

  const content = extractTongyiMessage(data)
  if (!content) {
    throw new Error('Tongyi Qianwen response did not include assistant content')
  }

  return content
}

function extractTongyiMessage(payload: TongyiResponse): string | null {
  const choice = payload.output?.choices?.[0]
  const choiceContent = choice?.message?.content

  if (typeof choiceContent === 'string') {
    return choiceContent
  }

  if (Array.isArray(choiceContent)) {
    const text = choiceContent
      .map((segment) => segment?.text)
      .filter((segment): segment is string => typeof segment === 'string')
      .join('')
    if (text) {
      return text
    }
  }

  if (typeof payload.output?.text === 'string') {
    return payload.output.text
  }

  return null
}

function sanitizeJsonBlock(text: string) {
  const trimmed = text.trim()
  const fencedMatch = trimmed.match(/```json([\s\S]*?)```/i)
  if (fencedMatch && fencedMatch[1]) {
    return fencedMatch[1].trim()
  }
  const genericFence = trimmed.match(/```([\s\S]*?)```/)
  if (genericFence && genericFence[1]) {
    return genericFence[1].trim()
  }
  return trimmed
}

const PRIMARY_VARIANT = 'primary'
const STEP_VARIANT = 'timeline-step'
const DIMENSION_VARIANT = 'timeline-dimension'
const ACTION_VARIANT = 'timeline-action'

const BASE_X = 80
const BASE_Y = 120
const STEP_OFFSET = 420
const SEGMENT_SPACING = 280

const typedNodes = (nodes: TimelineNode[]) =>
  nodes.map((node) => ({
    ...node,
    position: node.position ?? { x: BASE_X, y: BASE_Y },
    data: { ...(node.data ?? {}) }
  }))

const countExistingSteps = (nodes: TimelineNode[]) =>
  nodes.filter((node) => (node.data as any)?.variant === STEP_VARIANT).length

const findPrimary = (nodes: TimelineNode[]) =>
  nodes.find((node) => (node.data as any)?.variant === PRIMARY_VARIANT)

const ensurePrimary = (nodes: TimelineNode[], question: string, summary: string) => {
  const existing = findPrimary(nodes)
  if (existing) {
    existing.data = {
      ...(existing.data ?? {}),
      category: 'task',
      variant: PRIMARY_VARIANT,
      title: (existing.data as any)?.title ?? '任务规划',
      subtitle: question,
      content: summary,
      footerText: '复杂的办公任务，从规划开始'
    }
    existing.position = existing.position ?? { x: BASE_X, y: BASE_Y }
    return existing
  }

  const created: TimelineNode = {
    id: `core-${Date.now()}`,
    type: 'note',
    position: { x: BASE_X, y: BASE_Y },
    data: {
      category: 'task',
      variant: PRIMARY_VARIANT,
      title: '任务规划',
      subtitle: question,
      content: summary,
      footerText: '复杂的办公任务，从规划开始'
    }
  }
  nodes.push(created)
  return created
}

const maxX = (nodes: TimelineNode[]) =>
  nodes.reduce((acc, node) => Math.max(acc, node.position.x), BASE_X)

export async function runAnalyzeAgent(input: AnalyzeAgentInput): Promise<AnalyzeAgentOutput> {
  const { question, timeline, edges } = input
  const nodes = typedNodes(timeline)

  const prompt = `你是一名商业模式顾问。任务如下：\n任务描述：${question}\n\n请输出 JSON：\n- summary：50 字以内总结下一步关注重点\n- dimensions：至少 4 个商业模式要素，每个含 label/insight/bullets\n- actionItems：至少 3 个行动项，含 title/description/suggestedOwner（可选）。`

  const tongyiRaw = await callTongyiStructured(prompt)
  const sanitized = sanitizeJsonBlock(tongyiRaw)

  let parsed: unknown
  try {
    parsed = JSON.parse(sanitized)
  } catch (error) {
    throw new Error(`Failed to parse Tongyi Qianwen response as JSON: ${(error as Error).message}`)
  }

  const analysis: AnalysisPayload = analysisSchema.parse(parsed)

  const primary = ensurePrimary(nodes, question, analysis.summary)
  const stepIndex = countExistingSteps(nodes) + 1
  let currentX = Math.max(primary.position.x + STEP_OFFSET * stepIndex, maxX(nodes) + SEGMENT_SPACING)

  const newNodes: TimelineNode[] = []
  const newEdges: AnalyzeAgentOutput['edges'] = []

  const stepNode: TimelineNode = {
    id: `step-${Date.now()}`,
    type: 'note',
    position: { x: currentX, y: primary.position.y },
    data: {
      category: 'step',
      variant: STEP_VARIANT,
      title: `第 ${stepIndex} 轮 · 澄清问题`,
      subtitle: question,
      content: analysis.summary,
      bullets: analysis.dimensions
        .slice(0, 3)
        .map((dim: AnalysisPayload['dimensions'][number]) => dim.label)
    }
  }
  newNodes.push(stepNode)
  newEdges.push({
    id: `${primary.id}->${stepNode.id}`,
    source: primary.id,
    target: stepNode.id,
    label: `第 ${stepIndex} 轮`
  })

  let previousNodeId = stepNode.id
  currentX += SEGMENT_SPACING

  analysis.dimensions.forEach(
    (dimension: AnalysisPayload['dimensions'][number], idx: number) => {
      const node: TimelineNode = {
        id: `dimension-${Date.now()}-${idx}`,
        type: 'note',
        position: { x: currentX, y: primary.position.y },
        data: {
          category: 'dimension',
          subCategory: dimension.label,
          variant: DIMENSION_VARIANT,
          title: dimension.label,
          subtitle: '商业模式板块',
          content: dimension.insight,
          bullets: dimension.bullets
        }
      }
      newNodes.push(node)
      newEdges.push({
        id: `${previousNodeId}->${node.id}`,
        source: previousNodeId,
        target: node.id,
        label: dimension.label
      })
      previousNodeId = node.id
      currentX += SEGMENT_SPACING
    }
  )

  const actionsNode: TimelineNode = {
    id: `actions-${Date.now()}`,
    type: 'note',
    position: { x: currentX, y: primary.position.y },
    data: {
      category: 'action',
      variant: ACTION_VARIANT,
      title: '行动计划',
      subtitle: `第 ${stepIndex} 轮`,
      bullets: analysis.actionItems.map((item: AnalysisPayload['actionItems'][number]) => {
        const owner = item.suggestedOwner ? `（负责人：${item.suggestedOwner}）` : ''
        return `${item.title}${owner}`
      }),
      content: analysis.actionItems
        .map((item: AnalysisPayload['actionItems'][number]) => item.description)
        .join('\n')
    }
  }
  newNodes.push(actionsNode)
  newEdges.push({
    id: `${previousNodeId}->${actionsNode.id}`,
    source: previousNodeId,
    target: actionsNode.id,
    label: '行动计划'
  })

  const mergedNodes = [...nodes, ...newNodes]

  return {
    nodes: mergedNodes,
    edges: [...edges, ...newEdges],
    summary: analysis.summary
  }
}
