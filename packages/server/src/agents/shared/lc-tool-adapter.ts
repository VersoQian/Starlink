/**
 * BaseTool → LangChain StructuredTool adapter.
 *
 * Starlink's BaseTool uses JSON Schema + AsyncGenerator<ToolMessage>.
 * LangChain's `tool()` factory wants Zod schema + async function returning
 * a string. We bridge:
 *   - JSON Schema → Zod (subset: string/number/boolean/array/object/enum)
 *   - drive AsyncGenerator to completion, collect final json payload
 *
 * Phase B v1 — supports basic types + enums. Phase 4.x can add nested
 * object schemas + array element validation if needed.
 */

import { tool as lcTool } from '@langchain/core/tools'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import type {
  BaseTool,
  ToolContext,
  ToolMessage,
  ToolDefinition
} from '@starlink/shared'

type FieldSchema = ToolDefinition['inputSchema']['properties'][string]

function fieldToZod(field: FieldSchema): z.ZodTypeAny {
  let z_: z.ZodTypeAny
  if (field.enum) {
    const values = field.enum as Array<string | number>
    z_ = z.enum(values.map(String) as [string, ...string[]])
  } else {
    switch (field.type) {
      case 'string':
        z_ = z.string()
        break
      case 'number':
        z_ = z.number()
        break
      case 'boolean':
        z_ = z.boolean()
        break
      case 'array':
        z_ = z.array(z.any())
        break
      case 'object':
        z_ = z.record(z.any())
        break
      default:
        z_ = z.any()
    }
  }
  if (field.description) z_ = z_.describe(field.description)
  if (field.default !== undefined && z_ instanceof z.ZodType) {
    z_ = z_.default(field.default as never)
  }
  return z_
}

function jsonSchemaToZod(
  schema: ToolDefinition['inputSchema']
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const [key, field] of Object.entries(schema.properties)) {
    let z_ = fieldToZod(field)
    if (!schema.required.includes(key)) {
      z_ = z_.optional()
    }
    shape[key] = z_
  }
  return z.object(shape)
}

export interface AdapterOptions {
  /**
   * Phase B: stub context factory. Phase 4.x will wire workspaceId/userId
   * from config.configurable so tools get real context per call.
   */
  contextFactory: () => ToolContext
}

export function toLangchainTool(
  baseTool: BaseTool,
  opts: AdapterOptions
): StructuredToolInterface {
  const def = baseTool.definition
  return lcTool(
    async (input: Record<string, unknown>) => {
      let result: unknown = null
      let lastError: string | null = null
      for await (const msg of baseTool.execute(input, opts.contextFactory())) {
        const m = msg as ToolMessage
        if (m.type === 'json') {
          result = m.data
        } else if (m.type === 'error') {
          lastError = m.error
        }
      }
      if (lastError && result === null) {
        return JSON.stringify({ ok: false, error: lastError })
      }
      return JSON.stringify(result ?? {})
    },
    {
      name: def.identity.name,
      description: def.display.description,
      schema: jsonSchemaToZod(def.inputSchema)
    }
  ) as StructuredToolInterface
}

export function toLangchainTools(
  baseTools: BaseTool[],
  opts: AdapterOptions
): StructuredToolInterface[] {
  return baseTools.map((t) => toLangchainTool(t, opts))
}

/**
 * Build a placeholder ToolContext from a config.configurable object. Phase B
 * gives stubs; Phase 4.x will replace with real values once context plumbing
 * lands.
 */
export function buildToolContextFromConfigurable(
  cfg: Record<string, unknown>,
  signal: AbortSignal
): ToolContext {
  return {
    workspaceId: (cfg['workspaceId'] as string) ?? '',
    userId: (cfg['userId'] as string) ?? '',
    executionId: (cfg['executionId'] as string) ?? '',
    state: (cfg['state'] as Record<string, unknown>) ?? {},
    credentials: (cfg['credentials'] as Record<string, string>) ?? {},
    abortSignal: signal,
    streamWriter: () => undefined
  }
}
