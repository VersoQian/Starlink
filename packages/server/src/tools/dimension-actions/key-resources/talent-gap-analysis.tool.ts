import { StubDimensionAction } from '../action-base.js'

export default class TalentGapAnalysisTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-resources',
      actionName: 'talent-gap-analysis',
      label: '人才缺口分析',
      description: '基于业务阶段识别关键岗位需求与现有团队缺口',
      inputSchema: {
        type: 'object',
        properties: {
          business_stage: { type: 'string', description: '阶段', required: true },
          current_team: { type: 'array', description: '当前团队', required: true },
          growth_goals: { type: 'object', description: '增长目标' }
        },
        required: ['business_stage', 'current_team']
      },
      outputSchema: { type: 'object', properties: { gaps: { type: 'array' } } },
      inputPorts: [
        { name: 'business_stage', type: 'string', description: '阶段', required: true },
        { name: 'current_team', type: 'array', description: '团队', required: true },
        { name: 'growth_goals', type: 'object', description: '目标', required: false }
      ],
      outputPorts: [{ name: 'gaps', type: 'array', description: '人才缺口' }]
    })
  }
}
