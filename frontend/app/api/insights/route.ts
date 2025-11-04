import { NextResponse } from 'next/server'
import { getDifyWorkflow, DEFAULT_DIFY_WORKFLOW_ID } from '@/config/dify'
import { DifyService } from '@/services/DifyService'

type InsightRequest = {
  tenantId: string
  userId: string
  taskId: string
  question: string
  timeline: unknown[]
  edges: unknown[]
}

const difyService = new DifyService()

export async function POST(request: Request) {
  const payload = (await request.json()) as InsightRequest

  if (!payload?.question?.trim()) {
    return NextResponse.json({ message: 'question is required' }, { status: 400 })
  }

  try {
    const summary = await generateSummaryFromDify(payload.question.trim(), payload.userId ?? 'anonymous')
    return NextResponse.json({
      nodes: [],
      edges: [],
      summary
    })
  } catch (error) {
    console.error('[api/insights] failed to generate insights', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    )
  }
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
      return 'Dify 工作流返回了流式响应，当前端点仅支持阻塞模式。'
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

    return candidates[0] ?? `Dify 工作流未返回洞察内容，请检查 ${workflow.id} 配置。`
  } catch (error) {
    throw new Error(
      `Dify 工作流执行失败：${error instanceof Error ? error.message : String(error)}`
    )
  }
}

function isResponse(result: unknown): result is Response {
  return typeof Response !== 'undefined' && result instanceof Response
}
