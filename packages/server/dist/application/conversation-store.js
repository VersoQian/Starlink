import { nanoid } from 'nanoid';
import { canvasEdgeSchema, canvasNodeSchema, conversationMetadataSchema } from '@branching-chat/shared';
import { DifyServerService } from '../services/dify-service.js';
const EVENT_TOPIC = 'conversation-progress';
const ROOT_POSITION = { x: 160, y: 160 };
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
const difyService = new DifyServerService();
export class ConversationStore {
    constructor({ pubSub }) {
        this.conversations = new Map();
        this.workspaceGraphs = new Map();
        this.pubSub = pubSub;
    }
    async startConversation(workspaceId, userId, question) {
        const id = nanoid();
        const startedAt = new Date();
        const metadata = {
            id,
            createdAt: startedAt,
            updatedAt: startedAt,
            status: 'running',
            latestQuestion: question
        };
        const execution = await buildGraphWithDify({ workspaceId, userId, question });
        const record = {
            metadata,
            graph: execution.graph
        };
        this.conversations.set(id, record);
        this.workspaceGraphs.set(workspaceId, execution.graph);
        const baseEvent = {
            type: 'graph/appended',
            conversationId: id,
            payload: execution.graph
        };
        await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: baseEvent });
        for (const delta of execution.deltas) {
            const deltaEvent = {
                type: 'graph/diff',
                conversationId: id,
                payload: {
                    nodes: delta.nodes,
                    edges: delta.edges
                }
            };
            await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: deltaEvent });
        }
        const completeEvent = {
            type: 'status',
            conversationId: id,
            status: 'completed'
        };
        await this.pubSub.publish(EVENT_TOPIC, { conversationProgress: completeEvent });
        record.metadata = {
            ...record.metadata,
            status: 'completed',
            updatedAt: new Date()
        };
        return record;
    }
    getConversation(id) {
        const record = this.conversations.get(id);
        return record ? { ...record, metadata: conversationMetadataSchema.parse(record.metadata) } : null;
    }
    getGraph(workspaceId) {
        const manualGraph = this.workspaceGraphs.get(workspaceId);
        if (manualGraph) {
            return {
                workspaceId: manualGraph.workspaceId,
                nodes: [...manualGraph.nodes],
                edges: [...manualGraph.edges]
            };
        }
        const existing = [...this.conversations.values()].find((conv) => conv.graph.workspaceId === workspaceId);
        if (existing) {
            this.workspaceGraphs.set(workspaceId, existing.graph);
            return {
                workspaceId,
                nodes: [...existing.graph.nodes],
                edges: [...existing.graph.edges]
            };
        }
        const emptyGraph = {
            workspaceId,
            nodes: [],
            edges: []
        };
        this.workspaceGraphs.set(workspaceId, emptyGraph);
        return emptyGraph;
    }
    addNode(workspaceId, input) {
        const id = input.id ?? nanoid();
        const parsed = canvasNodeSchema.parse({
            id,
            type: input.type,
            position: input.position,
            data: input.data
        });
        const baseGraph = this.getGraph(workspaceId);
        const updatedNodes = [...baseGraph.nodes.filter((node) => node.id !== parsed.id), parsed];
        const updatedGraph = {
            workspaceId,
            nodes: updatedNodes,
            edges: baseGraph.edges
        };
        this.workspaceGraphs.set(workspaceId, updatedGraph);
        // Also update any conversation record referencing this workspace
        for (const record of this.conversations.values()) {
            if (record.graph.workspaceId === workspaceId) {
                record.graph = {
                    ...record.graph,
                    nodes: updatedNodes
                };
            }
        }
        return parsed;
    }
    connectNodes(workspaceId, input) {
        const id = input.id ?? nanoid();
        const parsed = canvasEdgeSchema.parse({
            id,
            source: input.source,
            target: input.target,
            label: input.label ?? null
        });
        const baseGraph = this.getGraph(workspaceId);
        const updatedEdges = [...baseGraph.edges.filter((edge) => edge.id !== parsed.id), parsed];
        const updatedGraph = {
            workspaceId,
            nodes: baseGraph.nodes,
            edges: updatedEdges
        };
        this.workspaceGraphs.set(workspaceId, updatedGraph);
        for (const record of this.conversations.values()) {
            if (record.graph.workspaceId === workspaceId) {
                record.graph = {
                    ...record.graph,
                    edges: updatedEdges
                };
            }
        }
        return parsed;
    }
    getEventIterator() {
        return this.pubSub.asyncIterableIterator(EVENT_TOPIC);
    }
}
async function buildGraphWithDify(context) {
    const summary = await difyService.generateSummary(context.question, context.userId);
    const nodes = [];
    const edges = [];
    const deltas = [];
    const addNode = (node, edge) => {
        nodes.push(node);
        if (edge) {
            edges.push(edge);
        }
        deltas.push({
            nodes: [node],
            edges: edge ? [edge] : undefined
        });
    };
    const rootNode = {
        id: `root-${nanoid(8)}`,
        type: 'note',
        position: { ...ROOT_POSITION },
        data: {
            type: 'note',
            title: '多维画布任务',
            subtitle: `提问人：${context.userId || 'anonymous'}`,
            content: summary,
            footerText: 'Dify 工作流生成摘要 · 节点会随着推理逐步出现',
            variant: 'primary'
        }
    };
    addNode(rootNode);
    const branchSpacing = 320;
    const levelSpacing = 220;
    const branchNodes = SUB_QUESTION_BLUEPRINTS.map((blueprint, index) => {
        const node = {
            id: `branch-${nanoid(8)}`,
            type: 'note',
            position: {
                x: ROOT_POSITION.x + branchSpacing * (index + 1),
                y: ROOT_POSITION.y
            },
            data: {
                type: 'note',
                title: `分支 ${index + 1} · ${blueprint.title}`,
                content: `围绕「${context.question}」聚焦这一分支，并记录讨论要点。`,
                bullets: blueprint.bullets,
                variant: 'timeline-step'
            }
        };
        const edge = {
            id: `${rootNode.id}->${node.id}`,
            source: rootNode.id,
            target: node.id,
            label: `主题 ${index + 1}`
        };
        addNode(node, edge);
        return node;
    });
    branchNodes.forEach((branch, index) => {
        const dimensionBlueprint = DIMENSION_BLUEPRINTS[index % DIMENSION_BLUEPRINTS.length];
        const dimensionNode = {
            id: `dimension-${nanoid(8)}`,
            type: 'note',
            position: {
                x: branch.position.x,
                y: branch.position.y + levelSpacing
            },
            data: {
                type: 'note',
                title: dimensionBlueprint.title,
                content: `从该维度拆解「${context.question}」。`,
                bullets: dimensionBlueprint.bullets,
                variant: 'timeline-dimension',
                subCategory: dimensionBlueprint.subCategory
            }
        };
        const dimensionEdge = {
            id: `${branch.id}->${dimensionNode.id}`,
            source: branch.id,
            target: dimensionNode.id,
            label: '分析维度'
        };
        addNode(dimensionNode, dimensionEdge);
        const actionBlueprint = ACTION_BLUEPRINTS[index % ACTION_BLUEPRINTS.length];
        const actionNode = {
            id: `action-${nanoid(8)}`,
            type: 'note',
            position: {
                x: dimensionNode.position.x,
                y: dimensionNode.position.y + levelSpacing
            },
            data: {
                type: 'note',
                title: actionBlueprint.title,
                bullets: actionBlueprint.bullets,
                variant: 'timeline-action',
                content: '完成后请在节点评论里更新进展。'
            }
        };
        const actionEdge = {
            id: `${dimensionNode.id}->${actionNode.id}`,
            source: dimensionNode.id,
            target: actionNode.id,
            label: '行动计划'
        };
        addNode(actionNode, actionEdge);
    });
    const graph = {
        workspaceId: context.workspaceId,
        nodes,
        edges
    };
    return { graph, deltas };
}
