import { StubDimensionAction } from '../action-base.js'

export default class PartnerTierMapTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-partnerships',
      actionName: 'partner-tier-map',
      label: '合作伙伴分层',
      description: '按战略重要性分层 + 治理频率建议',
      inputSchema: {
        type: 'object',
        properties: {
          partners: { type: 'array', description: '伙伴列表', required: true }
        },
        required: ['partners']
      },
      outputSchema: { type: 'object', properties: { tiers: { type: 'array' } } },
      inputPorts: [
        { name: 'partners', type: 'array', description: '伙伴', required: true }
      ],
      outputPorts: [{ name: 'tiers', type: 'array', description: '分层结果' }]
    })
  }
}
