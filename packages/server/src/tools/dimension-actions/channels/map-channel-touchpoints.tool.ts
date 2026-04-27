import { StubDimensionAction } from '../action-base.js'

export default class MapChannelTouchpointsTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'channels',
      actionName: 'map-channel-touchpoints',
      label: '渠道触点映射',
      description: '将用户旅程映射到线上 / 线下各渠道触点',
      inputSchema: {
        type: 'object',
        properties: {
          journey_stages: { type: 'array', description: '旅程阶段', required: true },
          candidate_channels: { type: 'array', description: '候选渠道' }
        },
        required: ['journey_stages']
      },
      outputSchema: {
        type: 'object',
        properties: { touchpoints: { type: 'array', description: '{ stage, channel, role }[]' } }
      },
      inputPorts: [
        { name: 'journey_stages', type: 'array', description: '阶段', required: true },
        { name: 'candidate_channels', type: 'array', description: '候选', required: false }
      ],
      outputPorts: [{ name: 'touchpoints', type: 'array', description: '触点映射' }]
    })
  }
}
