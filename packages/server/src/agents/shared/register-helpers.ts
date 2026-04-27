import type { StructuredToolInterface } from '@langchain/core/tools'
import { resolveToolNames } from '../../capabilities/tool-resolver.js'
import { getToolRegistry } from '../../context/index.js'
import type { AgentProfile } from '../../capabilities/profile-schema.js'
import {
  toLangchainTools,
  buildToolContextFromConfigurable
} from './lc-tool-adapter.js'

export function resolveLangchainToolsForAgent(
  profile: AgentProfile
): StructuredToolInterface[] {
  if (profile.tools.length === 0) return []
  const registry = getToolRegistry()
  const { tools: baseTools } = resolveToolNames(profile.tools, registry)
  return toLangchainTools(baseTools, {
    contextFactory: () => buildToolContextFromConfigurable({}, new AbortController().signal)
  })
}
