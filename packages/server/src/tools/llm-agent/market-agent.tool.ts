/**
 * Market Agent Tool — analyzes CC-BMC dimensions:
 * customer segments, channels, and customer relationships.
 */

import { BaseTool } from '@starlink/shared'
import type { ToolDefinition, ToolContext, ToolMessage } from '@starlink/shared'
import { LLMClient } from '../../services/llm-client.js'

const SYSTEM_PROMPT =
  '你是 Market_Agent（市场分析专家），负责分析 CC-BMC 商业模型画布中的三个维度：客户细分、渠道通路、客户关系。' +
  '根据用户问题生成结构化分析，每个维度包含 domain, content, confidence 字段。' +
  '以 JSON 格式输出 { "bmcCards": [...] }，每个元素包含 domain（维度名称）、content（分析内容）、confidence（0-1 置信度）。'

export default class MarketAgentTool extends BaseTool {
  readonly definition: ToolDefinition = {
    identity: {
      name: 'market_agent',
      provider: 'builtin',
      version: '1.0.0',
    },
    display: {
      label: '市场分析 Agent',
      description: '分析 CC-BMC 商业模型画布中的客户细分、渠道通路、客户关系维度',
      icon: '🤖',
      category: 'llm_agent',
      color: '#f59e0b',
    },
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '用户的市场分析问题',
          required: true,
        },
        context: {
          type: 'string',
          description: '可选的上下文信息',
        },
        evidence: {
          type: 'array',
          description: '可选的支撑证据列表',
        },
      },
      required: ['question'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        bmcCards: {
          type: 'array',
          description: 'BMC 分析卡片数组，每项含 domain, content, confidence',
        },
      },
    },
    inputPorts: [
      { name: 'question', type: 'string', description: '用户问题' },
      { name: 'context', type: 'string', description: '上下文信息', required: false },
      { name: 'evidence', type: 'array', description: '支撑证据', required: false },
    ],
    outputPorts: [
      { name: 'bmcCards', type: 'array', description: 'BMC 分析卡片' },
    ],
    runtime: {
      timeout: 60000,
      retries: 1,
      cacheable: false,
      streamable: true,
      parallel: true,
    },
  }

  async *execute(
    input: Record<string, unknown>,
    _context: ToolContext,
  ): AsyncGenerator<ToolMessage> {
    const question = input.question as string
    const ctx = input.context as string | undefined
    const evidence = input.evidence as string[] | undefined

    let userContent = question
    if (ctx) userContent += `\n\n背景信息：${ctx}`
    if (evidence && evidence.length > 0) {
      userContent += `\n\n参考证据：\n${evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    }

    const llm = new LLMClient()
    const response = await llm.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    })

    let bmcCards: Array<{ domain: string; content: string; confidence: number }>
    try {
      const parsed = JSON.parse(response.content ?? '{}')
      bmcCards = parsed.bmcCards ?? []
    } catch {
      bmcCards = [
        {
          domain: '综合分析',
          content: response.content ?? '',
          confidence: 0.5,
        },
      ]
    }

    yield { type: 'json', data: { bmcCards } }
  }
}
