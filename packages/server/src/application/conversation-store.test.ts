import assert from 'node:assert/strict'
import test from 'node:test'
import type { CanvasGraph } from '@starlink/shared'
import { applyGraphDelta } from './graph-delta.js'

test('applyGraphDelta removes stale nodes and edges before merging replacements', () => {
  const graph: CanvasGraph = {
    workspaceId: 'workspace-delta',
    nodes: [
      {
        id: 'node-old',
        type: 'note',
        position: { x: 160, y: 160 },
        data: {
          type: 'note',
          title: '旧节点',
          content: '旧内容'
        }
      }
    ],
    edges: [
      {
        id: 'edge-old',
        source: 'node-old',
        target: 'node-other',
        label: '旧连接'
      }
    ]
  }

  const nextGraph = applyGraphDelta(graph, {
    removedNodeIds: ['node-old'],
    removedEdgeIds: ['edge-old'],
    nodes: [
      {
        id: 'node-new',
        type: 'note',
        position: { x: 160, y: 380 },
        data: {
          type: 'note',
          title: '新节点',
          content: '新内容'
        }
      }
    ],
    edges: [
      {
        id: 'edge-new',
        source: 'node-new',
        target: 'node-target',
        label: '新连接'
      }
    ]
  })

  assert.deepEqual(nextGraph.nodes.map((node) => node.id), ['node-new'])
  assert.deepEqual(nextGraph.edges.map((edge) => edge.id), ['edge-new'])
})
