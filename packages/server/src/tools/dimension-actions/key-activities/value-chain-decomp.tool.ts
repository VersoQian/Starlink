import { StubDimensionAction } from '../action-base.js'

export default class ValueChainDecompTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-activities',
      actionName: 'value-chain-decomp',
      label: '价值链分解',
      description: '按 Porter 价值链分解为主活动 + 支持活动',
      inputSchema: {
        type: 'object',
        properties: {
          business_description: { type: 'string', description: '业务描述', required: true }
        },
        required: ['business_description']
      },
      outputSchema: {
        type: 'object',
        properties: { primary: { type: 'array' }, support: { type: 'array' } }
      },
      inputPorts: [
        { name: 'business_description', type: 'string', description: '业务描述', required: true }
      ],
      outputPorts: [
        { name: 'primary', type: 'array', description: '主活动' },
        { name: 'support', type: 'array', description: '支持活动' }
      ]
    })
  }
}
