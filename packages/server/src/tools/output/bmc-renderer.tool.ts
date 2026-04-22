import {
  BaseTool,
  type CanvasGraph,
  type CanvasNode,
  type ToolContext,
  type ToolDefinition,
  type ToolMessage
} from '@starlink/shared'

type BmcRendererCard = {
  domain?: string
  content?: string
  confidence?: number
}

const DOMAIN_LAYOUT: Record<string, { id: string; x: number; y: number }> = {
  客户细分: { id: 'customer-segments', x: 80, y: 120 },
  价值主张: { id: 'value-propositions', x: 360, y: 120 },
  渠道通路: { id: 'channels', x: 640, y: 120 },
  客户关系: { id: 'customer-relationships', x: 920, y: 120 },
  收入来源: { id: 'revenue-streams', x: 80, y: 360 },
  核心资源: { id: 'key-resources', x: 360, y: 360 },
  关键业务: { id: 'key-activities', x: 640, y: 360 },
  重要合作: { id: 'key-partnerships', x: 920, y: 360 },
  成本结构: { id: 'cost-structure', x: 80, y: 600 }
}

export default class BmcRendererTool extends BaseTool {
  readonly definition: ToolDefinition = {
    identity: {
      name: 'bmc_renderer',
      provider: 'builtin',
      version: '1.0.0'
    },
    display: {
      label: 'BMC 渲染',
      description: '将 BMC 卡片数组转换为 CanvasGraph',
      icon: '🧩',
      category: 'output',
      color: '#0ea5e9'
    },
    inputSchema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          description: 'BMC 卡片数组',
          required: true
        }
      },
      required: ['nodes']
    },
    outputSchema: {
      type: 'object',
      properties: {
        canvas: { type: 'object', description: '渲染后的画布图' }
      }
    },
    inputPorts: [
      { name: 'nodes', type: 'array', description: 'BMC 卡片数组', required: true }
    ],
    outputPorts: [
      { name: 'canvas', type: 'object', description: '渲染后的画布图' }
    ],
    runtime: {
      timeout: 30000,
      retries: 1,
      cacheable: true,
      streamable: false,
      parallel: true
    }
  }

  async *execute(
    input: Record<string, unknown>,
    context: ToolContext
  ): AsyncGenerator<ToolMessage> {
    const cards = Array.isArray(input.nodes) ? input.nodes as BmcRendererCard[] : []
    const canvas: CanvasGraph = {
      workspaceId: context.workspaceId,
      nodes: cards.flatMap((card, index) => renderCardNode(card, index)),
      edges: []
    }

    yield { type: 'json', data: { canvas } }
  }
}

function renderCardNode(card: BmcRendererCard, index: number): CanvasNode[] {
  const domain = typeof card.domain === 'string' ? card.domain : ''
  const layout = DOMAIN_LAYOUT[domain]
  if (!layout) return []

  return [{
    id: `bmc-${layout.id}`,
    type: 'note',
    position: { x: layout.x, y: layout.y + Math.floor(index / 9) * 220 },
    data: {
      type: 'note',
      title: domain,
      content: typeof card.content === 'string' ? card.content : '',
      variant: 'insight',
      meta: {
        macraType: 'cc-bmc-card',
        domain,
        metadata: {
          confidence: normalizeConfidence(card.confidence)
        }
      }
    }
  }]
}

function normalizeConfidence(confidence: unknown) {
  if (typeof confidence !== 'number') return 'medium'
  if (confidence >= 0.75) return 'high'
  if (confidence >= 0.45) return 'medium'
  return 'low'
}

