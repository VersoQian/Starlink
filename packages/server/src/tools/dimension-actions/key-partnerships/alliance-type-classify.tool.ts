import { StubDimensionAction } from '../action-base.js'

export default class AllianceTypeClassifyTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-partnerships',
      actionName: 'alliance-type-classify',
      label: '联盟类型归类',
      description: '战略联盟 / 供应链 / 共享资源 / coopetition + 治理建议',
      inputSchema: {
        type: 'object',
        properties: {
          partnership_descriptions: { type: 'array', description: '合作关系描述', required: true }
        },
        required: ['partnership_descriptions']
      },
      outputSchema: { type: 'object', properties: { classifications: { type: 'array' } } },
      inputPorts: [
        { name: 'partnership_descriptions', type: 'array', description: '合作描述', required: true }
      ],
      outputPorts: [{ name: 'classifications', type: 'array', description: '分类' }]
    })
  }
}
