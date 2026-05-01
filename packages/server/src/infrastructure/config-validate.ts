/**
 * Boot-time production configuration validation.
 *
 * Runs ONCE on server start when NODE_ENV=production. Fails fast (process
 * exit code 1) when any production gate is missing or matches a known
 * placeholder. Dev / test runs are unaffected — the assertion is gated
 * behind isProduction().
 *
 * Categories:
 *   - hard required: missing → cannot operate (DATABASE_URL).
 *   - auth required: missing → server is wide open
 *     (INTERNAL_SERVICE_TOKEN, AUTH_JWT_SECRET when AUTH_MODE=jwt).
 *   - placeholder rejected: literal "change-me" / empty string is not
 *     a real secret. We refuse to boot rather than silently accepting it.
 *
 * Why fail-fast vs warn: an internal token left unset accepts EVERY
 * request as authorized at routes/internal-task-events.ts:10 (line is
 * `if (!expected) return true`). That's a CVE-shaped hole in production.
 * A boot crash is the only safe response.
 */

const PLACEHOLDER_VALUES = new Set(['', 'change-me', 'changeme', 'todo', 'TODO'])

interface ConfigIssue {
  variable: string
  detail: string
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function checkProductionConfig(): ConfigIssue[] {
  const issues: ConfigIssue[] = []

  // Hard required for any operation.
  if (!process.env.DATABASE_URL) {
    issues.push({ variable: 'DATABASE_URL', detail: 'unset; PG pool cannot connect' })
  }

  // Auth gates.
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN
  if (!internalToken || PLACEHOLDER_VALUES.has(internalToken)) {
    issues.push({
      variable: 'INTERNAL_SERVICE_TOKEN',
      detail:
        `unset or placeholder (${JSON.stringify(internalToken ?? '')}). The /internal/* ` +
        `routes default-allow when this is empty — production must set a real secret.`
    })
  }

  const authMode = process.env.AUTH_MODE ?? 'disabled'
  if (authMode === 'disabled') {
    issues.push({
      variable: 'AUTH_MODE',
      detail: 'still "disabled". Production should set AUTH_MODE=jwt to require Authorization headers.'
    })
  }
  if (authMode === 'jwt') {
    const secret = process.env.AUTH_JWT_SECRET ?? ''
    if (PLACEHOLDER_VALUES.has(secret) || secret.length < 32) {
      issues.push({
        variable: 'AUTH_JWT_SECRET',
        detail: `unset, placeholder, or shorter than 32 chars (got ${secret.length}). Generate with \`openssl rand -base64 48\`.`
      })
    }
  }

  return issues
}

/**
 * Throws on first invocation when running with NODE_ENV=production and any
 * issue exists. In dev / test, returns the issue list for the caller to
 * surface as a warning if desired.
 */
export function assertProductionConfig(): ConfigIssue[] {
  const issues = checkProductionConfig()
  if (issues.length === 0) return issues

  if (isProduction()) {
    const banner = [
      '',
      '═'.repeat(72),
      '[boot] FATAL · production configuration check failed:',
      ...issues.map((i) => `  · ${i.variable}: ${i.detail}`),
      '═'.repeat(72),
      ''
    ].join('\n')
    console.error(banner)
    throw new Error(`production config invalid: ${issues.map((i) => i.variable).join(', ')}`)
  }

  return issues
}
