import { z } from 'zod'
import { initializeAgentExecutorWithOptions, type AgentExecutor } from 'langchain/agents'
import { DynamicStructuredTool } from '@langchain/core/tools'
import type { BaseMessage } from '@langchain/core/messages'
import type { CanvasGraph } from '@branching-chat/shared'
import { TongyiChatModel } from '../llm/tongyi-chat.js'
import { DeepseekChatModel } from '../llm/deepseek-chat.js'
import { MockChatModel } from '../llm/mock-chat.js'
import {
  MockKnowledgeBaseClient,
  type KnowledgeBaseClient,
  type KnowledgeBaseResult
} from '../tools/knowledge-base.js'
import { createVisualizationAnalysisTool } from '../tools/visual-analysis.js'

export type StarlinkAgentContext = {
  workspaceId: string
  question: string
  graph?: CanvasGraph
  userId?: string
  history?: BaseMessage[]
  knowledgeClient?: KnowledgeBaseClient
}

function formatKnowledgeResult(result: KnowledgeBaseResult, limit: number) {
  if (result.entries.length === 0) {
    return '知识库未找到相关条目。'
  }
  return result.entries
    .slice(0, limit)
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.title}\n摘要：${entry.summary}\n来源：${entry.url ?? '知识库'}`
    )
    .join('\n\n')
}

function formatGraphOverview(graph?: CanvasGraph) {
  if (!graph || graph.nodes.length === 0) {
    return '当前画布为空。'
  }

  const nodeSummaries = graph.nodes
    .map((node) => {
      const meta = node.data
      if (meta.type === 'note') {
        return `节点(${node.id}) [Note] ${meta.title} · ${meta.content ?? ''}`
      }
      if (meta.type === 'task') {
        return `节点(${node.id}) [Task] ${meta.title} · 状态 ${meta.status ?? 'unknown'}`
      }
      if (meta.type === 'document') {
        return `节点(${node.id}) [Document] ${meta.title} · 引用 ${meta.references}`
      }
      if (meta.type === 'reference') {
        return `节点(${node.id}) [Reference] ${meta.title} · 来源 ${meta.source}`
      }
      return `节点(${node.id}) [${meta.type}] ${meta.title ?? ''}`
    })
    .join('\n')

  const edges = graph.edges
    .map((edge) => `连线(${edge.id}): ${edge.source} -> ${edge.target} ${edge.label ?? ''}`)
    .join('\n')

  return `画布概览：\n节点共 ${graph.nodes.length} 个。\n${nodeSummaries}\n\n连接共 ${graph.edges.length} 条。\n${edges}`
}

export async function createStarlinkAgentExecutor(
  context: StarlinkAgentContext
): Promise<AgentExecutor> {
  const knowledgeClient = context.knowledgeClient ?? new MockKnowledgeBaseClient()

  let llm
  if (process.env.DEEPSEEK_API_KEY) {
    llm = new DeepseekChatModel()
  } else if (
    process.env.DASHSCOPE_API_KEY ||
    process.env.TONGYI_API_KEY ||
    process.env.QWEN_API_KEY
  ) {
    llm = new TongyiChatModel()
  } else {
    console.warn(
      '[starlink-agent] No LLM credentials detected. Falling back to MockChatModel (offline mode).'
    )
    llm = new MockChatModel()
  }

  const searchKnowledgeTool = new DynamicStructuredTool({
    name: 'search_knowledge_base',
    description:
      '查询 Starlink 知识库以获取与当前议题相关的事实或参考资料。适用于补充论据、寻找引用、验证信息。',
    schema: z.object({
      query: z.string().describe('检索关键词，必须与当前讨论的问题相关'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .describe('返回结果条数，范围 1-5')
    }),
    func: async ({ query, limit }) => {
      const result = await knowledgeClient.search({
        workspaceId: context.workspaceId,
        query
      })
      return formatKnowledgeResult(result, limit)
    }
  })

  const canvasInspectorTool = new DynamicStructuredTool({
    name: 'inspect_canvas_graph',
    description:
      '查看当前 workspace 画布上的节点与连线，理解已经存在的拆解结构。在给出建议前使用，避免重复内容。',
    schema: z.object({
      focus: z
        .string()
        .describe('想要关注的节点类型或主题。例如「行动项」或某个节点 ID')
        .optional()
    }),
    func: async ({ focus }) => {
      const overview = formatGraphOverview(context.graph)
      return focus ? `关注点：${focus}\n\n${overview}` : overview
    }
  })

  const taskPlannerTool = new DynamicStructuredTool({
    name: 'propose_canvas_updates',
    description:
      '根据当前议题生成建议的画布更新，例如新增节点、补充行动或引用。仅输出建议结构，不直接写入画布。',
    schema: z.object({
      goal: z
        .string()
        .describe('希望达到的目标，例如「补充风险评估节点」或「完善行动计划」'),
      items: z
        .number()
        .int()
        .min(1)
        .max(5)
        .default(3)
        .describe('建议生成的节点数量，范围 1-5')
    }),
    func: async ({ goal, items }) => {
      const suggestions = Array.from({ length: items }).map((_, idx) => {
        return `建议 ${idx + 1}: 针对目标「${goal}」创建新的 Note 节点，包含标题、关键要点以及预期协作者。`
      })
      return suggestions.join('\n')
    }
  })

  const visualizationTool = createVisualizationAnalysisTool(llm)

  return initializeAgentExecutorWithOptions(
    [searchKnowledgeTool, canvasInspectorTool, taskPlannerTool, visualizationTool],
    llm,
    {
      agentType: 'structured-chat-zero-shot-react-description',
      verbose: false
    }
  )
}

export async function runStarlinkAgentTask(
  context: StarlinkAgentContext,
  task: string
) {
  const executor = await createStarlinkAgentExecutor(context)
  return executor.invoke({
    input: `任务描述：${task}

上下文：
- 工作区：${context.workspaceId}
- 发起人：${context.userId ?? 'anonymous'}
- 核心问题：「${context.question}」

请按需调用工具，然后给出结构化建议，最后总结下一步行动。`
  })
}
