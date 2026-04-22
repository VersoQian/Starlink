import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BaseTool,
  type CanvasGraph,
  type ToolContext,
  type ToolDefinition,
  type ToolMessage
} from '@starlink/shared'
import { ToolRegistry } from '../tool-registry/registry.js'
import { BMC_TEMPLATE } from '../seeds/flow-templates.js'
import AggregatorTool from '../tools/control-flow/aggregator.tool.js'
import BmcRendererTool from '../tools/output/bmc-renderer.tool.js'
import { GraphCompiler } from './graph-compiler.js'
import { GraphExecutor } from './graph-executor.js'

test('BMC_TEMPLATE executes through GraphExecutor and renders nine canvas cards', async () => {
  const registry = new ToolRegistry()
  registry.register(new StaticBmcAgentTool('market_agent', [
    card('客户细分'),
    card('渠道通路'),
    card('客户关系')
  ]))
  registry.register(new StaticBmcAgentTool('product_agent', [
    card('价值主张'),
    card('核心资源'),
    card('关键业务'),
    card('重要合作')
  ]))
  registry.register(new StaticBmcAgentTool('finance_agent', [
    card('收入来源'),
    card('成本结构')
  ]))
  registry.register(new StaticCriticTool())
  registry.register(new AggregatorTool())
  registry.register(new BmcRendererTool())

  const plan = new GraphCompiler().compile(BMC_TEMPLATE)
  const events = new GraphExecutor(registry).execute(
    plan,
    { question: '生成一个 AI 学习助手的商业模式' },
    {
      workspaceId: 'workspace-bmc-flow',
      userId: 'tester',
      executionId: 'exec-bmc-flow',
      abortController: new AbortController()
    }
  )

  const completed: Record<string, unknown> = {}
  const errors: string[] = []
  let finalState: Record<string, unknown> | null = null
  for await (const event of events) {
    if (event.type === 'node_complete') completed[event.nodeId] = event.output
    if (event.type === 'node_error') errors.push(`${event.nodeId}: ${event.error}`)
    if (event.type === 'flow_complete') finalState = event.finalState
  }

  assert.deepEqual(errors, [])
  assert.ok(completed['input-1'])
  assert.equal(readAggregatedCards(completed['agg-1']).length, 9)

  const graph = readRenderedGraph(finalState)
  const domains = graph.nodes
    .map((node) => node.data)
    .filter((data): data is Extract<typeof data, { type: 'note' }> => data.type === 'note')
    .map((data) => data.meta)
    .map((meta) => (meta as { domain?: string } | undefined)?.domain)
    .filter((domain): domain is string => Boolean(domain))

  assert.equal(domains.length, 9)
  assert.equal(new Set(domains).size, 9)
  assert.ok(domains.includes('重要合作'))
})

class StaticBmcAgentTool extends BaseTool {
  readonly definition: ToolDefinition

  constructor(name: string, private readonly cards: Array<{ domain: string; content: string; confidence: number }>) {
    super()
    this.definition = {
      identity: { name, provider: 'builtin', version: 'test' },
      display: {
        label: name,
        description: name,
        icon: 'T',
        category: 'llm_agent',
        color: '#000'
      },
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'question', required: true }
        },
        required: ['question']
      },
      outputSchema: {
        type: 'object',
        properties: {
          bmcCards: { type: 'array', description: 'cards' }
        }
      },
      inputPorts: [
        { name: 'question', type: 'string', description: 'question' }
      ],
      outputPorts: [
        { name: 'bmcCards', type: 'array', description: 'cards' }
      ],
      runtime: {
        timeout: 1000,
        retries: 0,
        cacheable: false,
        streamable: false,
        parallel: true
      }
    }
  }

  async *execute(
    _input: Record<string, unknown>,
    _context: ToolContext
  ): AsyncGenerator<ToolMessage> {
    yield { type: 'json', data: { bmcCards: this.cards } }
  }
}

class StaticCriticTool extends BaseTool {
  readonly definition: ToolDefinition = {
    identity: { name: 'critic_agent', provider: 'builtin', version: 'test' },
    display: {
      label: 'critic',
      description: 'critic',
      icon: 'T',
      category: 'llm_agent',
      color: '#000'
    },
    inputSchema: {
      type: 'object',
      properties: {
        allNodes: { type: 'array', description: 'nodes', required: true }
      },
      required: ['allNodes']
    },
    outputSchema: {
      type: 'object',
      properties: {
        conflicts: { type: 'array', description: 'conflicts' }
      }
    },
    inputPorts: [
      { name: 'allNodes', type: 'array', description: 'nodes' }
    ],
    outputPorts: [
      { name: 'conflicts', type: 'array', description: 'conflicts' }
    ],
    runtime: {
      timeout: 1000,
      retries: 0,
      cacheable: false,
      streamable: false,
      parallel: true
    }
  }

  async *execute(
    _input: Record<string, unknown>,
    _context: ToolContext
  ): AsyncGenerator<ToolMessage> {
    yield { type: 'json', data: { conflicts: [] } }
  }
}

function card(domain: string) {
  return {
    domain,
    content: `${domain} 的测试分析`,
    confidence: 0.8
  }
}

function readAggregatedCards(output: unknown) {
  const payload = output as { result?: unknown }
  assert.ok(Array.isArray(payload.result))
  return payload.result
}

function readRenderedGraph(finalState: Record<string, unknown> | null): CanvasGraph {
  assert.ok(finalState)
  const rendererOutput = finalState['bmc-1'] as { canvas?: unknown } | undefined
  assert.ok(rendererOutput?.canvas)
  return rendererOutput.canvas as CanvasGraph
}

