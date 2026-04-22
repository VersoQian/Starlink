import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCompactBmcCardContext,
  renderCompactBmcCardsForPrompt,
  validateNineBmcDimensions
} from './business-langgraph.js'

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

test('buildCompactBmcCardContext preserves structured claims instead of fixed-prefix truncation', () => {
  const content = [
    '## 核心判断',
    '- 第一条：目标客户不是泛泛的学生，而是假设集中在准备考研且愿意付费的高压学习人群。',
    '- 第二条：渠道依赖校园社群和学习博主，可能受平台规则变化影响。',
    '- 第三条：需要通过访谈和转化率数据验证真实付费意愿。',
    '- 第四条：如果只做通用聊天助手，差异化不足。'
  ].join('\n')

  const compact = buildCompactBmcCardContext({
    id: 'market-customer-segments',
    type: 'cc-bmc-card',
    domain: '客户细分',
    label: '考研学生',
    content,
    metadata: {
      agent_signature: 'Market_Agent',
      confidence: 'medium'
    }
  })

  assert.equal(compact.domain, '客户细分')
  assert.equal(compact.agentSignature, 'Market_Agent')
  assert.equal(compact.confidence, 'medium')
  assert.ok(compact.keyClaims.some((claim) => claim.includes('准备考研且愿意付费')))
  assert.ok(compact.assumptions.some((claim) => claim.includes('假设集中')))
  assert.ok(compact.risks.some((claim) => claim.includes('平台规则变化')))
})

test('renderCompactBmcCardsForPrompt includes evidence refs from parsed citation metadata', () => {
  const rendered = renderCompactBmcCardsForPrompt([
    {
      id: 'finance-revenue-streams',
      type: 'cc-bmc-card',
      domain: '收入来源',
      label: '订阅收入',
      content: '采用订阅收入，并通过企业版提高 ARPU。',
      metadata: {
        agent_signature: 'Finance_Agent',
        confidence: 'high',
        citations: [
          {
            textStart: 0,
            textEnd: 4,
            refs: [{ evidenceId: 'ev1', docId: 'doc-a', snippetId: 'chunk-1' }]
          }
        ]
      }
    }
  ])

  assert.match(rendered, /收入来源/)
  assert.match(rendered, /Finance_Agent/)
  assert.match(rendered, /doc-a#chunk-1/)
})
