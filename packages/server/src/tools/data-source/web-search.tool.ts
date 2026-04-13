import {
  BaseTool,
  type ToolDefinition,
  type ToolContext,
  type ToolMessage,
} from '@starlink/shared'

export default class WebSearchTool extends BaseTool {
  readonly definition: ToolDefinition = {
    identity: {
      name: 'web-search',
      provider: 'builtin',
      version: '1.0.0',
    },
    display: {
      label: '网络搜索',
      description: '通过搜索引擎查询关键词，返回相关网页结果列表',
      icon: '🔍',
      category: 'data_source',
      color: '#3b82f6',
    },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
          required: true,
        },
        maxResults: {
          type: 'number',
          description: '最大返回结果数量',
          default: 10,
        },
      },
      required: ['query', 'maxResults'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: { type: 'array', description: '搜索结果列表' },
      },
    },
    inputPorts: [
      { name: 'query', type: 'string', description: '搜索关键词', required: true },
      { name: 'maxResults', type: 'number', description: '最大返回结果数量', default: 10 },
    ],
    outputPorts: [
      { name: 'results', type: 'array', description: '搜索结果列表' },
    ],
    credentials: {
      type: 'api_key',
      fields: [
        {
          name: 'serpApiKey',
          label: 'SerpAPI Key',
          type: 'string',
          required: false,
          placeholder: '留空则使用模拟数据',
        },
      ],
    },
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
    context: ToolContext,
  ): AsyncGenerator<ToolMessage> {
    const query = input.query as string
    const maxResults = (input.maxResults as number) ?? 10
    const apiKey = context.credentials?.serpApiKey

    yield { type: 'progress', percent: 0, message: '开始搜索…' }

    if (apiKey) {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=${maxResults}&api_key=${apiKey}`
      try {
        const res = await fetch(url, { signal: context.abortSignal })
        if (!res.ok) {
          yield { type: 'error', error: `SerpAPI 请求失败: ${res.status}`, retryable: true }
          return
        }
        const data = (await res.json()) as Record<string, unknown>
        const organic = (data.organic_results ?? []) as Array<Record<string, unknown>>
        const results = organic.slice(0, maxResults).map((r) => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
        }))
        yield { type: 'progress', percent: 100, message: '搜索完成' }
        yield { type: 'json', data: { results } }
      } catch (err) {
        yield { type: 'error', error: `搜索请求异常: ${(err as Error).message}`, retryable: true }
      }
    } else {
      // Mock results when no API key is provided
      const results = Array.from({ length: Math.min(maxResults, 5) }, (_, i) => ({
        title: `搜索结果 ${i + 1}: ${query}`,
        link: `https://example.com/result/${i + 1}`,
        snippet: `这是关于"${query}"的模拟搜索结果摘要 #${i + 1}`,
      }))
      yield { type: 'progress', percent: 100, message: '搜索完成（模拟数据）' }
      yield { type: 'json', data: { results } }
    }
  }
}
