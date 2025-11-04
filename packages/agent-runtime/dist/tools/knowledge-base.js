export class MockKnowledgeBaseClient {
    async search({ query }) {
        return {
            entries: [
                {
                    id: 'kb-1',
                    title: `示例条目：${query}`,
                    summary: '这里将返回与画布节点相关的知识库摘要。'
                }
            ]
        };
    }
}
export function hydrateGraphWithKnowledge(graph, knowledge) {
    if (graph.nodes.length === 0 || knowledge.entries.length === 0)
        return graph;
    const [first, ...rest] = graph.nodes;
    if (first.data.type !== 'note') {
        return graph;
    }
    const updatedRoot = {
        ...first,
        data: {
            ...first.data,
            bullets: knowledge.entries.map((entry) => `${entry.title}：${entry.summary}`)
        }
    };
    return {
        ...graph,
        nodes: [updatedRoot, ...rest]
    };
}
