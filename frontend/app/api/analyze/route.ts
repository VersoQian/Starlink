"use server"

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { runCanvasPipeline, runStarlinkAgentTask } from '@branching-chat/agent-runtime'
import type { CanvasEdge, CanvasNode } from '@branching-chat/shared'

const backendBaseUrl = process.env.BACKEND_API_BASE_URL ?? 'http://localhost:4000'

let agentEnvLoaded = false

function ensureAgentEnvLoaded() {
  if (agentEnvLoaded) return
  const agentEnvPath = join(process.cwd(), 'packages/agent-runtime/.env')
  if (existsSync(agentEnvPath)) {
    const content = readFileSync(agentEnvPath, 'utf-8')
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => {
        const [key, ...rest] = line.split('=')
        const value = rest.join('=')
        if (key && !(key in process.env)) {
          process.env[key] = value
        }
      })
  }
  agentEnvLoaded = true
}

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

function mapGraphToTimeline(graph: { nodes: CanvasNode[]; edges: CanvasEdge[] }) {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data as Record<string, unknown>
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? null
    }))
  }
}

async function runFallbackAnalysis(payload: AnalyzeRequest) {
  ensureAgentEnvLoaded()

  const question = payload.question ?? '请提供分析问题'
  const workspaceId = payload.tenantId ?? 'fallback-workspace'
  const userId = payload.userId ?? 'anonymous'

  const execution = await runCanvasPipeline({
    workspaceId,
    userId,
    question
  })

  const { nodes, edges } = mapGraphToTimeline(execution.graph)
  let summary =
    (execution.graph.nodes[0]?.data as { content?: string })?.content ??
    `针对「${question}」的画布分析`

  try {
    const agentResult = await runStarlinkAgentTask(
      {
        workspaceId,
        userId,
        question,
        graph: execution.graph
      },
      question
    )
    const outputText =
      (agentResult && typeof agentResult.output === 'string'
        ? agentResult.output
        : agentResult?.output) ?? null
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      summary = outputText.trim()
    }
  } catch (error) {
    console.warn('Starlink agent execution failed:', error)
  }

  return {
    nodes,
    edges,
    summary,
    iteration: {
      id: randomUUID(),
      version: (payload.timeline?.length ?? 0) + 1,
      summary,
      createdAt: new Date().toISOString(),
      nodes,
      edges
    }
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as AnalyzeRequest

  try {
    const response = await fetch(`${backendBaseUrl}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const text = await response.text()
      console.warn('Backend analyze failed, using fallback:', text)
      const fallback = await runFallbackAnalysis(payload)
      return NextResponse.json(fallback)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.warn('Backend analyze unreachable, using fallback', error)
    const fallback = await runFallbackAnalysis(payload)
    return NextResponse.json(fallback)
  }
}
