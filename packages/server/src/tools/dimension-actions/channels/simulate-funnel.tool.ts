import { StubDimensionAction } from '../action-base.js'

export default class SimulateFunnelTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'channels',
      actionName: 'simulate-funnel',
      label: '转化漏斗仿真',
      description: '给定渠道组合 + 各环节转化率，仿真全漏斗 + 输出瓶颈',
      inputSchema: {
        type: 'object',
        properties: {
          channel_mix: { type: 'array', description: '渠道组合', required: true },
          stage_rates: { type: 'object', description: '各阶段转化率', required: true },
          impressions: { type: 'number', description: '总曝光量', required: true }
        },
        required: ['channel_mix', 'stage_rates', 'impressions']
      },
      outputSchema: {
        type: 'object',
        properties: {
          funnel: { type: 'array' },
          bottleneck_stage: { type: 'string' }
        }
      },
      inputPorts: [
        { name: 'channel_mix', type: 'array', description: '组合', required: true },
        { name: 'stage_rates', type: 'object', description: '转化率', required: true },
        { name: 'impressions', type: 'number', description: '曝光量', required: true }
      ],
      outputPorts: [
        { name: 'funnel', type: 'array', description: '漏斗' },
        { name: 'bottleneck_stage', type: 'string', description: '瓶颈' }
      ]
    })
  }
}
