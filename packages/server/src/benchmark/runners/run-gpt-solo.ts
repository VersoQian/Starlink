import type { BenchmarkCase, BenchmarkRun } from '../types.js'
import { LLMClient } from '../../services/llm-client.js'

export async function runGptSolo(c: BenchmarkCase): Promise<BenchmarkRun> {
  const startedAt = new Date()
  const t0 = Date.now()

  const knowledge =
    (c.input.workspace_knowledge ?? [])
      .map((k, i) => `${i + 1}. [${k.title}] ${k.content}`)
      .join('\n') || '（无）'
  const constraints = (c.input.constraints ?? []).join('\n- ') || '（无）'

  const prompt =
    '你是一个商业策略分析师。请根据以下问题与参考资料，生成完整的 CC-BMC 九维商业模型画布。\n\n' +
    `## 问题\n${c.input.question}\n\n` +
    `## 参考资料\n${knowledge}\n\n` +
    `## 约束\n- ${constraints}\n\n` +
    `请输出 JSON 数组，每项为 { "domain": "客户细分|...", "content": "...", "metadata": { "confidence": "high|medium|low" } }`

  let bmcNodes: unknown[] = []
  let err: string | undefined

  try {
    const client = new LLMClient()
    const response = await client.chat({
      messages: [
        { role: 'system', content: '你是一个商业策略分析师，输出结构化 JSON。' },
        { role: 'user', content: prompt }
      ]
    })
    const content = response.content ?? ''
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      try { bmcNodes = JSON.parse(match[0]) as unknown[] } catch { bmcNodes = [] }
    }
  } catch (e) {
    err = (e as Error).message
  }

  const endedAt = new Date()
  return {
    case_id: c.case_id,
    runner: 'gpt-solo',
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    duration_ms: Date.now() - t0,
    output: { bmc_nodes: bmcNodes, handoff_count: 0 },
    error: err
  }
}
