import { create } from 'zustand'
import { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow'
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow'
import { getGraphQLClient } from '@/shared/lib/graphql-client'
import { watchConversation } from '@/shared/lib/conversation-sync-engine'
import type {
  MacraNodeData,
  MacraEdgeData,
  CanvasAction,
  CriticRequest,
  CriticResponse
} from '@/types/macra'
import type { CanvasNode, CanvasEdge, WorkspaceGraphResponse } from '@/types/graph'

// 节点数据类型（保留旧接口以兼容）
export type NodeStatus = 'idle' | 'processing' | 'done' | 'error'

export interface NodeData {
  id: string
  // Resource节点数据
  resourceContent?: File | string
  resourceType?: 'image' | 'document'
  resourceName?: string
  // Agent节点数据
  agentType?: string
  systemInstruction?: string
  agentResult?: string
  // 通用状态
  status: NodeStatus
  error?: string
}

type KnowledgeEvidence = {
  docId?: string
  snippet?: string
  id?: string
  title?: string
  content?: string
  source?: string
  score?: number
}

const START_CONVERSATION_MUTATION = /* GraphQL */ `
  mutation StartConversation($workspaceId: ID!, $question: String!) {
    startConversation(workspaceId: $workspaceId, question: $question) {
      metadata {
        id
      }
      graph {
        workspaceId
        nodes {
          id
          type
          position {
            x
            y
          }
          data
        }
        edges {
          id
          source
          target
          label
        }
      }
    }
  }
`

let activeSubscription: (() => void) | null = null

const MACRA_NODE_TYPES = new Set([
  'agent-avatar',
  'cc-bmc-card',
  'insight-note',
  'conflict-alert',
  'data-source'
])

const mapCanvasNodeToReactFlow = (node: CanvasNode): Node => {
  const meta = (node.data as { meta?: { macraType?: string } } | undefined)?.meta
  const macraType = meta?.macraType

  const type = (() => {
    if (typeof macraType === 'string' && MACRA_NODE_TYPES.has(macraType)) {
      return macraType
    }
    if (MACRA_NODE_TYPES.has(node.type)) {
      return node.type
    }
    if (node.type === 'image') {
      return 'canvas-image'
    }
    return 'canvas-note'
  })()

  return {
    id: node.id,
    type,
    position: node.position,
    data: node.data
  }
}

const mapCanvasEdgeToReactFlow = (edge: CanvasEdge): Edge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  label: edge.label,
  type: 'smoothstep'
})

const mergeById = <T extends { id: string }>(current: T[], updates?: T[]) => {
  if (!updates || updates.length === 0) return current
  const merged = new Map(current.map((item) => [item.id, item]))
  updates.forEach((item) => merged.set(item.id, item))
  return [...merged.values()]
}

interface MacraState {
  workspaceId: string

  // ReactFlow节点和边
  nodes: Node[]
  edges: Edge[]

  // 节点数据存储（兼容旧版本）
  nodeDataMap: Map<string, NodeData>

  // MACRA 节点数据存储（新版本）
  macraNodes: Map<string, MacraNodeData>

  // 执行状态
  executingNodeId: string | null
  executionQueue: string[]

  // AI 状态
  isOrchestratorProcessing: boolean
  isCriticProcessing: boolean
  lastCriticRun: number | null

  // 详情面板状态
  detailPanel: {
    isOpen: boolean
    nodeId: string | null
  }

  // 知识库证据
  knowledgeEvidence: KnowledgeEvidence[]
  setKnowledgeEvidence: (evidence: KnowledgeEvidence[]) => void

  setWorkspaceId: (workspaceId: string) => void

  // 操作方法
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void

  // 节点数据操作（兼容旧版本）
  getNodeData: (nodeId: string) => NodeData | undefined
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void
  setNodeStatus: (nodeId: string, status: NodeStatus) => void

  // MACRA 节点操作（新版本）
  getMacraNode: (nodeId: string) => MacraNodeData | undefined
  updateMacraNode: (nodeId: string, data: Partial<MacraNodeData>) => void
  createMacraNode: (node: MacraNodeData) => void
  deleteMacraNode: (nodeId: string) => void

  // Canvas Actions 操作
  applyCanvasActions: (actions: CanvasAction[]) => Promise<void>

  // Business LangGraph 调用（通过 GraphQL startConversation）
  callLangGraph: (userPrompt: string, mode?: 'seed' | 'completion' | 'general') => Promise<void>

  // AI Critic 调用（通过 GraphQL 后端自动触发，前端保留手动触发接口）
  callCritic: () => Promise<void>

  // 详情面板操作
  openDetailPanel: (nodeId: string) => void
  closeDetailPanel: () => void

  // 工作流执行（兼容旧版本）
  executeWorkflow: () => Promise<void>
  executeNode: (nodeId: string) => Promise<void>

  // 重置
  reset: () => void
}

export const useComfyStore = create<MacraState>((set, get) => ({
  workspaceId: 'comfy-default',
  nodes: [],
  edges: [],
  nodeDataMap: new Map(),
  macraNodes: new Map(),
  executingNodeId: null,
  executionQueue: [],
  isOrchestratorProcessing: false,
  isCriticProcessing: false,
  lastCriticRun: null,
  knowledgeEvidence: [],
  detailPanel: {
    isOpen: false,
    nodeId: null
  },

  setKnowledgeEvidence: (evidence) => {
    set({ knowledgeEvidence: evidence })
  },

  setWorkspaceId: (workspaceId) => {
    set({ workspaceId })
  },

  setNodes: (nodes) => {
    set({
      nodes: typeof nodes === 'function' ? nodes(get().nodes) : nodes
    })
  },

  setEdges: (edges) => {
    set({
      edges: typeof edges === 'function' ? edges(get().edges) : edges
    })
  },

  onNodesChange: (changes) => {
    const { nodes } = get()
    set({ nodes: applyNodeChanges(changes, nodes) })
  },

  onEdgesChange: (changes) => {
    const { edges } = get()
    set({ edges: applyEdgeChanges(changes, edges) })
  },

  onConnect: (connection) => {
    const { edges } = get()
    set({ edges: addEdge(connection, edges) })
  },

  getNodeData: (nodeId) => {
    return get().nodeDataMap.get(nodeId)
  },

  updateNodeData: (nodeId, data) => {
    const { nodeDataMap } = get()
    const existingData = nodeDataMap.get(nodeId) || { id: nodeId, status: 'idle' as NodeStatus }
    const newData = { ...existingData, ...data }

    const newMap = new Map(nodeDataMap)
    newMap.set(nodeId, newData)

    set({ nodeDataMap: newMap })
  },

  setNodeStatus: (nodeId, status) => {
    get().updateNodeData(nodeId, { status })
  },

  // ============== MACRA 节点操作 ==============
  getMacraNode: (nodeId) => {
    const result = get().macraNodes.get(nodeId)
    console.log('[getMacraNode]', {
      nodeId,
      found: !!result,
      totalNodes: get().macraNodes.size,
      availableIds: Array.from(get().macraNodes.keys()).slice(0, 5)
    })
    return result
  },

  updateMacraNode: (nodeId, data) => {
    const { macraNodes } = get()
    const existingNode = macraNodes.get(nodeId)
    if (!existingNode) return

    const updatedNode = { ...existingNode, ...data }
    const newMap = new Map(macraNodes)
    newMap.set(nodeId, updatedNode)
    set({ macraNodes: newMap })
  },

  createMacraNode: (node) => {
    const { macraNodes, nodes } = get()

    // 添加到 macraNodes Map
    const newMacraMap = new Map(macraNodes)
    newMacraMap.set(node.id, node)

    // 添加到 ReactFlow nodes
    const newReactFlowNode: Node = {
      id: node.id,
      type: node.type,
      position: node.position || { x: Math.random() * 500, y: Math.random() * 500 },
      data: {
        ...node
      }
    }

    set({
      macraNodes: newMacraMap,
      nodes: [...nodes, newReactFlowNode]
    })
  },

  deleteMacraNode: (nodeId) => {
    const { macraNodes, nodes, edges } = get()

    // 从 macraNodes 删除
    const newMacraMap = new Map(macraNodes)
    newMacraMap.delete(nodeId)

    // 从 ReactFlow nodes 删除
    const newNodes = nodes.filter(n => n.id !== nodeId)

    // 删除相关的边
    const newEdges = edges.filter(e => e.source !== nodeId && e.target !== nodeId)

    set({
      macraNodes: newMacraMap,
      nodes: newNodes,
      edges: newEdges
    })
  },

  // ============== Canvas Actions 操作 ==============
  applyCanvasActions: async (actions) => {
    for (const action of actions) {
      switch (action.action) {
        case 'create_node': {
          const nodeData = action.data as MacraNodeData
          get().createMacraNode(nodeData)
          break
        }
        case 'update_node': {
          const nodeData = action.data as MacraNodeData
          get().updateMacraNode(nodeData.id, nodeData)
          break
        }
        case 'delete_node': {
          const { nodeIds } = action.data as { nodeIds: string[] }
          nodeIds?.forEach(id => get().deleteMacraNode(id))
          break
        }
        case 'create_edge': {
          const edgeData = action.data as MacraEdgeData
          const { edges } = get()
          const newEdge: Edge = {
            id: `e-${edgeData.source}-${edgeData.target}`,
            source: edgeData.source,
            target: edgeData.target,
            label: edgeData.label,
            type: edgeData.type === 'default' ? 'smoothstep' : edgeData.type,
            animated: edgeData.animated ?? true,
            style: edgeData.style || {}
          }
          set({ edges: [...edges, newEdge] })
          break
        }
        case 'delete_edge': {
          const { source, target } = action.data as { source: string; target: string }
          const { edges } = get()
          const newEdges = edges.filter(
            e => !(e.source === source && e.target === target)
          )
          set({ edges: newEdges })
          break
        }
        default:
          console.warn('Unknown canvas action:', action.action)
      }
    }
  },

  // ============== Business LangGraph 调用 ==============
  callLangGraph: async (userPrompt, _mode = 'general') => {
    void _mode
    set({ isOrchestratorProcessing: true })

    if (activeSubscription) {
      activeSubscription()
      activeSubscription = null
    }

    set({
      nodes: [],
      edges: [],
      nodeDataMap: new Map(),
      macraNodes: new Map()
    })

    const workspaceId = get().workspaceId
    if (!workspaceId) {
      set({ isOrchestratorProcessing: false })
      throw new Error('workspaceId 未设置')
    }

    try {
      const client = getGraphQLClient()
      const response = await client.request<{
        startConversation: { metadata: { id: string }; graph: WorkspaceGraphResponse }
      }>(START_CONVERSATION_MUTATION, {
        workspaceId,
        question: userPrompt
      })

      const conversationId = response.startConversation.metadata.id

      const extractMacraNodeData = (canvasNode: CanvasNode): MacraNodeData | null => {
        const data = (canvasNode.data ?? {}) as Record<string, unknown>
        const meta = data.meta as Record<string, unknown> | undefined
        if (!meta) {
          console.warn('[extractMacraNodeData] No meta found for node:', canvasNode.id)
          return null
        }

        const macraData: MacraNodeData = {
          id: canvasNode.id,
          type: (meta.macraType || canvasNode.type || 'cc-bmc-card') as MacraNodeData['type'],
          label: typeof data.title === 'string' ? data.title : '未命名',
          content: typeof data.content === 'string' ? data.content : '',
          summary: typeof meta.summary === 'string'
            ? meta.summary
            : (typeof data.content === 'string' ? data.content : ''),
          fullContent: typeof meta.fullContent === 'string'
            ? meta.fullContent
            : (typeof data.content === 'string' ? data.content : ''),
          domain: typeof meta.domain === 'string' ? (meta.domain as MacraNodeData['domain']) : undefined,
          metadata: (meta.metadata as Record<string, unknown> | undefined) || {},
          agentType: typeof meta.agentType === 'string' ? (meta.agentType as MacraNodeData['agentType']) : undefined,
          severity: typeof meta.severity === 'string' ? (meta.severity as MacraNodeData['severity']) : undefined,
          conflictType: typeof meta.conflictType === 'string' ? (meta.conflictType as MacraNodeData['conflictType']) : undefined,
          isInteractive: typeof meta.isInteractive === 'boolean' ? meta.isInteractive : undefined,
          position: canvasNode.position
        }

        console.log('[extractMacraNodeData] Extracted:', {
          id: macraData.id,
          type: macraData.type,
          label: macraData.label,
          hasSummary: !!macraData.summary,
          hasFullContent: !!macraData.fullContent
        })

        return macraData
      }

      const applyGraph = (graph: WorkspaceGraphResponse) => {
        const reactFlowNodes = graph.nodes.map(mapCanvasNodeToReactFlow)
        const macraNodesMap = new Map<string, MacraNodeData>()

        // 同时构建 macraNodes Map
        graph.nodes.forEach(node => {
          const macraData = extractMacraNodeData(node)
          if (macraData) {
            macraNodesMap.set(node.id, macraData)
          }
        })

        console.log('[applyGraph] Updating store:', {
          reactFlowNodesCount: reactFlowNodes.length,
          macraNodesCount: macraNodesMap.size,
          firstFewIds: Array.from(macraNodesMap.keys()).slice(0, 3)
        })

        set({
          nodes: reactFlowNodes,
          edges: graph.edges.map(mapCanvasEdgeToReactFlow),
          macraNodes: macraNodesMap
        })
      }

      const applyDelta = (delta: { nodes?: CanvasNode[]; edges?: CanvasEdge[] }) => {
        const nodeUpdates = delta.nodes?.map(mapCanvasNodeToReactFlow)
        const edgeUpdates = delta.edges?.map(mapCanvasEdgeToReactFlow)

        set((state) => {
          const newMacraNodes = new Map(state.macraNodes)

          // 同时更新 macraNodes Map
          delta.nodes?.forEach(node => {
            const macraData = extractMacraNodeData(node)
            if (macraData) {
              newMacraNodes.set(node.id, macraData)
            }
          })

          console.log('[applyDelta] Updating store:', {
            deltaNodesCount: delta.nodes?.length || 0,
            macraNodesCountBefore: state.macraNodes.size,
            macraNodesCountAfter: newMacraNodes.size,
            addedIds: delta.nodes?.map(n => n.id).slice(0, 3)
          })

          return {
            nodes: nodeUpdates ? mergeById(state.nodes, nodeUpdates) : state.nodes,
            edges: edgeUpdates ? mergeById(state.edges, edgeUpdates) : state.edges,
            macraNodes: newMacraNodes
          }
        })
      }

      if (response.startConversation.graph) {
        applyGraph(response.startConversation.graph)
      }

      const watcher = watchConversation({
        conversationId,
        onGraphAppended: (payload) => {
          applyGraph(payload as WorkspaceGraphResponse)
        },
        onGraphDiff: (payload) => {
          applyDelta(payload as { nodes?: CanvasNode[]; edges?: CanvasEdge[] })
        }
      })
      activeSubscription = watcher.cancel
      await watcher.done.finally(() => {
        if (activeSubscription === watcher.cancel) {
          activeSubscription = null
        }
      })

      set({ isOrchestratorProcessing: false })
    } catch (error) {
      console.error('❌ Business LangGraph 调用失败:', error)
      set({ isOrchestratorProcessing: false })
      throw error
    }
  },

  // ============== AI Critic 调用 ==============
  callCritic: async () => {
    const { nodes, macraNodes, lastCriticRun } = get()

    // 避免频繁调用（至少间隔5秒）
    if (lastCriticRun && Date.now() - lastCriticRun < 5000) {
      console.log('⏳ Critic 冷却中，跳过本次调用')
      return
    }

    // 只在节点数 > 3 时触发
    if (nodes.length <= 3) {
      return
    }

    set({ isCriticProcessing: true, lastCriticRun: Date.now() })

    try {
      const { edges } = get()

      const request: CriticRequest = {
        canvas_data: {
          nodes: Array.from(macraNodes.values()),
              edges: edges.map(e => ({
                source: e.source,
                target: e.target,
                label: e.label as string,
                type: (e.type as MacraEdgeData['type']) || 'default'
              }))
            }
          }

      const response = await fetch('/api/macra/critic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Critic API 失败: ${response.statusText}`)
      }

      const data: CriticResponse = await response.json()

      if (data.conflicts && data.conflicts.length > 0) {
        console.log('⚠️  发现冲突:', data.conflicts)

        // 创建冲突可视化
        for (const conflict of data.conflicts) {
          const conflictAction: CanvasAction = {
            action: 'create_edge',
            data: {
              source: conflict.source_node_id,
              target: conflict.target_node_id,
              label: conflict.visualization.label,
              type: 'conflict',
              animated: conflict.visualization.style.animated,
              style: {
                stroke: conflict.visualization.style.stroke,
                strokeWidth: conflict.visualization.style.strokeWidth
              }
            }
          }

          await get().applyCanvasActions([conflictAction])

          // 可选：创建冲突警示节点
          const alertNode: MacraNodeData = {
            id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'conflict-alert',
            label: `冲突警告`,
            content: `**原因**: ${conflict.reason}\n\n**建议**: ${conflict.suggestion}`,
            metadata: {
              agent_signature: 'Adversarial_Critic',
              confidence: 'high'
            },
            severity: conflict.severity,
            conflictType: 'other',
            position: {
              x: Math.random() * 300 + 200,
              y: Math.random() * 300 + 200
            }
          }

          get().createMacraNode(alertNode)
        }
      } else {
        console.log('✅ 未发现冲突')
      }

      set({ isCriticProcessing: false })
    } catch (error) {
      console.error('❌ Critic 调用失败:', error)
      set({ isCriticProcessing: false })
      throw error
    }
  },

  // ============== 详情面板操作 ==============
  openDetailPanel: (nodeId) => {
    console.log('[openDetailPanel] Opening panel for node:', nodeId)
    set({
      detailPanel: {
        isOpen: true,
        nodeId
      }
    })
  },

  closeDetailPanel: () => {
    set({
      detailPanel: {
        isOpen: false,
        nodeId: null
      }
    })
  },

  // ============== 旧版本工作流执行（兼容） ==============
  executeNode: async (nodeId) => {
    const { nodes, edges, nodeDataMap } = get()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    set({ executingNodeId: nodeId })
    get().setNodeStatus(nodeId, 'processing')

    try {
      if (node.type === 'agent') {
        const inputEdge = edges.find(e => e.target === nodeId)
        let inputContent: string = ''

        if (inputEdge) {
          const sourceData = nodeDataMap.get(inputEdge.source)
          if (sourceData?.resourceContent) {
            if (typeof sourceData.resourceContent === 'string') {
              inputContent = sourceData.resourceContent
            } else if (sourceData.resourceContent instanceof File) {
              inputContent = `文件: ${sourceData.resourceContent.name}`
            }
          }
        }

        const nodeData = nodeDataMap.get(nodeId)

        try {
          const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: `${nodeData?.systemInstruction || '请分析以下内容'}\n\n输入内容: ${inputContent}`,
              agentType: nodeData?.agentType || 'data-analyst',
              timeline: [],
              edges: []
            })
          })

          if (!response.ok) {
            throw new Error('API调用失败')
          }

          const data = await response.json()
          const actionItems = Array.isArray(data.actionItems)
            ? data.actionItems.map((item: unknown, i: number) => `${i + 1}. ${String(item)}`).join('\n')
            : ''
          const result = `# 分析结果\n\n${data.summary || '分析完成'}\n\n## 详细信息\n\n${actionItems}`

          get().updateNodeData(nodeId, {
            agentResult: result,
            status: 'done'
          })
        } catch {
          const result = `# 分析结果 (Mock)\n\n## 输入分析\n\n输入内容: ${inputContent || '无'}\n\n## Agent信息\n\n- **Agent类型**: ${nodeData?.agentType || 'data-analyst'}\n- **系统指令**: ${nodeData?.systemInstruction || '无'}\n\n## 分析建议\n\n1. 建议进行进一步的数据收集\n2. 考虑多维度分析\n3. 与相关专家咨询\n\n**注意**: 这是模拟数据，实际API暂不可用。`

          get().updateNodeData(nodeId, {
            agentResult: result,
            status: 'done'
          })
        }
      }

      set({ executingNodeId: null })
    } catch (error) {
      get().updateNodeData(nodeId, {
        status: 'error',
        error: error instanceof Error ? error.message : '执行失败'
      })
      set({ executingNodeId: null })
    }
  },

  executeWorkflow: async () => {
    const { nodes, edges } = get()
    const visited = new Set<string>()
    const queue: string[] = []

    const resourceNodes = nodes.filter(n => n.type === 'resource')
    resourceNodes.forEach(n => queue.push(n.id))

    while (queue.length > 0) {
      const currentId = queue.shift()!
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const node = nodes.find(n => n.id === currentId)
      if (!node) continue

      if (node.type === 'agent') {
        await get().executeNode(currentId)
      }

      const outgoingEdges = edges.filter(e => e.source === currentId)
      outgoingEdges.forEach(edge => {
        if (!visited.has(edge.target)) {
          queue.push(edge.target)
        }
      })
    }
  },

  reset: () => {
    if (activeSubscription) {
      activeSubscription()
      activeSubscription = null
    }
    set({
      nodes: [],
      edges: [],
      nodeDataMap: new Map(),
      macraNodes: new Map(),
      executingNodeId: null,
      executionQueue: [],
      isOrchestratorProcessing: false,
      isCriticProcessing: false,
      lastCriticRun: null,
      knowledgeEvidence: [],
      detailPanel: {
        isOpen: false,
        nodeId: null
      }
    })
  }
}))

export type ComfyStore = MacraState
