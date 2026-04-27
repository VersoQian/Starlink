import { StubDimensionAction } from '../action-base.js'

export default class CostBreakdownTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'cost-structure',
      actionName: 'cost-breakdown',
      label: '成本结构拆分',
      description: '将总成本拆分为人员 / 基础设施 / 营销 / 履约 / 研发等',
      inputSchema: {
        type: 'object',
        properties: {
          business_stage: { type: 'string', description: '业务阶段', required: true },
          revenue_forecast: { type: 'number', description: '预期年收入' }
        },
        required: ['business_stage']
      },
      outputSchema: { type: 'object', properties: { breakdown: { type: 'array' } } },
      inputPorts: [
        { name: 'business_stage', type: 'string', description: '阶段', required: true },
        { name: 'revenue_forecast', type: 'number', description: '收入', required: false }
      ],
      outputPorts: [{ name: 'breakdown', type: 'array', description: '成本分解' }]
    })
  }
}
