import { StubDimensionAction } from '../action-base.js'

export default class DependencyRiskScoreTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-partnerships',
      actionName: 'dependency-risk-score',
      label: '依赖风险评分',
      description: '评估每个合作伙伴替代难度 + 离场影响',
      inputSchema: {
        type: 'object',
        properties: {
          partners: { type: 'array', description: '伙伴', required: true },
          revenue_dependency: { type: 'object', description: '收入依赖度' }
        },
        required: ['partners']
      },
      outputSchema: { type: 'object', properties: { scores: { type: 'array' } } },
      inputPorts: [
        { name: 'partners', type: 'array', description: '伙伴', required: true },
        { name: 'revenue_dependency', type: 'object', description: '依赖度', required: false }
      ],
      outputPorts: [{ name: 'scores', type: 'array', description: '风险评分' }]
    })
  }
}
