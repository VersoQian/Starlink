import assert from 'node:assert/strict'
import test from 'node:test'
import { validateNineBmcDimensions } from './business-langgraph.js'

type TestCard = {
  id: string
  type: string
  domain?: string
  label?: string
  content?: string
}

const CC_BMC_DIMENSIONS = [
  '客户细分',
  '渠道通路',
  '客户关系',
  '价值主张',
  '核心资源',
  '关键业务',
  '重要合作',
  '收入来源',
  '成本结构'
] as const

function card(domain: string): TestCard {
  return {
    id: `test-${domain}`,
    type: 'cc-bmc-card',
    domain,
    label: domain,
    content: `analysis for ${domain}`
  }
}

test('validateNineBmcDimensions: returns empty for a complete 9-dim graph', () => {
  const nodes = CC_BMC_DIMENSIONS.map(card)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual(validateNineBmcDimensions(nodes as any), [])
})

test('validateNineBmcDimensions: detects Key Partnerships missing', () => {
  const withoutPartnerships = CC_BMC_DIMENSIONS.filter((d) => d !== '重要合作').map(card)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missing = validateNineBmcDimensions(withoutPartnerships as any)
  assert.deepEqual(missing, ['重要合作'])
})

test('validateNineBmcDimensions: detects multiple missing dimensions', () => {
  const partial = [card('客户细分'), card('价值主张'), card('收入来源')]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missing = validateNineBmcDimensions(partial as any)
  assert.equal(missing.length, 6)
  assert.ok(missing.includes('渠道通路'))
  assert.ok(missing.includes('重要合作'))
  assert.ok(missing.includes('成本结构'))
})

test('validateNineBmcDimensions: ignores duplicate domains', () => {
  const dupCustomerSeg = [...CC_BMC_DIMENSIONS.map(card), card('客户细分'), card('客户细分')]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual(validateNineBmcDimensions(dupCustomerSeg as any), [])
})

test('validateNineBmcDimensions: ignores non-BMC node types without domain', () => {
  const mixed: TestCard[] = [
    ...CC_BMC_DIMENSIONS.map(card),
    { id: 'critic-1', type: 'conflict-alert', label: 'conflict' },
    { id: 'note-1', type: 'insight-note', label: 'note' }
  ]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assert.deepEqual(validateNineBmcDimensions(mixed as any), [])
})

test('validateNineBmcDimensions: empty input returns all 9 dimensions as missing', () => {
  const missing = validateNineBmcDimensions([])
  assert.equal(missing.length, 9)
})
