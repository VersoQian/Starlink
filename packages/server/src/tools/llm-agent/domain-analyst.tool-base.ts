import { BaseTool } from '@starlink/shared'
import type { ToolDefinition, ToolContext, ToolMessage } from '@starlink/shared'
import { LLMClient } from '../../services/llm-client.js'
import { parseBmcAnalysisOutput } from './bmc-output.js'

type DomainAnalystConfig = {
  toolName: string
  label: string
  description: string
  color: string
  roleName: string
  roleTitle: string
  domains: string[]
  questionDescription: string
  evidenceEnabled?: boolean
}

export class DomainAnalystTool extends BaseTool {
  readonly definition: ToolDefinition
  private readonly systemPrompt: string

  constructor(private readonly config: DomainAnalystConfig) {
    super()
    this.definition = buildDefinition(config)
    this.systemPrompt = buildSystemPrompt(config)
  }

  async *execute(
    input: Record<string, unknown>,
    _context: ToolContext
  ): AsyncGenerator<ToolMessage> {
    const question = input.question as string
    const ctx = input.context as string | undefined
    const evidence = input.evidence as string[] | undefined

    let userContent = question
    if (ctx) userContent += `\n\n背景信息：${ctx}`
    if (this.config.evidenceEnabled && evidence && evidence.length > 0) {
      userContent += `\n\n参考证据：\n${evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    }

    const llm = new LLMClient()
    const response = await llm.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userContent }
      ]
    })

    const { bmcCards } = parseBmcAnalysisOutput(response.content)
    yield { type: 'json', data: { bmcCards } }
  }
}

function buildDefinition(config: DomainAnalystConfig): ToolDefinition {
  const properties: ToolDefinition['inputSchema']['properties'] = {
    question: {
      type: 'string',
      description: config.questionDescription,
      required: true
    },
    context: {
      type: 'string',
      description: '可选的上下文信息'
    }
  }

  const inputPorts: ToolDefinition['inputPorts'] = [
    { name: 'question', type: 'string', description: '用户问题' },
    { name: 'context', type: 'string', description: '上下文信息', required: false }
  ]

  if (config.evidenceEnabled) {
    properties.evidence = {
      type: 'array',
      description: '可选的支撑证据列表'
    }
    inputPorts.push({ name: 'evidence', type: 'array', description: '支撑证据', required: false })
  }

  return {
    identity: {
      name: config.toolName,
      provider: 'builtin',
      version: '1.0.0'
    },
    display: {
      label: config.label,
      description: config.description,
      icon: '🤖',
      category: 'llm_agent',
      color: config.color
    },
    inputSchema: {
      type: 'object',
      properties,
      required: ['question']
    },
    outputSchema: {
      type: 'object',
      properties: {
        bmcCards: {
          type: 'array',
          description: 'BMC 分析卡片数组，每项含 domain, content, confidence'
        }
      }
    },
    inputPorts,
    outputPorts: [
      { name: 'bmcCards', type: 'array', description: 'BMC 分析卡片' }
    ],
    runtime: {
      timeout: 60000,
      retries: 1,
      cacheable: false,
      streamable: true,
      parallel: true
    }
  }
}

function buildSystemPrompt(config: DomainAnalystConfig) {
  const domains = config.domains.join('、')
  return [
    `你是 ${config.roleName}（${config.roleTitle}），负责分析 CC-BMC 商业模型画布中的 ${config.domains.length} 个维度：${domains}。`,
    '根据用户问题生成结构化分析，每个维度包含 domain, content, confidence 字段。',
    `只输出 JSON 对象 { "bmcCards": [...] }，每个元素包含 domain（必须是 ${domains} 之一）、content（分析内容）、confidence（0-1 置信度）。`
  ].join('')
}

