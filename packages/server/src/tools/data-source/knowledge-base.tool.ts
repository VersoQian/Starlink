import {
  BaseTool,
  type ToolDefinition,
  type ToolContext,
  type ToolMessage,
} from '@starlink/shared'

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
      required: ['kbId', 'query', 'topK'],
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

    // Placeholder: generate mock results until real vector store is integrated
    const results = Array.from({ length: topK }, (_, i) => ({
      id: `doc-${kbId}-${i + 1}`,
      content: `这是知识库 ${kbId} 中与"${query}"相关的模拟文档片段 #${i + 1}`,
      score: Number((1 - i * 0.1).toFixed(2)),
      metadata: {
        source: `knowledge-base/${kbId}/chunk-${i + 1}.txt`,
        page: i + 1,
      },
    }))

    yield { type: 'progress', percent: 100, message: '检索完成（模拟数据）' }
    yield { type: 'json', data: { results, kbId } }
  }
}
