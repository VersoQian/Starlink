/**
 * Agent Executor — implements the Claude Code-style while(toolCall) loop.
 * An Agent node uses this to autonomously decide which tools to call.
 */

import type { AgentEvent, ExecutionContext, ToolContext } from '@starlink/shared'
import type { ToolRegistry } from '../tool-registry/registry.js'
import { LLMClient } from '../services/llm-client.js'
import type { LLMMessage, LLMToolSchema } from '../services/llm-client.js'

const MAX_ROUNDS = 10

export class AgentExecutor {
  private llm: LLMClient

  constructor(
    private registry: ToolRegistry,
    llmClient?: LLMClient,
  ) {
    this.llm = llmClient ?? new LLMClient()
  }

  async *execute(
    systemPrompt: string,
    userQuery: string,
    availableToolNames: string[],
    context: ExecutionContext,
  ): AsyncGenerator<AgentEvent> {
    // Build tool schemas for LLM function calling
    const toolSchemas: LLMToolSchema[] = availableToolNames
      .filter((name) => this.registry.has(name))
      .map((name) => {
        const tool = this.registry.getTool(name)
        const def = tool.definition
        return this.llm.buildToolSchema(
          def.identity.name,
          def.display.description,
          def.inputSchema as unknown as Record<string, unknown>,
        )
      })

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ]

    let round = 0

    while (round < MAX_ROUNDS) {
      round++

      if (context.abortController.signal.aborted) {
        yield { type: 'error', error: 'Execution aborted' }
        break
      }

      yield { type: 'thinking', round }

      // Call LLM
      const response = await this.llm.chat({
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      })

      // No tool calls → LLM is done
      if (response.toolCalls.length === 0) {
        yield { type: 'answer', content: response.content ?? '' }
        break
      }

      // Parse and emit tool calls
      const calls = response.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }))

      yield { type: 'tool_calls', calls }

      const results: Array<{ id: string; result: string }> = []

      for (const call of calls) {
        try {
          const tool = this.registry.getTool(call.name)

          const toolCtx: ToolContext = {
            workspaceId: context.workspaceId,
            userId: context.userId,
            executionId: context.executionId,
            state: {},
            credentials: {},
            abortSignal: context.abortController.signal,
            streamWriter: () => {},
          }

          let output: unknown = null
          for await (const msg of tool.execute(call.args, toolCtx)) {
            if (msg.type === 'json') output = msg.data
            else if (msg.type === 'text') output = msg.content
          }

          yield {
            type: 'tool_result',
            toolCallId: call.id,
            toolName: call.name,
            result: output
          }
          results.push({ id: call.id, result: JSON.stringify(output) })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          results.push({ id: call.id, result: JSON.stringify({ error: errMsg }) })
        }
      }

      // Inject results into message history
      messages.push({
        role: 'assistant',
        content: response.content,
        tool_calls: response.toolCalls,
      })

      for (const result of results) {
        messages.push({
          role: 'tool',
          content: result.result,
          tool_call_id: result.id,
        })
      }
    }

    if (round >= MAX_ROUNDS) {
      yield { type: 'error', error: `Agent reached maximum rounds (${MAX_ROUNDS})` }
    }
  }
}
