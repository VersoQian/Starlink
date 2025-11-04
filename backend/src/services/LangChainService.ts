import { config } from '../config'
import { runAnalyzeAgent, type AnalyzeAgentOutput, type AnalyzeAgentInput } from '../langchain/analyzeAgent'
import { addIteration, type IterationRecord } from '../store/timelineStore'

export class LangChainService {
  static async analyzeTask(
    input: AnalyzeAgentInput
  ): Promise<AnalyzeAgentOutput & { iteration?: IterationRecord }> {
    if (process.env.USE_LANGSERVE === 'true') {
      const response = await fetch(`${config.langServeBaseUrl}/agent/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(`LangServe analyze failed: ${response.status} ${message}`)
      }

      return (await response.json()) as AnalyzeAgentOutput
    }

    const result = await runAnalyzeAgent(input)

    const iteration = addIteration({
      tenantId: input.tenantId,
      taskId: input.taskId,
      userId: input.userId,
      summary: result.summary ?? '',
      nodes: result.nodes,
      edges: result.edges
    })

    return {
      ...result,
      iteration
    }
  }
}
