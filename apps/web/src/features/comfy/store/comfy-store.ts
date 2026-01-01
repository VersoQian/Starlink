import { create } from 'zustand'
import type { Node, Edge } from 'reactflow'
import type {
  MacraNodeData,
  MacraEdgeData,
  CanvasAction,
  OrchestratorRequest,
  OrchestratorResponse,
  CriticRequest,
  CriticResponse,
  NodeType,
  CCBMCDomain
} from '@/types/macra'

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

interface MacraState {
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

  // 操作方法
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
  onNodesChange: (changes: any[]) => void
  onEdgesChange: (changes: any[]) => void
  onConnect: (connection: any) => void

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

  // AI Orchestrator 调用
  callOrchestrator: (userPrompt: string, mode?: 'seed' | 'completion' | 'general') => Promise<void>

  // AI Critic 调用
  callCritic: () => Promise<void>

  // 工作流执行（兼容旧版本）
  executeWorkflow: () => Promise<void>
  executeNode: (nodeId: string) => Promise<void>

  // 重置
  reset: () => void
}

export const useComfyStore = create<MacraState>((set, get) => ({
  nodes: [],
  edges: [],
  nodeDataMap: new Map(),
  macraNodes: new Map(),
  executingNodeId: null,
  executionQueue: [],
  isOrchestratorProcessing: false,
  isCriticProcessing: false,
  lastCriticRun: null,

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
    const applyChanges = require('reactflow').applyNodeChanges
    set({ nodes: applyChanges(changes, nodes) })
  },

  onEdgesChange: (changes) => {
    const { edges } = get()
    const applyChanges = require('reactflow').applyEdgeChanges
    set({ edges: applyChanges(changes, edges) })
  },

  onConnect: (connection) => {
    const { edges } = get()
    const addEdge = require('reactflow').addEdge
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
    return get().macraNodes.get(nodeId)
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
        label: node.label,
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

  // ============== AI Orchestrator 调用 ==============
  callOrchestrator: async (userPrompt, mode = 'general') => {
    set({ isOrchestratorProcessing: true })

    try {
      const { nodes, edges, macraNodes } = get()

      // 准备画布摘要
      const canvas_summary = {
        nodes: Array.from(macraNodes.values()).map(n => ({
          id: n.id,
          type: n.type,
          label: n.label,
          content: n.content,
          domain: n.domain
        })),
        edges: edges.map(e => ({
          source: e.source,
          target: e.target,
          type: (e.type as any) || 'default'
        }))
      }

      const request: OrchestratorRequest = {
        user_prompt: userPrompt,
        canvas_summary,
        mode
      }

      // 调用 API
      const response = await fetch('/api/macra/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        throw new Error(`Orchestrator API 失败: ${response.statusText}`)
      }

      const data: OrchestratorResponse = await response.json()

      console.log('🤖 Orchestrator 思考过程:', data.thought_process)

      // 应用画布操作
      await get().applyCanvasActions(data.canvas_actions)

      set({ isOrchestratorProcessing: false })
    } catch (error) {
      console.error('❌ Orchestrator 调用失败:', error)
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
            type: (e.type as any) || 'default'
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
          const result = `# 分析结果\n\n${data.summary || '分析完成'}\n\n## 详细信息\n\n${data.actionItems?.map((item: any, i: number) => `${i + 1}. ${item}`).join('\n') || ''}`

          get().updateNodeData(nodeId, {
            agentResult: result,
            status: 'done'
          })
        } catch (apiError) {
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
    set({
      nodes: [],
      edges: [],
      nodeDataMap: new Map(),
      macraNodes: new Map(),
      executingNodeId: null,
      executionQueue: [],
      isOrchestratorProcessing: false,
      isCriticProcessing: false,
      lastCriticRun: null
    })
  }
}))
