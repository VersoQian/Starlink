import { NextResponse } from 'next/server'
import { DifyService } from '../../../services/DifyService'
import { getDifyWorkflow } from '../../../config/dify'

const service = new DifyService()

type DifyRequestPayload = {
  workflowId?: string
  inputs?: Record<string, unknown>
  userId?: string
  mode?: 'blocking' | 'streaming'
  stream?: boolean
}

export async function POST(request: Request) {
  let payload: DifyRequestPayload

  try {
    payload = (await request.json()) as DifyRequestPayload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.workflowId) {
    return NextResponse.json({ message: 'workflowId is required' }, { status: 400 })
  }

  if (!payload.inputs) {
    return NextResponse.json({ message: 'inputs is required' }, { status: 400 })
  }

  try {
    const workflow = getDifyWorkflow(payload.workflowId)
    const mode = payload.mode ?? (payload.stream ? 'streaming' : workflow.mode)

    if (mode === 'streaming') {
      const response = (await service.executeWorkflow({
        workflowId: workflow.id,
        inputs: payload.inputs,
        user: payload.userId,
        responseMode: 'streaming'
      })) as Response

      const headers = new Headers(response.headers)
      headers.set('Cache-Control', 'no-cache')
      headers.set('Connection', 'keep-alive')
      headers.set('Content-Type', 'text/event-stream')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      })
    }

    const result = await service.executeWorkflow({
      workflowId: workflow.id,
      inputs: payload.inputs,
      user: payload.userId,
      responseMode: 'blocking'
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/dify] failed', error)
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Unexpected Dify error'
      },
      { status: 500 }
    )
  }
}
