import type {
  ReflectionRequest,
  ReflectionResponse,
  ScaffoldKind
} from './schemas.js'

/**
 * Very short replies skip the LLM call and pivot immediately. Replies in the
 * wider hint range still reach the LLM, but the prompt explicitly asks it to
 * change topic. Keeping these thresholds separate avoids treating every short
 * but meaningful answer as a hard deflection.
 */
export const COACH_SCRIPTED_PIVOT_THRESHOLD = 15
export const COACH_DEFLECTION_HINT_THRESHOLD = 20

export const COACH_SCRIPTED_PIVOT_CONTENT =
  '你好像对这个方向兴趣不大。那我们换个具体的话题——从下面选一个你能立刻回答的：\n\n' +
  '1. 谁会付钱？付多少？\n' +
  '2. 你的第一个客户从哪来？\n' +
  '3. 这件事最大的风险是什么？\n' +
  '4. 替代方案是什么？用户现在怎么解决这个问题的？\n\n' +
  '挑一个说就行。'

export function shouldScriptCoachPivot(content: string): boolean {
  return content.trim().length < COACH_SCRIPTED_PIVOT_THRESHOLD
}

export function shouldHintCoachDeflection(content: string): boolean {
  return content.trim().length < COACH_DEFLECTION_HINT_THRESHOLD
}

/**
 * Cheap repetition check for user chat turns. This intentionally stays
 * deterministic so both the REST and GraphQL Coach entry points behave alike.
 */
export function isCoachMessageRepeat(a: string, b: string): boolean {
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (!na || !nb) return false
  if (na === nb) return true
  const lenRatio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length)
  if (lenRatio < 0.5) return false

  const bigrams = (text: string): Set<string> => {
    const out = new Set<string>()
    for (let i = 0; i < text.length - 1; i += 1) out.add(text.slice(i, i + 2))
    return out
  }

  const aBigrams = bigrams(na)
  const bBigrams = bigrams(nb)
  if (aBigrams.size === 0 || bBigrams.size === 0) return false

  let intersection = 0
  for (const bigram of aBigrams) {
    if (bBigrams.has(bigram)) intersection += 1
  }
  return (2 * intersection) / (aBigrams.size + bBigrams.size) >= 0.85
}

export function reflectionFallback(
  request: ReflectionRequest,
  latencyMs: number
): ReflectionResponse {
  const banner = '_(AI 教练暂时不可达，以下是脚本回复。点 重试 可再试一次。)_\n\n'
  const event = request.event
  let scaffold: ScaffoldKind = 'why'
  let body: string

  switch (event.type) {
    case 'node-added': {
      const label = (event.label ?? '').trim().slice(0, 40)
      body = label
        ? `刚加了 "${label}" (${event.kind})。用一句话说说：为什么是这个，而不是其他类似选项？`
        : `刚加了一个 ${event.kind} 节点。用一句话说说为什么是这个，而不是其他类似选项？`
      break
    }
    case 'node-linked':
      body = `你把 ${event.fromKind} → ${event.toKind} 连起来了。这条连线代表 "导致" / "支撑" / "包含" 中哪一种？`
      break
    case 'meta-check': {
      scaffold = 'meta'
      const counts = Object.entries(request.canvas?.nodeCountByKind ?? {})
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${key}=${count}`)
        .join(', ')
      body = counts
        ? `当前画布: ${counts}。退一步看：哪个维度最不确定 / 最需要补证据？`
        : '退一步看你的画布：当前最薄弱的环节是什么？哪个节点你最不确定？'
      break
    }
    case 'user-message': {
      const said = (event.label ?? '').trim().slice(0, 60)
      body = said
        ? `你刚说："${said}"。能再具体一点吗 — 这是基于什么观察 / 数据 / 经历？`
        : '你刚发了一条消息，但 AI 教练暂时无法理解上下文。能用一句话再说一次你的核心问题吗？'
      break
    }
  }

  return { scaffold, content: banner + body, source: 'error', latencyMs }
}
