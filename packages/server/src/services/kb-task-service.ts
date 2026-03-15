import {
  knowledgeBaseListResponseSchema,
  knowledgeBaseSchema,
  knowledgeBaseStatusResponseSchema,
  knowledgeTaskSchema,
  type KnowledgeBase,
  type KnowledgeTask
} from '@starlink/shared'

export type GatewayKnowledgeBase = {
  id: KnowledgeBase['id']
  workspaceId: KnowledgeBase['workspaceId']
  name: KnowledgeBase['name']
  status: KnowledgeBase['status']
  createdAt: KnowledgeBase['createdAt']
  updatedAt: KnowledgeBase['updatedAt']
  publishedAt?: KnowledgeBase['publishedAt']
}

export type GatewayKbTask = {
  id: KnowledgeTask['id']
  workspaceId: KnowledgeTask['workspaceId']
  kbId: KnowledgeTask['kbId']
  type: KnowledgeTask['type']
  status: KnowledgeTask['status']
  payload: Record<string, unknown>
  error?: KnowledgeTask['error']
  createdAt: KnowledgeTask['createdAt']
  updatedAt: KnowledgeTask['updatedAt']
}

const DEFAULT_TASK_SERVICE_BASE_URL = 'http://localhost:4001'

function getTaskServiceBaseUrl() {
  return process.env.KB_TASK_SERVICE_URL ?? DEFAULT_TASK_SERVICE_BASE_URL
}

export async function listKnowledgeBases(workspaceId: string): Promise<GatewayKnowledgeBase[]> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL('/kb', baseUrl)
  endpoint.searchParams.set('workspaceId', workspaceId)

  try {
    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      console.warn('[kb-task-service] failed to list knowledge bases', {
        status: response.status,
        statusText: response.statusText
      })
      return []
    }

    const payload = knowledgeBaseListResponseSchema.parse(await response.json())
    const items = Array.isArray(payload.knowledgeBases) ? payload.knowledgeBases : []
    return items.map((item) => ({
      id: item.id,
      workspaceId: item.workspaceId,
      name: item.name,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      publishedAt: item.publishedAt ?? null
    }))
  } catch (error) {
    console.warn('[kb-task-service] request failed', { error: String(error) })
    return []
  }
}

export async function createKnowledgeBase(workspaceId: string): Promise<GatewayKnowledgeBase> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL('/kb', baseUrl)

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId })
  })

  if (!response.ok) {
    throw new Error(`Failed to create knowledge base: ${response.status} ${response.statusText}`)
  }

  const payload = knowledgeBaseSchema.parse(await response.json())
  return {
    id: payload.id,
    workspaceId: payload.workspaceId,
    name: payload.name,
    status: payload.status,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    publishedAt: payload.publishedAt ?? null
  }
}

export async function publishKnowledgeBase(
  workspaceId: string,
  kbId: string
): Promise<GatewayKnowledgeBase> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL(`/kb/${kbId}/publish`, baseUrl)
  endpoint.searchParams.set('workspaceId', workspaceId)

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Failed to publish knowledge base: ${response.status} ${response.statusText}`)
  }

  const payload = knowledgeBaseSchema.parse(await response.json())
  return {
    id: payload.id,
    workspaceId: payload.workspaceId,
    name: payload.name,
    status: payload.status,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    publishedAt: payload.publishedAt ?? null
  }
}

export async function addKnowledgeSeed(
  workspaceId: string,
  kbId: string,
  text: string
): Promise<GatewayKbTask> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL(`/kb/${kbId}/seed`, baseUrl)
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, text })
  })

  if (!response.ok) {
    throw new Error(`Failed to add seed: ${response.status} ${response.statusText}`)
  }

  const payload = knowledgeTaskSchema.parse(await response.json())
  return {
    id: payload.id,
    workspaceId: payload.workspaceId,
    kbId: payload.kbId,
    type: payload.type,
    status: payload.status,
    payload: payload.payload ?? {},
    error: payload.error ?? null,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt
  }
}

export async function importKnowledgeUrl(
  workspaceId: string,
  kbId: string,
  url: string
): Promise<GatewayKbTask> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL(`/kb/${kbId}/import/url`, baseUrl)
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, url })
  })

  if (!response.ok) {
    throw new Error(`Failed to import url: ${response.status} ${response.statusText}`)
  }

  const payload = knowledgeTaskSchema.parse(await response.json())
  return {
    id: payload.id,
    workspaceId: payload.workspaceId,
    kbId: payload.kbId,
    type: payload.type,
    status: payload.status,
    payload: payload.payload ?? {},
    error: payload.error ?? null,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt
  }
}

export async function getKnowledgeBaseStatus(workspaceId: string, kbId: string): Promise<{
  knowledgeBase: GatewayKnowledgeBase
  tasks: GatewayKbTask[]
}> {
  const baseUrl = getTaskServiceBaseUrl()
  const endpoint = new URL(`/kb/${kbId}/status`, baseUrl)
  endpoint.searchParams.set('workspaceId', workspaceId)

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge base status: ${response.status} ${response.statusText}`)
  }

  const payload = knowledgeBaseStatusResponseSchema.parse(await response.json())
  if (!payload.knowledgeBase) {
    throw new Error('knowledgeBase missing in status response')
  }

  return {
    knowledgeBase: {
      id: payload.knowledgeBase.id,
      workspaceId: payload.knowledgeBase.workspaceId,
      name: payload.knowledgeBase.name,
      status: payload.knowledgeBase.status,
      createdAt: payload.knowledgeBase.createdAt,
      updatedAt: payload.knowledgeBase.updatedAt,
      publishedAt: payload.knowledgeBase.publishedAt ?? null
    },
    tasks: (payload.tasks ?? []).map((task) => ({
      id: task.id,
      workspaceId: task.workspaceId,
      kbId: task.kbId,
      type: task.type,
      status: task.status,
      payload: task.payload ?? {},
      error: task.error ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }))
  }
}
