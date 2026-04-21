import {
  BaseTool,
  type ToolDefinition,
  type ToolContext,
  type ToolMessage,
} from '@starlink/shared'
import { searchKnowledgeBase } from '../../services/kb-task-service.js'

export default class KnowledgeBaseTool extends BaseTool {
  readonly definition: ToolDefinition = {
    identity: {
      name: 'knowledge-base',
      provider: 'builtin',
      version: '1.0.0',
    },
    display: {
      label: '知识库检索',
      description: '从知识库中检索与查询最相关的文档片段',
      icon: '📚',
      category: 'data_source',
      color: '#3b82f6',
    },
    inputSchema: {
      type: 'object',
      properties: {
        kbId: {
          type: 'string',
          description: '知识库ID',
          required: true,
        },
        query: {
          type: 'string',
          description: '检索查询文本',
          required: true,
        },
        topK: {
          type: 'number',
          description: '返回最相关的结果数量',
          default: 5,
        },
      },
      required: ['kbId', 'query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', description: '检索结果列表' },
        kbId: { type: 'string', description: '知识库ID' },
      },
    },
    inputPorts: [
      { name: 'kbId', type: 'string', description: '知识库ID', required: true },
      { name: 'query', type: 'string', description: '检索查询文本', required: true },
      { name: 'topK', type: 'number', description: '返回结果数量', default: 5 },
    ],
    outputPorts: [
      { name: 'results', type: 'array', description: '检索结果列表' },
      { name: 'kbId', type: 'string', description: '知识库ID' },
    ],
    runtime: {
      timeout: 30000,
      retries: 1,
      cacheable: true,
      streamable: false,
      parallel: true,
    },
  }

  async *execute(
    input: Record<string, unknown>,
    _context: ToolContext,
  ): AsyncGenerator<ToolMessage> {
    const kbId = input.kbId as string
    const query = input.query as string
    const topK = (input.topK as number) ?? 5

    yield { type: 'progress', percent: 0, message: '正在检索知识库…' }

    const results = await searchKnowledgeBase(
      _context.workspaceId,
      kbId,
      query,
      Math.max(1, Math.min(20, Math.floor(topK)))
    )

    yield { type: 'progress', percent: 100, message: '检索完成' }
    yield {
      type: 'json',
      data: {
        results: results.map((result) => ({
          docId: result.docId,
          snippet: result.snippet,
          score: result.score,
          metadata: result.metadata ?? {}
        })),
        kbId
      }
    }
  }
}
