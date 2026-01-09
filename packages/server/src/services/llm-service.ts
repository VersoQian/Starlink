import { createAuditLogger } from '@starlink/shared'

const auditLogger = createAuditLogger('packages/server:llm-service')

export type GraphGenerationResult = {
    summary: string
    branches: Array<{
        title: string
        content: string
        dimensions: Array<{
            title: string
            content: string
            actions?: Array<{
                title: string
                content: string
            }>
        }>
    }>
}

type LLMConfig = {
    apiKey: string
    baseURL: string
    model: string
}

const SYSTEM_PROMPT = `你是一个专业的任务分析助手，擅长将复杂问题拆解为结构化的执行计划。
你的任务是分析用户提出的问题，然后按照以下结构返回 JSON：
{
  "summary": "对问题的简短总结（2-3句话）",
  "branches": [
    {
      "title": "分支标题（如：关键目标、核心挑战）",
      "content": "分支详细描述",
      "dimensions": [
        {
          "title": "维度标题（如：价值主张、执行路径）",
          "content": "维度描述",
          "actions": [
            { "title": "行动点标题", "content": "具体行动描述" }
          ]
        }
      ]
    }
  ]
}
要求：
1. summary 要简洁明了，直击问题核心
2. 至少生成 3 个分支
3. 每个分支至少 2 个维度
4. 必须返回纯 JSON，不要有任何其他文字
`

export class LLMService {
    private config: LLMConfig

    constructor() {
        this.config = {
            apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '',
            baseURL: process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
            model: process.env.LLM_MODEL || 'gpt-4o-mini'
        }
    }

    isConfigured(): boolean {
        return Boolean(this.config.apiKey)
    }

    async generateGraphData(question: string, user?: string): Promise<GraphGenerationResult> {
        if (!this.isConfigured()) {
            return this.getMockData(question)
        }

        try {
            const response = await fetch(`${this.config.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: question }
                    ],
                    temperature: 0.7
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`LLM API error: ${response.status} - ${errorText}`)
            }

            const data = await response.json()
            const content = data.choices?.[0]?.message?.content

            if (!content) {
                throw new Error('Empty response from LLM')
            }

            // Clean up potential markdown code blocks
            const jsonString = content.replace(/```json\n?|\n?```/g, '').trim()

            try {
                return JSON.parse(jsonString) as GraphGenerationResult
            } catch (e) {
                console.warn('Failed to parse LLM JSON:', jsonString)
                // Fallback to a simple structure wrapping the text if parsing fails
                return {
                    summary: content,
                    branches: []
                }
            }

        } catch (error) {
            auditLogger.error({
                action: 'llm.generateGraphData',
                userId: user ?? 'server',
                metadata: { question, error: String(error) }
            })

            // Fallback to mock data on error, or could rethrow
            return this.getMockData(question, `生成失败: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    private getMockData(question: string, errorMsg?: string): GraphGenerationResult {
        return {
            summary: errorMsg || `[Mock] 针对「${question}」的分析摘要 (LLM 未配置)`,
            branches: [
                {
                    title: '示例分支 1',
                    content: '这是未配置 LLM 时的默认分支',
                    dimensions: [
                        {
                            title: '示例维度 A',
                            content: '维度描述...',
                            actions: [{ title: '示例行动 1', content: '行动描述...' }]
                        }
                    ]
                }
            ]
        }
    }
}
