import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type {
  BaseChatModel,
  BaseChatModelCallOptions
} from '@langchain/core/language_models/chat_models'
import { DeepseekChatModel } from '../llm/deepseek-chat.js'
import { TongyiChatModel } from '../llm/tongyi-chat.js'
import { MockChatModel } from '../llm/mock-chat.js'

export const visualizationChartTypes = [
  'bar',
  'line',
  'pie',
  'stacked_bar',
  'area',
  'scatter',
  'table',
  'geo'
] as const

export type VisualizationChartType = (typeof visualizationChartTypes)[number]

export type VisualizationAnalysisRequest = {
  datasetSummary: string
  goal: string
  preferredVisuals?: VisualizationChartType[]
  audience?: 'executive' | 'marketing' | 'product' | 'general'
  emphasizeNarrative?: boolean
  constraints?: string
}

export type VisualizationAnalysisChart = {
  type: VisualizationChartType
  title: string
  description: string
  xField: string
  yField?: string
  breakdownField?: string
  notes?: string[]
}

export type VisualizationAnalysisResult = {
  charts: VisualizationAnalysisChart[]
  insights: string[]
  narrative?: string
  followUpActions?: string[]
  checks?: string[]
}

type VisualizationModelOptions = BaseChatModelCallOptions & {
  responseFormat?: 'json' | 'text'
}

export function resolveVisualizationModel(): BaseChatModel<VisualizationModelOptions> {
  if (process.env.DEEPSEEK_API_KEY) {
    return new DeepseekChatModel({
      temperature: Number(process.env.DEEPSEEK_TEMPERATURE ?? '0.1')
    })
  }

  if (
    process.env.DASHSCOPE_API_KEY ||
    process.env.TONGYI_API_KEY ||
    process.env.QWEN_API_KEY
  ) {
    return new TongyiChatModel({
      temperature: Number(process.env.TONGYI_TEMPERATURE ?? '0.1')
    })
  }

  return new MockChatModel()
}

export async function runVisualizationAnalysis(
  input: VisualizationAnalysisRequest,
  llm: BaseChatModel<VisualizationModelOptions> = resolveVisualizationModel()
): Promise<VisualizationAnalysisResult> {
  const systemPrompt = new SystemMessage(
    [
      'You are an expert data visualization planner for the Starlink research assistant.',
      'You receive structured summaries of tabular data and business goals.',
      'Return analysis strictly as JSON following this schema:',
      JSON.stringify(
        {
          charts: [
            {
              type: 'bar | line | pie | stacked_bar | area | scatter | table | geo',
              title: 'string',
              description: 'string',
              xField: 'string',
              yField: 'string (optional for pie/table/geo)',
              breakdownField: 'string (optional)',
              notes: ['string']
            }
          ],
          insights: ['string'],
          narrative: 'string',
          followUpActions: ['string'],
          checks: ['string']
        },
        null,
        2
      ),
      'Focus on culturally aware insights when relevant. Do not include Markdown fences.'
    ].join('\n')
  )

  const preferred = input.preferredVisuals?.length
    ? `Preferred visuals: ${input.preferredVisuals.join(', ')}.`
    : 'Preferred visuals: analyst has not specified.'
  const audience = input.audience
    ? `Target audience: ${input.audience}.`
    : 'Audience: general stakeholders.'
  const emphasizeNarrative = input.emphasizeNarrative ? 'Provide a rich narrative summary.' : 'Keep narrative concise.'
  const constraints = input.constraints ? `Constraints or caveats: ${input.constraints}` : ''

  const humanPrompt = new HumanMessage(
    [
      `Analysis goal: ${input.goal}`,
      preferred,
      audience,
      emphasizeNarrative,
      constraints,
      'Dataset synopsis:',
      input.datasetSummary
    ]
      .filter(Boolean)
      .join('\n')
  )

  const result = await llm.generate([[systemPrompt, humanPrompt]], {
    responseFormat: 'json'
  })

  const generation = result.generations[0]?.[0]
  const rawText = generation?.text ?? ''

  try {
    const parsed = JSON.parse(rawText) as VisualizationAnalysisResult
    return parsed
  } catch (error) {
    return {
      charts: [],
      insights: [
        '模型未返回有效 JSON。以下为原始响应：',
        rawText.trim() || '（空响应）'
      ],
      narrative: '可视化分析失败，请检查输入后重试。',
      followUpActions: [
        '验证数据摘要格式是否正确。',
        '确认 DeepSeek 或同义千问 API 是否可用。'
      ],
      checks: error instanceof Error ? [error.message] : []
    }
  }
}

export function createVisualizationAnalysisTool(
  llm: BaseChatModel<VisualizationModelOptions>
) {
  return new DynamicStructuredTool({
    name: 'generate_visualization_analysis',
    description:
      '根据数据摘要与业务目标规划可视化图表，并产出分析洞察。返回结构化 JSON，可用于前端渲染。',
    schema: z.object({
      datasetSummary: z
        .string()
        .min(10)
        .describe('表格或数据集的关键信息摘要，包含字段含义与样例值。'),
      goal: z
        .string()
        .min(5)
        .describe('希望回答的问题或可视化的商务目标。'),
      preferredVisuals: z
        .array(z.enum(visualizationChartTypes))
        .min(1)
        .max(4)
        .optional()
        .describe('可选，指定偏好的图表类型列表。'),
      audience: z
        .enum(['executive', 'marketing', 'product', 'general'])
        .optional()
        .describe('主要受众类型，用于调整故事叙述。'),
      emphasizeNarrative: z
        .boolean()
        .optional()
        .describe('是否需要详细的叙事性总结。'),
      constraints: z
        .string()
        .optional()
        .describe('可选，任何限制条件或需要注意的细节。')
    }),
    func: async (input) => {
      const analysis = await runVisualizationAnalysis(input, llm)
      return JSON.stringify(analysis, null, 2)
    }
  })
}
