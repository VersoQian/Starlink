import { StubDimensionAction } from '../action-base.js'

export default class AssetInventoryTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-resources',
      actionName: 'asset-inventory',
      label: '关键资产清单',
      description: '梳理企业关键资产 + 给出盘活建议',
      inputSchema: {
        type: 'object',
        properties: {
          company_description: { type: 'string', description: '公司描述', required: true },
          industry: { type: 'string', description: '行业' }
        },
        required: ['company_description']
      },
      outputSchema: { type: 'object', properties: { inventory: { type: 'array' } } },
      inputPorts: [
        { name: 'company_description', type: 'string', description: '描述', required: true },
        { name: 'industry', type: 'string', description: '行业', required: false }
      ],
      outputPorts: [{ name: 'inventory', type: 'array', description: '资产清单' }]
    })
  }
}
