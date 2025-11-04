import { nanoid } from 'nanoid'

export type CanvasNodeType = 'note' | 'document' | 'task' | 'reference' | 'image' | 'web'

export type CanvasNodeData =
  | {
      type: 'note'
      title: string
      content: string
      subtitle?: string
      bullets?: string[]
      variant?: 'primary' | 'list' | 'insight'
      footerText?: string
    }
  | {
      type: 'document'
      title: string
      summary: string
      references: number
    }
  | {
      type: 'task'
      title: string
      assignee?: string
      dueDate?: string
      status: 'todo' | 'in-progress' | 'done'
    }
  | {
      type: 'reference'
      title: string
      source: string
      location: string
    }
  | {
      type: 'image'
      title: string
      url: string
    }
  | {
      type: 'web'
      title: string
      url: string
      description?: string
    }

export type CanvasNode = {
  id: string
  type: CanvasNodeType
  position: {
    x: number
    y: number
  }
  data: CanvasNodeData
}

export type CanvasEdge = {
  id: string
  source: string
  target: string
  label?: string | null
}

export type WorkspaceGraph = {
  workspaceId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export type AnalysisSubQuestion = {
  title: string
  prompt: string
}

export type AnalysisDimension = {
  label: string
  insight: string
  bullets?: string[]
}

export type AnalysisActionItem = {
  title: string
  description: string
  suggestedOwner?: string
}

export type AnalysisResult = {
  question: string
  summary: string
  subQuestions: AnalysisSubQuestion[]
  dimensions: AnalysisDimension[]
  actionItems: AnalysisActionItem[]
}

type CreateNodeInput = {
  type: CanvasNodeType
  position: {
    x: number
    y: number
  }
  data: CanvasNodeData
}

type CreateEdgeInput = {
  source: string
  target: string
  label?: string | null
}

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const DEFAULT_GRAPHS: Record<string, WorkspaceGraph> = {
  demo: {
    workspaceId: 'demo',
    nodes: [
      {
        id: 'note-1',
        type: 'note',
        position: { x: 80, y: 120 },
        data: {
          type: 'note',
          title: '任务规划',
          subtitle: '我们如何完成 AI Agent 调研？',
          content: '我想要完成 AI Agent 调研',
          variant: 'primary',
          footerText: '复杂的办公任务，从规划开始'
        }
      },
      {
        id: 'doc-1',
        type: 'note',
        position: { x: 500, y: 120 },
        data: {
          type: 'note',
          title: '第 1 轮 · 澄清问题',
          subtitle: 'AI Agent 调研',
          content: '我们先确认任务目标、聚焦行业与时限等关键信息。',
          bullets: [
            '调研核心目标：了解 AI Agent 在知识管理场景的落地潜力',
            '重点行业：金融、教育、制造',
            '时间范围：未来 6 个月，需要可引用的数据来源'
          ],
          variant: 'timeline-step'
        }
      },
      {
        id: 'doc-2',
        type: 'note',
        position: { x: 760, y: 120 },
        data: {
          type: 'note',
          title: '客户与市场机会',
          subtitle: '商业模式板块',
          content: '目标客户：中大型企业知识团队；市场规模持续增长。',
          bullets: ['痛点：知识更新慢、协同效率低', '动机：希望提效、降本、合规'],
          variant: 'timeline-dimension'
        }
      },
      {
        id: 'doc-3',
        type: 'note',
        position: { x: 1020, y: 120 },
        data: {
          type: 'note',
          title: '行动计划',
          subtitle: '第 1 轮',
          bullets: [
            '访谈 5 家重点客户，补齐需求清单',
            '梳理价值主张与差异点，形成初步模型',
            '设计收入与定价假设，准备下一轮验证'
          ],
          variant: 'timeline-action'
        }
      }
    ],
    edges: [
      {
        id: 'note-1->doc-1',
        source: 'note-1',
        target: 'doc-1',
        label: '步骤 1'
      },
      {
        id: 'doc-1->doc-2',
        source: 'doc-1',
        target: 'doc-2',
        label: '步骤 1.1'
      },
      {
        id: 'doc-2->doc-3',
        source: 'doc-2',
        target: 'doc-3',
        label: '步骤 1.2'
      }
    ]
  }
}

class CanvasServiceImpl {
  private graphs = new Map<string, WorkspaceGraph>()

  constructor() {
    Object.values(DEFAULT_GRAPHS).forEach((graph) => {
      this.graphs.set(graph.workspaceId, deepClone(graph))
    })
  }

  getGraph(workspaceId: string): WorkspaceGraph {
    if (!this.graphs.has(workspaceId)) {
      this.graphs.set(workspaceId, {
        workspaceId,
        nodes: [],
        edges: []
      })
    }
    const graph = this.graphs.get(workspaceId)
    if (!graph) {
      throw new Error('Graph not initialized')
    }
    return deepClone(graph)
  }

  addNode(workspaceId: string, input: CreateNodeInput): CanvasNode {
    const graph = this.ensureGraph(workspaceId)
    const node: CanvasNode = {
      id: nanoid(10),
      type: input.type,
      position: input.position,
      data: input.data
    }
    graph.nodes.push(node)
    return deepClone(node)
  }

  addEdge(workspaceId: string, input: CreateEdgeInput): CanvasEdge {
    const graph = this.ensureGraph(workspaceId)
    const edge: CanvasEdge = {
      id: input.label ? `${input.source}->${input.target}:${input.label}` : `${input.source}->${input.target}`,
      source: input.source,
      target: input.target,
      label: input.label ?? null
    }
    graph.edges.push(edge)
    return deepClone(edge)
  }

  private ensureGraph(workspaceId: string): WorkspaceGraph {
    if (!this.graphs.has(workspaceId)) {
      this.graphs.set(workspaceId, {
        workspaceId,
        nodes: [],
        edges: []
      })
    }
    const graph = this.graphs.get(workspaceId)
    if (!graph) {
      throw new Error('Graph not initialized')
    }
    return graph
  }
}

export const CanvasService = new CanvasServiceImpl()

const normalizeQuestion = (input: string) => {
  return input.trim().replace(/\s+/g, ' ').replace(/[?？!！。]+$/u, '')
}

const buildSummary = (question: string) => {
  return `您好！我们将围绕「${question}」从商业模式的关键构件入手，帮助你厘清价值、客户、收入与资源。`
}

const buildSubQuestions = (question: string): AnalysisSubQuestion[] => {
  return [
    {
      title: '目标与场景',
      prompt: `围绕「${question}」，主要服务的客户是谁？他们遇到的核心痛点是什么？`
    },
    {
      title: '价值与差异',
      prompt: `我们提供的核心价值主张是什么？相较竞品有哪些独特优势？`
    },
    {
      title: '收益与执行',
      prompt: `主要收入来源与定价模式是什么？成本结构、关键资源和合作方分别有哪些？`
    }
  ]
}

const buildDimensions = (question: string): AnalysisDimension[] => {
  return [
    {
      label: '客户与市场机会',
      insight: `目标客户是谁？市场规模与增长趋势如何？` ,
      bullets: ['细分客户画像与场景', '核心痛点与购买动机', '潜在市场规模与增长率']
    },
    {
      label: '价值主张与产品组合',
      insight: `我们解决哪些关键问题？提供怎样的价值组合？` ,
      bullets: ['主打价值主张与差异点', '核心功能/服务包', '证明价值的关键案例或数据']
    },
    {
      label: '渠道与获客路径',
      insight: `客户如何接触我们？成交流程如何设计？` ,
      bullets: ['认知/引流渠道', '转化与成交路径', '售后与续费机制']
    },
    {
      label: '收入模式与定价策略',
      insight: `收入来源有哪些？定价模型如何搭建？` ,
      bullets: ['主要收入来源', '定价方式与量纲', '付费触发条件与周期']
    },
    {
      label: '成本结构与关键资源',
      insight: `花钱花在哪？需要哪些关键资源与能力？` ,
      bullets: ['固定/变动成本构成', '关键资源与伙伴', '能力缺口与投入计划']
    },
    {
      label: '风险与合规要求',
      insight: `存在哪些外部风险或政策约束？如何应对？` ,
      bullets: ['技术/市场/运营风险', '合规与监管要点', '应对策略与预警指标']
    }
  ]
}

const buildActionItems = (question: string): AnalysisActionItem[] => {
  return [
    {
      title: '收集市场与客户基线',
      description: `补齐关于「${question}」的客户画像、需求调研与市场规模数据，形成现状底稿。`,
      suggestedOwner: '市场/研究'
    },
    {
      title: '明确价值与收入假设',
      description: `梳理核心价值主张、差异点与收入模型，输出可验证的假设列表。`,
      suggestedOwner: '产品/业务'
    },
    {
      title: '制定执行路线图',
      description: `将商业模式拆解为关键里程碑、资源投入与风险预案，并明确相关协同方。`,
      suggestedOwner: '项目/运营'
    }
  ]
}

export const CanvasAnalysis = {
  run(workspaceId: string, rawQuestion: string): AnalysisResult {
    const question = normalizeQuestion(rawQuestion)
    const summary = buildSummary(question)
    const subQuestions = buildSubQuestions(question)
    const dimensions = buildDimensions(question)
    const actionItems = buildActionItems(question)

    // ensure workspace graph exists so follow-up node creation works
    CanvasService.getGraph(workspaceId)

    return {
      question,
      summary,
      subQuestions,
      dimensions,
      actionItems
    }
  }
}
