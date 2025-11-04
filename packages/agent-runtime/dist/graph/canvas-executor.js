import { buildInitialState, createNodeId, pushNode } from './initial-state.js';
import { MockKnowledgeBaseClient, hydrateGraphWithKnowledge } from '../tools/knowledge-base.js';
const SUB_QUESTION_BLUEPRINTS = [
    {
        title: '澄清目标与边界',
        bullets: ['关键目标是什么？', '价值指标如何衡量？', '重要限制或约束有哪些？']
    },
    {
        title: '拆分关键维度',
        bullets: ['涉及哪些参与方？', '目前有哪些已知信息？', '潜在的未知或风险点？']
    },
    {
        title: '识别资源与数据',
        bullets: ['有哪些可直接利用的资料？', '需要补充的调研是什么？', '数据同步与责任人是谁？']
    }
];
const DIMENSION_BLUEPRINTS = [
    {
        title: '价值主张与用户场景',
        bullets: ['目标用户痛点', '拟提供的价值组合', '成功衡量指标'],
        subCategory: 'value_proposition'
    },
    {
        title: '路径与执行机制',
        bullets: ['关键活动/步骤', '所需协同角色', '可能的阻塞点'],
        subCategory: 'channels'
    },
    {
        title: '数据与验证计划',
        bullets: ['需要验证的假设', '优先采集的数据', '验证时间线'],
        subCategory: 'key_resources'
    }
];
const ACTION_BLUEPRINTS = [
    {
        title: '补齐事实基础',
        bullets: ['梳理现有资料并标记可信度', '盘点关键假设是否成立', '收集团队已有结论']
    },
    {
        title: '设计验证活动',
        bullets: ['列出必须访谈或调研的对象', '设置观察指标与成功阈值', '准备复盘时间点']
    },
    {
        title: '建立复用模板',
        bullets: ['沉淀模板/清单供未来复用', '明确后续责任人和协作路径', '安排下一次 Branching 对话']
    }
];
export async function runCanvasPipeline(context, options = {}) {
    const knowledgeClient = options.knowledgeClient ?? new MockKnowledgeBaseClient();
    let state = buildInitialState(context);
    state = await addSubQuestions(state);
    state = await addDimensions(state);
    state = await addActionPlan(state);
    state = await enrichWithKnowledge(state, knowledgeClient);
    return {
        graph: state.graph,
        deltas: state.deltas
    };
}
async function addSubQuestions(state) {
    const baseY = state.graph.nodes[0]?.position.y ?? 160;
    const baseX = state.graph.nodes[0]?.position.x ?? 160;
    const spacing = 320;
    SUB_QUESTION_BLUEPRINTS.forEach((blueprint, index) => {
        const node = {
            id: createNodeId('subquestion'),
            type: 'note',
            position: { x: baseX + spacing * (index + 1), y: baseY },
            data: {
                type: 'note',
                title: `分支 ${index + 1} · ${blueprint.title}`,
                content: `围绕「${state.context.question}」，聚焦这一分支并记录讨论要点。`,
                bullets: blueprint.bullets,
                variant: 'timeline-step'
            }
        };
        const edge = {
            id: `${state.graph.nodes[0]?.id ?? 'root'}->${node.id}`,
            source: state.graph.nodes[0]?.id ?? node.id,
            target: node.id,
            label: `主题 ${index + 1}`
        };
        pushNode(state, node, edge);
    });
    return state;
}
async function addDimensions(state) {
    const root = state.graph.nodes[0];
    if (!root)
        return state;
    const existingBranches = state.graph.nodes.filter((node) => node.id !== root.id && node.data.type === 'note');
    existingBranches.forEach((branch, index) => {
        const blueprint = DIMENSION_BLUEPRINTS[index % DIMENSION_BLUEPRINTS.length];
        const node = {
            id: createNodeId('dimension'),
            type: 'note',
            position: { x: branch.position.x, y: branch.position.y + 220 },
            data: {
                type: 'note',
                title: blueprint.title,
                content: `从该维度拆解「${state.context.question}」。`,
                bullets: blueprint.bullets,
                variant: 'timeline-dimension',
                subCategory: blueprint.subCategory
            }
        };
        const edge = {
            id: `${branch.id}->${node.id}`,
            source: branch.id,
            target: node.id,
            label: '分析维度'
        };
        pushNode(state, node, edge);
    });
    return state;
}
async function addActionPlan(state) {
    const dimensionNodes = state.graph.nodes.filter((node) => node.data.type === 'note' && node.data.variant === 'timeline-dimension');
    dimensionNodes.forEach((dimension, index) => {
        const blueprint = ACTION_BLUEPRINTS[index % ACTION_BLUEPRINTS.length];
        const node = {
            id: createNodeId('action'),
            type: 'note',
            position: { x: dimension.position.x, y: dimension.position.y + 220 },
            data: {
                type: 'note',
                title: blueprint.title,
                bullets: blueprint.bullets,
                variant: 'timeline-action',
                content: '完成后请在节点评论里更新进展。'
            }
        };
        const edge = {
            id: `${dimension.id}->${node.id}`,
            source: dimension.id,
            target: node.id,
            label: '行动计划'
        };
        pushNode(state, node, edge);
    });
    return state;
}
async function enrichWithKnowledge(state, knowledgeClient) {
    const knowledge = await knowledgeClient.search({
        workspaceId: state.context.workspaceId,
        query: state.context.question
    });
    const enrichedGraph = hydrateGraphWithKnowledge(state.graph, knowledge);
    state.graph = enrichedGraph;
    if (knowledge.entries.length > 0) {
        const referenceNodes = knowledge.entries.slice(0, 2).map((entry, index) => ({
            id: createNodeId('reference'),
            type: 'reference',
            position: {
                x: (state.graph.nodes[0]?.position.x ?? 160) - 220,
                y: (state.graph.nodes[0]?.position.y ?? 160) + index * 120
            },
            data: {
                type: 'reference',
                title: entry.title,
                source: entry.url ?? '知识库',
                location: entry.summary
            }
        }));
        const edges = referenceNodes.map((node) => ({
            id: `${node.id}->${state.graph.nodes[0]?.id ?? 'root'}`,
            source: node.id,
            target: state.graph.nodes[0]?.id ?? node.id,
            label: '提供依据'
        }));
        referenceNodes.forEach((node, idx) => {
            pushNode(state, node, edges[idx]);
        });
    }
    return state;
}
