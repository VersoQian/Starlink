const ROOT_OFFSET = { x: 160, y: 160 };
export function buildInitialState(ctx) {
    const rootNode = {
        id: createNodeId('root'),
        type: 'note',
        position: { x: ROOT_OFFSET.x, y: ROOT_OFFSET.y },
        data: {
            type: 'note',
            title: '多维画布任务',
            subtitle: 'Branching Canvas 起点',
            content: `当前议题：「${ctx.question}」。我们会一起梳理目标、关键维度与行动方案。`,
            footerText: '对话即画布 · 节点会随着推理逐步出现',
            variant: 'primary'
        }
    };
    const graph = {
        workspaceId: ctx.workspaceId,
        nodes: [rootNode],
        edges: []
    };
    const deltas = [{ nodes: [rootNode] }];
    return {
        context: ctx,
        graph,
        deltas
    };
}
export function pushNode(state, node, edge) {
    state.graph.nodes.push(node);
    if (edge) {
        state.graph.edges.push(edge);
    }
    state.deltas.push({ nodes: [node], edges: edge ? [edge] : undefined });
}
export function pushNodes(state, nodes, edges) {
    state.graph.nodes.push(...nodes);
    state.graph.edges.push(...edges);
    state.deltas.push({ nodes, edges });
}
export function createNodeId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
