import assert from 'node:assert/strict'
import test from 'node:test'
import {
  COACH_DEFLECTION_HINT_THRESHOLD,
  COACH_SCRIPTED_PIVOT_THRESHOLD,
  isCoachMessageRepeat,
  shouldHintCoachDeflection,
  shouldScriptCoachPivot
} from '@starlink/shared'

test('Coach policy uses a narrow scripted-pivot range and a wider LLM-hint range', () => {
  assert.equal(COACH_SCRIPTED_PIVOT_THRESHOLD, 15)
  assert.equal(COACH_DEFLECTION_HINT_THRESHOLD, 20)
  assert.equal(shouldScriptCoachPivot('还行'), true)
  assert.equal(shouldScriptCoachPivot('这是一个仍然值得继续讨论的回答'), false)
  assert.equal(shouldHintCoachDeflection('这个方向暂时还没想清楚'), true)
})

test('Coach repeat detection catches near-duplicate user messages', () => {
  assert.equal(
    isCoachMessageRepeat(
      '我想做一个面向设计师的 AI 素材整理工具',
      '我想做一个面向设计师的 AI 素材整理工具。'
    ),
    true
  )
  assert.equal(
    isCoachMessageRepeat(
      '我想做一个面向设计师的 AI 素材整理工具',
      '我准备先访谈十位独立设计师验证需求'
    ),
    false
  )
})
