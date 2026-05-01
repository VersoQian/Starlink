import assert from 'node:assert/strict'
import test from 'node:test'
import { checkProductionConfig } from './config-validate.js'

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T): T {
  const restore: Array<() => void> = []
  for (const [key, value] of Object.entries(overrides)) {
    const original = process.env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
    restore.push(() => {
      if (original === undefined) delete process.env[key]
      else process.env[key] = original
    })
  }
  try {
    return fn()
  } finally {
    for (const r of restore.reverse()) r()
  }
}

test('checkProductionConfig: clean valid config returns no issues', () => {
  const issues = withEnv(
    {
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      INTERNAL_SERVICE_TOKEN: 'a'.repeat(40),
      AUTH_MODE: 'jwt',
      AUTH_JWT_SECRET: 'b'.repeat(48)
    },
    checkProductionConfig
  )
  assert.deepEqual(issues, [])
})

test('checkProductionConfig: missing DATABASE_URL is flagged', () => {
  const issues = withEnv(
    {
      DATABASE_URL: undefined,
      INTERNAL_SERVICE_TOKEN: 'a'.repeat(40),
      AUTH_MODE: 'jwt',
      AUTH_JWT_SECRET: 'b'.repeat(48)
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.variable, 'DATABASE_URL')
})

test('checkProductionConfig: change-me placeholder is rejected as INTERNAL_SERVICE_TOKEN', () => {
  const issues = withEnv(
    {
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      INTERNAL_SERVICE_TOKEN: 'change-me',
      AUTH_MODE: 'jwt',
      AUTH_JWT_SECRET: 'b'.repeat(48)
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.variable, 'INTERNAL_SERVICE_TOKEN')
  assert.match(issues[0]!.detail, /placeholder/)
})

test('checkProductionConfig: AUTH_MODE=disabled is flagged in production', () => {
  const issues = withEnv(
    {
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      INTERNAL_SERVICE_TOKEN: 'a'.repeat(40),
      AUTH_MODE: 'disabled',
      AUTH_JWT_SECRET: undefined
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.variable, 'AUTH_MODE')
})

test('checkProductionConfig: AUTH_MODE=jwt with short secret is flagged', () => {
  const issues = withEnv(
    {
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      INTERNAL_SERVICE_TOKEN: 'a'.repeat(40),
      AUTH_MODE: 'jwt',
      AUTH_JWT_SECRET: 'too-short'
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.variable, 'AUTH_JWT_SECRET')
  assert.match(issues[0]!.detail, /32 chars/)
})

test('checkProductionConfig: empty INTERNAL_SERVICE_TOKEN is flagged (security hole at internal-task-events.ts:10)', () => {
  const issues = withEnv(
    {
      DATABASE_URL: 'postgres://u:p@h:5432/d',
      INTERNAL_SERVICE_TOKEN: '',
      AUTH_MODE: 'jwt',
      AUTH_JWT_SECRET: 'b'.repeat(48)
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 1)
  assert.equal(issues[0]?.variable, 'INTERNAL_SERVICE_TOKEN')
})

test('checkProductionConfig: multiple issues all reported', () => {
  const issues = withEnv(
    {
      DATABASE_URL: undefined,
      INTERNAL_SERVICE_TOKEN: 'change-me',
      AUTH_MODE: 'disabled',
      AUTH_JWT_SECRET: undefined
    },
    checkProductionConfig
  )
  assert.equal(issues.length, 3)
  const vars = issues.map((i) => i.variable).sort()
  assert.deepEqual(vars, ['AUTH_MODE', 'DATABASE_URL', 'INTERNAL_SERVICE_TOKEN'])
})
