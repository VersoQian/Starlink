import { NextResponse } from 'next/server'
import { runStarlinkAgentTask } from '@branching-chat/agent-runtime'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

type InsightRequest = {
  tenantId: string
  userId: string
  taskId: string
  question: string
  timeline: unknown[]
  edges: unknown[]
}

let agentEnvLoaded = false

function ensureAgentEnv() {
  if (agentEnvLoaded) return
  const envPath = join(process.cwd(), 'packages/agent-runtime/.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
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

export async function POST(request: Request) {
  const payload = (await request.json()) as InsightRequest
  ensureAgentEnv()

  try {
    const result = await runStarlinkAgentTask(
      {
        workspaceId: payload.tenantId,
        userId: payload.userId,
        question: payload.question
      },
      payload.question
    )

    const summary =
      (typeof result?.output === 'string' && result.output) ||
      (result?.output && typeof (result.output as any).trim === 'function'
        ? String((result.output as any).trim())
        : 'AI 已生成洞察。')

    return NextResponse.json({
      nodes: [],
      edges: [],
      summary
    })
  } catch (error) {
    console.error('Failed to generate insights', error)
    return NextResponse.json({ message: (error as Error).message ?? '生成失败' }, { status: 500 })
  }
}
