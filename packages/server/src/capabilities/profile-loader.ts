/**
 * Profile Loader — reads an agent.yaml from disk, validates against the
 * AgentProfileSchema, and produces either an AgentDescriptor or
 * AdvisorDescriptor suitable for Capability Registry registration.
 *
 * Two-step separation on purpose:
 *   1. loadAgentProfile(path) → AgentProfile (pure data)
 *   2. profileToDescriptor(profile, buildSubgraph) → AgentDescriptor
 *
 * This lets each `graph.ts` close over its YAML profile at buildSubgraph()
 * *call time* (not load time), so temperature / prompt overrides passed via
 * config.configurable can still override profile values.
 */

import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import { parseAgentProfile, type AgentProfile } from './profile-schema.js'
import type {
  AgentDescriptor,
  AdvisorDescriptor,
  RelevanceScorer,
  TriggerPredicate,
  AgentRole,
  Capability
} from './types.js'

// ============== loadAgentProfile ==============

export async function loadAgentProfile(yamlPath: string): Promise<AgentProfile> {
  let raw: string
  try {
    raw = await readFile(yamlPath, 'utf8')
  } catch (err) {
    throw new Error(
      `loadAgentProfile: failed to read ${yamlPath}: ${(err as Error).message}`
    )
  }

  let parsed: unknown
  try {
    parsed = parseYaml(raw)
  } catch (err) {
    throw new Error(
      `loadAgentProfile: invalid YAML at ${yamlPath}: ${(err as Error).message}`
    )
  }

  const result = parseAgentProfile(parsed)
  if (!result.ok) {
    throw new Error(
      `loadAgentProfile: schema validation failed at ${yamlPath}:\n${result.errors.join('\n')}`
    )
  }
  return result.profile
}

// ============== profileToDescriptor ==============

export function profileToDescriptor(
  profile: AgentProfile,
  buildSubgraph: () => unknown
): AgentDescriptor {
  if (profile.role === 'advisor') {
    throw new Error(
      `profileToDescriptor: agent "${profile.id}" has role=advisor; ` +
        `use profileToAdvisorDescriptor instead`
    )
  }
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role as Exclude<AgentRole, 'advisor'>,
    capabilities: profile.capabilities as Capability[],
    runtime: {
      timeout: profile.timeout_ms,
      retries: profile.retries,
      cacheable: profile.cacheable
    },
    buildSubgraph
  }
}

// ============== profileToAdvisorDescriptor ==============

export function profileToAdvisorDescriptor<State = unknown>(
  profile: AgentProfile,
  buildSubgraph: () => unknown,
  relevanceScorer: RelevanceScorer<State>,
  triggerPredicate?: TriggerPredicate<State>
): AdvisorDescriptor<State> {
  if (profile.role !== 'advisor') {
    throw new Error(
      `profileToAdvisorDescriptor: agent "${profile.id}" must have role=advisor ` +
        `(got "${profile.role}")`
    )
  }
  return {
    id: profile.id,
    name: profile.name,
    role: 'advisor',
    capabilities: profile.capabilities as Capability[],
    runtime: {
      timeout: profile.timeout_ms,
      retries: profile.retries,
      cacheable: profile.cacheable
    },
    buildSubgraph,
    relevanceScorer,
    triggerPredicate
  }
}

// ============== Lazy-init helper ==============

export function makeProfileGetter(yamlPath: string): () => Promise<AgentProfile> {
  let cached: Promise<AgentProfile> | undefined
  return () => (cached ??= loadAgentProfile(yamlPath))
}
