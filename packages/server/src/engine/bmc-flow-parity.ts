import type { CanvasGraph } from '@starlink/shared'

export type BmcGraphParityReport = {
  sourceDomains: string[]
  targetDomains: string[]
  missingDomains: string[]
  extraDomains: string[]
  nodeCountMismatch: boolean
  edgeCountMismatch: boolean
  warnings: string[]
}

export function compareBmcGraphs(source: CanvasGraph, target: CanvasGraph): BmcGraphParityReport {
  const sourceDomains = readBmcDomains(source)
  const targetDomains = readBmcDomains(target)
  const sourceDomainSet = new Set(sourceDomains)
  const targetDomainSet = new Set(targetDomains)
  const missingDomains = [...sourceDomainSet].filter((domain) => !targetDomainSet.has(domain))
  const extraDomains = [...targetDomainSet].filter((domain) => !sourceDomainSet.has(domain))
  const sourceBmcNodeCount = sourceDomains.length
  const targetBmcNodeCount = targetDomains.length
  const nodeCountMismatch = sourceBmcNodeCount !== targetBmcNodeCount
  const edgeCountMismatch = source.edges.length !== target.edges.length
  const warnings: string[] = []

  if (missingDomains.length > 0) {
    warnings.push(`Target graph is missing BMC domains: ${missingDomains.join(', ')}`)
  }
  if (extraDomains.length > 0) {
    warnings.push(`Target graph has extra BMC domains: ${extraDomains.join(', ')}`)
  }
  if (nodeCountMismatch) {
    warnings.push(`BMC node count mismatch: source=${sourceBmcNodeCount}, target=${targetBmcNodeCount}`)
  }
  if (edgeCountMismatch) {
    warnings.push(`Edge count mismatch: source=${source.edges.length}, target=${target.edges.length}`)
  }

  return {
    sourceDomains,
    targetDomains,
    missingDomains,
    extraDomains,
    nodeCountMismatch,
    edgeCountMismatch,
    warnings
  }
}

function readBmcDomains(graph: CanvasGraph) {
  return graph.nodes
    .map((node) => node.data)
    .filter((data): data is Extract<typeof data, { type: 'note' }> => data.type === 'note')
    .filter((data) => {
      const meta = data.meta as { macraType?: string } | undefined
      return meta?.macraType === 'cc-bmc-card'
    })
    .map((data) => {
      const meta = data.meta as { domain?: unknown } | undefined
      return typeof meta?.domain === 'string' ? meta.domain : null
    })
    .filter((domain): domain is string => Boolean(domain))
    .sort()
}

