import { StubDimensionAction } from '../action-base.js'

export default class BreakEvenPointTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'cost-structure',
      actionName: 'break-even-point',
      label: '盈亏平衡点',
      description: '计算月度盈亏平衡所需订单量 / 收入',
      inputSchema: {
        type: 'object',
        properties: {
          unit_price: { type: 'number', description: '客单价', required: true },
          unit_variable_cost: { type: 'number', description: '单位可变成本', required: true },
          monthly_fixed_cost: { type: 'number', description: '月固定成本', required: true }
        },
        required: ['unit_price', 'unit_variable_cost', 'monthly_fixed_cost']
      },
      outputSchema: {
        type: 'object',
        properties: {
          units_needed: { type: 'number' },
          revenue_needed: { type: 'number' },
          contribution_margin: { type: 'number' }
        }
      },
      inputPorts: [
        { name: 'unit_price', type: 'number', description: '单价', required: true },
        { name: 'unit_variable_cost', type: 'number', description: '单位变动成本', required: true },
        { name: 'monthly_fixed_cost', type: 'number', description: '月固定成本', required: true }
      ],
      outputPorts: [
        { name: 'units_needed', type: 'number', description: '订单数' },
        { name: 'revenue_needed', type: 'number', description: '收入' },
        { name: 'contribution_margin', type: 'number', description: '贡献利润' }
      ]
    })
  }
}
