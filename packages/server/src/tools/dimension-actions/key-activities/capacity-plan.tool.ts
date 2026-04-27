import { StubDimensionAction } from '../action-base.js'

export default class CapacityPlanTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-activities',
      actionName: 'capacity-plan',
      label: '产能规划',
      description: '按订单量预测产能（人/设备/软件实例）所需规模',
      inputSchema: {
        type: 'object',
        properties: {
          demand_forecast: { type: 'array', description: '需求预测', required: true },
          per_unit_throughput: { type: 'number', description: '吞吐量', required: true }
        },
        required: ['demand_forecast', 'per_unit_throughput']
      },
      outputSchema: { type: 'object', properties: { plan: { type: 'array' } } },
      inputPorts: [
        { name: 'demand_forecast', type: 'array', description: '需求预测', required: true },
        { name: 'per_unit_throughput', type: 'number', description: '吞吐量', required: true }
      ],
      outputPorts: [{ name: 'plan', type: 'array', description: '产能计划' }]
    })
  }
}
