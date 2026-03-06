'use server'

import { NextResponse } from 'next/server'
import { readEnv } from '@/shared/lib/env'

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
    const uploaded = await uploadFileToDify({ file, apiKey, userId })
    const fileId = resolveFileId(uploaded)

    if (process.env.NODE_ENV !== 'production') {
      console.log('[file-translation] upload response', { uploaded, fileId })
    }

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
  apiKey,
  userId
}: {
  file: File
  apiKey: string
  userId: string
}): Promise<DifyFileUploadResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('user', userId)

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

  const filePayload = {
    transfer_method: 'local_file',
    upload_file_id: fileId,
    type: 'document',
    name: fileName
  }

  const payload: Record<string, unknown> = {
    response_mode: 'streaming',
    user: userId,
    inputs: {
      target_language: targetLanguage,
      instructions: instructions || undefined,
      preset: preset || undefined,
      // Dify workflow may name the file variable either `File` (single file)
      // or `text` (array of files); provide both forms to stay compatible.
      File: filePayload,
      text: [filePayload]
    },
    files: [
      {
        transfer_method: 'local_file',
        upload_file_id: fileId,
        type: 'document',
        name: fileName
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

  // 处理流式响应
  if (!response.body) {
    throw new Error('响应体为空')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let accumulatedText = ''
  let usage: { total_tokens?: number } | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)

            // 累积文本内容
            if (parsed.answer) {
              accumulatedText += parsed.answer
            }

            // 提取token使用情况
            if (parsed.usage) {
              usage = parsed.usage
            }

            // 处理不同格式的响应
            if (parsed.data) {
              if (typeof parsed.data === 'string') {
                accumulatedText += parsed.data
              } else if (parsed.data.text) {
                accumulatedText += parsed.data.text
              }
            }

          } catch {
            // 忽略解析错误，继续处理下一行
            continue
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return {
    answer: accumulatedText || 'Dify 未返回翻译内容，请检查工作流节点配置。',
    usage
  } as DifyWorkflowResult
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
  } else if (result.outputs && typeof result.outputs === 'object') {
    const outputsRecord = result.outputs as Record<string, unknown>
    for (const value of Object.values(outputsRecord)) {
      if (typeof value === 'string') {
        candidates.push(value)
        continue
      }
      if (value && typeof value === 'object') {
        const nested = value as Record<string, unknown>
        candidates.push(nested.translation, nested.translated_text, nested.answer, nested.text)
      }
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
    const record = data as Record<string, unknown>
    const maybeText = record.translation ?? record.text ?? record.answer
    if (typeof maybeText === 'string') {
      candidates.push(maybeText)
    }
    const outputs = record.outputs
    if (outputs && typeof outputs === 'object') {
      if (Array.isArray(outputs)) {
        for (const item of outputs) {
          if (typeof item === 'string') {
            candidates.push(item)
          } else if (item && typeof item === 'object') {
            const nested = item as Record<string, unknown>
            candidates.push(nested.translation, nested.translated_text, nested.answer, nested.text)
          }
        }
      } else {
        for (const value of Object.values(outputs as Record<string, unknown>)) {
          if (typeof value === 'string') {
            candidates.push(value)
          } else if (value && typeof value === 'object') {
            const nested = value as Record<string, unknown>
            candidates.push(nested.translation, nested.translated_text, nested.answer, nested.text)
          }
        }
      }
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
