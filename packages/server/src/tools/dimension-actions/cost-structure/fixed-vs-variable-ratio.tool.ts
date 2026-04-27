import { StubDimensionAction } from '../action-base.js'

export default class FixedVsVariableRatioTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'cost-structure',
      actionName: 'fixed-vs-variable-ratio',
      label: '固定/可变成本比',
      description: '把成本归类为固定/可变 + 固定占比 → 业务杠杆强度',
      inputSchema: {
        type: 'object',
        properties: {
          cost_items: { type: 'array', description: '成本项', required: true }
        },
        required: ['cost_items']
      },
      outputSchema: {
        type: 'object',
        properties: {
          fixed_ratio: { type: 'number' },
          classification: { type: 'array' }
        }
      },
      inputPorts: [
        { name: 'cost_items', type: 'array', description: '成本项', required: true }
      ],
      outputPorts: [
        { name: 'fixed_ratio', type: 'number', description: '固定占比' },
        { name: 'classification', type: 'array', description: '分类' }
      ]
    })
  }
}
