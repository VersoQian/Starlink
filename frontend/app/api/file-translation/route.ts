'use server'

import { NextResponse } from 'next/server'
import { readEnv } from '@/lib/env'

const FALLBACK_ERROR = '文件翻译工作流暂未配置，请联系管理员补充 Dify 凭据。'

const DEFAULT_BASE_URL = readEnv('DIFY_API_BASE_URL', {
  defaultValue: 'https://api.dify.ai/v1'
})

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with multipart/form-data (file, targetLanguage, etc.) to call this endpoint.',
    examples: [
      'curl -X POST http://localhost:3000/api/file-translation -F "file=@/path/doc.pdf" -F "targetLanguage=English"'
    ]
  })
}

type DifyFileUploadResponse = {
  id?: string
  data?: {
    id?: string
    file_id?: string
  }
  file_id?: string
}

type DifyWorkflowResult = {
  answer?: string
  data?: unknown
  outputs?: Array<Record<string, unknown>>
  usage?: {
    total_tokens?: number
  }
}

export async function POST(request: Request) {
  const appId = readEnv('DIFY_FILE_TRANSLATION_APP_ID')
  const apiKey = readEnv('DIFY_FILE_TRANSLATION_API_KEY')

  if (process.env.NODE_ENV !== 'production') {
    console.log('[file-translation] env check', {
      hasApiKey: Boolean(apiKey),
      hasAppId: Boolean(appId)
    })
  }

  if (!apiKey) {
    return NextResponse.json({ message: FALLBACK_ERROR }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const targetLanguage = String(formData.get('targetLanguage') ?? '').trim()
  const instructions = String(formData.get('instructions') ?? '').trim()
  const preset = String(formData.get('preset') ?? '').trim()
  const userId = String(formData.get('userId') ?? 'file-translation')

  if (!(file instanceof File)) {
    return NextResponse.json({ message: '请上传需要翻译的文件。' }, { status: 400 })
  }

  if (!targetLanguage) {
    return NextResponse.json({ message: '请填写目标语言。' }, { status: 400 })
  }

  try {
    const uploaded = await uploadFileToDify({ file, apiKey })
    const fileId = resolveFileId(uploaded)

    if (!fileId) {
      return NextResponse.json(
        { message: 'Dify 未返回文件 ID，请检查工作流配置。' },
        { status: 502 }
      )
    }

    const workflowResult = await runFileTranslationWorkflow({
      apiKey,
      appId,
      baseUrl: DEFAULT_BASE_URL,
      fileId,
      fileName: file.name,
      targetLanguage,
      instructions,
      preset,
      userId
    })

    const translation = extractTranslation(workflowResult)

    return NextResponse.json({
      translation,
      usage: workflowResult.usage,
      raw: workflowResult
    })
  } catch (error) {
    console.error('[api/file-translation] failed', error)
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : '文件翻译失败，请稍后重试。'
      },
      { status: 500 }
    )
  }
}

async function uploadFileToDify({
  file,
  apiKey
}: {
  file: File
  apiKey: string
}): Promise<DifyFileUploadResponse> {
  const form = new FormData()
  form.append('file', file, file.name)

  const response = await fetch(`${stripTrailingSlash(DEFAULT_BASE_URL)}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const detail = await safeReadText(response)
    throw new Error(
      `上传文件失败（${response.status} ${response.statusText}）：${detail ?? '无错误详情'}`
    )
  }

  return (await response.json()) as DifyFileUploadResponse
}

async function runFileTranslationWorkflow({
  apiKey,
  appId,
  baseUrl,
  fileId,
  fileName,
  targetLanguage,
  instructions,
  preset,
  userId
}: {
  apiKey: string
  appId?: string
  baseUrl: string
  fileId: string
  fileName: string
  targetLanguage: string
  instructions?: string
  preset?: string
  userId?: string
}): Promise<DifyWorkflowResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }
  if (appId) {
    headers['x-app-id'] = appId
  }

  const payload: Record<string, unknown> = {
    response_mode: 'blocking',
    user: userId,
    inputs: {
      target_language: targetLanguage,
      instructions: instructions || undefined,
      preset: preset || undefined,
      text: [
        {
          type: 'file',
          file_id: fileId,
          name: fileName
        }
      ]
    },
    files: [
      {
        file_id: fileId,
        name: fileName,
        type: 'document'
      }
    ]
  }

  if (appId) {
    payload.workflow_id = appId
  }

  const response = await fetch(`${stripTrailingSlash(baseUrl)}/workflows/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const detail = await safeReadText(response)
    throw new Error(
      `翻译工作流执行失败（${response.status} ${response.statusText}）：${
        detail ?? '无错误详情'
      }${appId ? '' : '（可尝试在 .env.local 中补充 DIFY_FILE_TRANSLATION_APP_ID）'}`
    )
  }

  return (await response.json()) as DifyWorkflowResult
}

function extractTranslation(result: DifyWorkflowResult): string {
  const candidates: unknown[] = []

  if (typeof result.answer === 'string') {
    candidates.push(result.answer)
  }

  if (Array.isArray(result.outputs)) {
    for (const output of result.outputs) {
      const values = [
        output?.translation,
        output?.translated_text,
        output?.answer,
        output?.text
      ]
      candidates.push(...values)
    }
  }

  const data = result.data
  if (typeof data === 'string') {
    candidates.push(data)
  } else if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === 'string') {
        candidates.push(item)
      } else if (item && typeof item === 'object') {
        const maybeText =
          (item as Record<string, unknown>).translation ??
          (item as Record<string, unknown>).text ??
          (item as Record<string, unknown>).answer
        if (typeof maybeText === 'string') {
          candidates.push(maybeText)
        }
      }
    }
  } else if (data && typeof data === 'object') {
    const maybeText =
      (data as Record<string, unknown>).translation ??
      (data as Record<string, unknown>).text ??
      (data as Record<string, unknown>).answer
    if (typeof maybeText === 'string') {
      candidates.push(maybeText)
    }
  }

  const translation = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )

  return translation ?? 'Dify 未返回翻译内容，请检查工作流节点配置。'
}

function resolveFileId(payload: DifyFileUploadResponse): string | null {
  if (payload.file_id) return payload.file_id
  if (typeof payload.id === 'string' && payload.id) return payload.id
  if (payload.data) {
    if (typeof payload.data.file_id === 'string' && payload.data.file_id) {
      return payload.data.file_id
    }
    if (typeof payload.data.id === 'string' && payload.data.id) {
      return payload.data.id
    }
  }
  return null
}

async function safeReadText(response: Response): Promise<string | null> {
  try {
    return await response.text()
  } catch {
    return null
  }
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}
