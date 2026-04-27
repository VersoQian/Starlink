import { StubDimensionAction } from '../action-base.js'

export default class LifecycleStageMapTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'customer-relationships',
      actionName: 'lifecycle-stage-map',
      label: '生命周期阶段映射',
      description: '把客户生命周期 + 各阶段 KPI + 干预动作对应',
      inputSchema: {
        type: 'object',
        properties: {
          business_type: { type: 'string', description: '业务类型', required: true }
        },
        required: ['business_type']
      },
      outputSchema: {
        type: 'object',
        properties: { stages: { type: 'array' } }
      },
      inputPorts: [
        { name: 'business_type', type: 'string', description: '业务类型', required: true }
      ],
      outputPorts: [{ name: 'stages', type: 'array', description: '生命周期阶段' }]
    })
  }
}
