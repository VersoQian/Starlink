/**
 * User-skill extractor reply parser (2026-04-28).
 *
 * Mirrors the ideation-coach parser pattern: strip optional ```json fences,
 * pull the first balanced `{...}` block, Zod-validate against
 * `UserSkillExtractionOutputSchema`. Returns null on any failure (caller
 * should treat null as "no extraction" and skip applying changes).
 */

import {
  UserSkillExtractionOutputSchema,
  type UserSkillExtractionOutput
} from './schemas.js'

export function parseUserSkillExtractionReply(
  raw: string
): UserSkillExtractionOutput | null {
  if (!raw) return null
  const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    const json = JSON.parse(match[0]) as unknown
    const parsed = UserSkillExtractionOutputSchema.safeParse(json)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
