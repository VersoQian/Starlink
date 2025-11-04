"use server"

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDifyWorkflow, DEFAULT_DIFY_WORKFLOW_ID } from '@/config/dify'
import { DifyService } from '@/services/DifyService'

type AnalyzeRequest = {
  tenantId: string
  userId: string
  taskId: string
  question: string
  timeline: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, unknown>
  }>
  edges: Array<{ id: string; source: string; target: string; label?: string | null }>
}

type TimelineNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

type TimelineEdge = {
  id: string
  source: string
  target: string
  label?: string | null
}

const ROOT_POSITION = { x: 160, y: 160 }
const BRANCH_SPACING = 320
const LEVEL_SPACING = 220

const SUB_QUESTION_BLUEPRINTS = [
  {
    title: '澄清目标与边界',
    bullets: ['关键目标是什么？', '价值指标如何衡量？', '重要限制或约束有哪些？']
  },
  {
    title: '拆分关键维度',
    bullets: ['涉及哪些参与方？', '目前有哪些已知信息？', '潜在的未知或风险点？']
  },
  {
    title: '识别资源与数据',
    bullets: ['有哪些可直接利用的资料？', '需要补充的调研是什么？', '数据同步与责任人是谁？']
  }
]

const DIMENSION_BLUEPRINTS = [
  {
    title: '价值主张与用户场景',
    bullets: ['目标用户痛点', '拟提供的价值组合', '成功衡量指标'],
    subCategory: 'value_proposition'
  },
  {
    title: '路径与执行机制',
    bullets: ['关键活动/步骤', '所需协同角色', '可能的阻塞点'],
    subCategory: 'channels'
  },
  {
    title: '数据与验证计划',
    bullets: ['需要验证的假设', '优先采集的数据', '验证时间线'],
    subCategory: 'key_resources'
  }
]

const ACTION_BLUEPRINTS = [
  {
    title: '补齐事实基础',
    bullets: ['梳理现有资料并标记可信度', '盘点关键假设是否成立', '收集团队已有结论']
  },
  {
    title: '设计验证活动',
    bullets: ['列出必须访谈或调研的对象', '设置观察指标与成功阈值', '准备复盘时间点']
  },
  {
    title: '建立复用模板',
    bullets: ['沉淀模板/清单供未来复用', '明确后续责任人和协作路径', '安排下一次 Branching 对话']
  }
]

const difyService = new DifyService()

export async function POST(request: Request) {
  const payload = (await request.json()) as AnalyzeRequest

  if (!payload?.question?.trim()) {
    return NextResponse.json({ message: 'question is required' }, { status: 400 })
  }

  const question = payload.question.trim()
  const userId = payload.userId ?? 'anonymous'

  const summary = await generateSummaryFromDify(question, userId)
  const graph = buildTimelineGraph({
    question,
    tenantId: payload.tenantId ?? 'default-tenant',
    userId,
    summary
  })

  return NextResponse.json({
    nodes: graph.nodes,
    edges: graph.edges,
    summary,
    iteration: {
      id: randomUUID(),
      version: (payload.timeline?.length ?? 0) + 1,
      summary,
      createdAt: new Date().toISOString(),
      nodes: graph.nodes,
      edges: graph.edges
    }
  })
}

async function generateSummaryFromDify(question: string, userId: string): Promise<string> {
  try {
    const workflow = getDifyWorkflow(DEFAULT_DIFY_WORKFLOW_ID)
    const result = await difyService.executeWorkflow({
      workflowId: workflow.id,
      inputs: { question },
      user: userId,
      responseMode: 'blocking'
    })

    if (isResponse(result)) {
      return 'Dify 工作流返回了流式响应，无法在阻塞模式解析。'
    }

    const candidates = [
      result.answer,
      Array.isArray(result.outputs)
        ? result.outputs.find((item) => item?.answer || item?.text)?.answer
        : null,
      Array.isArray(result.outputs)
        ? result.outputs.find((item) => item?.answer || item?.text)?.text
        : null,
      typeof result.data === 'string' ? (result.data as string) : null
    ].filter((value): value is string => Boolean(value && value.trim()))

    return (
      candidates[0] ??
      `Dify 工作流未返回文本摘要，请检查 ${workflow.id} 配置。`
    )
  } catch (error) {
    console.warn('[api/analyze] Dify workflow failed, fallback to placeholder', error)
    return `针对「${question}」的分析将在配置 Dify 工作流后生成。`
  }
}

function buildTimelineGraph({
  question,
  tenantId,
  userId,
  summary
}: {
  question: string
  tenantId: string
  userId: string
  summary: string
}): { nodes: TimelineNode[]; edges: TimelineEdge[] } {
  const nodes: TimelineNode[] = []
  const edges: TimelineEdge[] = []

  const addNode = (node: TimelineNode, edge?: TimelineEdge) => {
    nodes.push(node)
    if (edge) {
      edges.push(edge)
    }
  }

  const rootId = `root-${tenantId}-${Date.now()}`
  addNode({
    id: rootId,
    type: 'note',
    position: { ...ROOT_POSITION },
    data: {
      type: 'note',
      title: '多维画布任务',
      subtitle: `发起人：${userId}`,
      content: summary,
      footerText: '由 Dify 生成的最新分析摘要',
      variant: 'primary'
    }
  })

  const branchNodes = SUB_QUESTION_BLUEPRINTS.map((blueprint, index) => {
    const id = `branch-${index}-${Date.now()}`
    const node: TimelineNode = {
      id,
      type: 'note',
      position: {
        x: ROOT_POSITION.x + BRANCH_SPACING * (index + 1),
        y: ROOT_POSITION.y
      },
      data: {
        type: 'note',
        title: `分支 ${index + 1} · ${blueprint.title}`,
        content: `围绕「${question}」聚焦这一分支并记录要点。`,
        bullets: blueprint.bullets,
        variant: 'timeline-step'
      }
    }
    addNode(node, {
      id: `${rootId}->${id}`,
      source: rootId,
      target: id,
      label: `主题 ${index + 1}`
    })
    return node
  })

  branchNodes.forEach((branch, index) => {
    const dimensionBlueprint = DIMENSION_BLUEPRINTS[index % DIMENSION_BLUEPRINTS.length]
    const dimensionId = `dimension-${index}-${Date.now()}`
    const dimensionNode: TimelineNode = {
      id: dimensionId,
      type: 'note',
      position: {
        x: branch.position.x,
        y: branch.position.y + LEVEL_SPACING
      },
      data: {
        type: 'note',
        title: dimensionBlueprint.title,
        content: `从该维度拆解「${question}」。`,
        bullets: dimensionBlueprint.bullets,
        variant: 'timeline-dimension',
        subCategory: dimensionBlueprint.subCategory
      }
    }

    addNode(dimensionNode, {
      id: `${branch.id}->${dimensionId}`,
      source: branch.id,
      target: dimensionId,
      label: '分析维度'
    })

    const actionBlueprint = ACTION_BLUEPRINTS[index % ACTION_BLUEPRINTS.length]
    const actionId = `action-${index}-${Date.now()}`
    addNode(
      {
        id: actionId,
        type: 'note',
        position: {
          x: dimensionNode.position.x,
          y: dimensionNode.position.y + LEVEL_SPACING
        },
        data: {
          type: 'note',
          title: actionBlueprint.title,
          bullets: actionBlueprint.bullets,
          variant: 'timeline-action',
          content: '完成后请在节点评论里更新进展。'
        }
      },
      {
        id: `${dimensionId}->${actionId}`,
        source: dimensionId,
        target: actionId,
        label: '行动计划'
      }
    )
  })

  return { nodes, edges }
}

function isResponse(result: unknown): result is Response {
  return typeof Response !== 'undefined' && result instanceof Response
}
