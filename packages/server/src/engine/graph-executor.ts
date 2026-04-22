/**
 * Graph Executor — runs an ExecutionPlan as a DAG with parallel scheduling.
 * Emits ExecutionEvent items via AsyncGenerator for real-time progress tracking.
 */

import type { ExecutionPlan, ExecutionEvent, ExecutionContext, InputMapping } from '@starlink/shared'
import type { ToolContext, ToolMessage } from '@starlink/shared'
import type { ToolRegistry } from '../tool-registry/registry.js'

export class GraphExecutor {
  constructor(private registry: ToolRegistry) {}

  async *execute(
    plan: ExecutionPlan,
    initialInputs: Record<string, unknown>,
    context: ExecutionContext,
  ): AsyncGenerator<ExecutionEvent> {
    // State map: nodeId → output data
    const state: Record<string, unknown> = { __initial: initialInputs }

    for (const group of plan.parallelGroups) {
      yield { type: 'group_start', nodeIds: group }

      const promises = group.map(async (nodeId): Promise<{ nodeId: string; output: unknown; duration: number } | { nodeId: string; error: string }> => {
        const step = plan.steps.find((s) => s.nodeId === nodeId)
        if (!step) return { nodeId, error: `No step found for node ${nodeId}` }

        const startTime = Date.now()

        try {
          if (step.toolName === '__input') {
            state[nodeId] = initialInputs
            return { nodeId, output: initialInputs, duration: Date.now() - startTime }
          }

          const tool = this.registry.getTool(step.toolName)

          // Resolve inputs from upstream outputs
          const input = this.resolveInputValues(step.inputs, state, step.config)

          // Validate
          const validation = tool.validate(input)
          if (!validation.valid) {
            const msg = validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')
            return { nodeId, error: `Validation failed: ${msg}` }
          }

          // Build tool context
          const toolCtx: ToolContext = {
            workspaceId: context.workspaceId,
            userId: context.userId,
            executionId: context.executionId,
            state,
            credentials: {},
            abortSignal: context.abortController.signal,
            streamWriter: () => {},
          }

          // Execute and collect final output
          let lastOutput: unknown = null
          for await (const msg of tool.execute(input, toolCtx)) {
            if (msg.type === 'json') lastOutput = msg.data
            else if (msg.type === 'text') lastOutput = msg.content
            else if (msg.type === 'file') lastOutput = { path: msg.path, mime: msg.mime }
          }

          const duration = Date.now() - startTime
          state[nodeId] = lastOutput
          return { nodeId, output: lastOutput, duration }
        } catch (err) {
          return { nodeId, error: err instanceof Error ? err.message : String(err) }
        }
      })

      const results = await Promise.allSettled(promises)

      for (const result of results) {
        if (result.status === 'rejected') {
          yield { type: 'node_error', nodeId: 'unknown', error: String(result.reason) }
          continue
        }
        const val = result.value
        if ('error' in val) {
          yield { type: 'node_error', nodeId: val.nodeId, error: val.error }
        } else {
          yield { type: 'node_complete', nodeId: val.nodeId, output: val.output, duration: val.duration }
        }
      }
    }

    yield { type: 'flow_complete', finalState: state }
  }

  private resolveInputValues(
    mappings: InputMapping[],
    state: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    const input: Record<string, unknown> = { ...config }
    const byTargetPort = new Map<string, InputMapping[]>()

    for (const mapping of mappings) {
      const existing = byTargetPort.get(mapping.targetPort) ?? []
      existing.push(mapping)
      byTargetPort.set(mapping.targetPort, existing)
    }

    for (const [targetPort, targetMappings] of byTargetPort) {
      const values = targetMappings.map((mapping) => this.resolveSingleInput(mapping, state))
      input[targetPort] = values.length === 1 ? values[0] : values
    }

    return input
  }

  private resolveSingleInput(
    mapping: InputMapping,
    state: Record<string, unknown>,
  ): unknown {
    const sourceOutput = state[mapping.sourceNodeId]
    if (sourceOutput && typeof sourceOutput === 'object' && !Array.isArray(sourceOutput)) {
      const obj = sourceOutput as Record<string, unknown>
      return obj[mapping.sourcePort] ?? sourceOutput
    }
    return sourceOutput
  }
}
