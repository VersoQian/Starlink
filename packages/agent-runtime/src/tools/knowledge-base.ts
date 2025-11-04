import type { CanvasGraph, CanvasNode } from '@branching-chat/shared'

export type KnowledgeBaseRequest = {
  workspaceId: string
  query: string
}

export type KnowledgeBaseResult = {
  entries: Array<{
    id: string
    title: string
    summary: string
    url?: string
  }>
}

export interface KnowledgeBaseClient {
  search(input: KnowledgeBaseRequest): Promise<KnowledgeBaseResult>
}

export class MockKnowledgeBaseClient implements KnowledgeBaseClient {
  async search({ query }: KnowledgeBaseRequest): Promise<KnowledgeBaseResult> {
    return {
      entries: [
        {
          id: 'kb-1',
          title: `示例条目：${query}`,
          summary: '这里将返回与画布节点相关的知识库摘要。'
        }
      ]
    }
  }
}

export function hydrateGraphWithKnowledge(
  graph: CanvasGraph,
  knowledge: KnowledgeBaseResult
): CanvasGraph {
  if (graph.nodes.length === 0 || knowledge.entries.length === 0) return graph
  const [first, ...rest] = graph.nodes
  if (first.data.type !== 'note') {
    return graph
  }
  const updatedRoot: CanvasNode = {
    ...first,
    data: {
      ...first.data,
      bullets: knowledge.entries.map((entry) => `${entry.title}：${entry.summary}`)
    }
  }

  return {
    ...graph,
    nodes: [updatedRoot, ...rest]
  }
}
