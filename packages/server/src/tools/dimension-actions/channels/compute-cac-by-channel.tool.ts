import { StubDimensionAction } from '../action-base.js'

export default class ComputeCacByChannelTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'channels',
      actionName: 'compute-cac-by-channel',
      label: '渠道 CAC 测算',
      description: '估算各渠道获客成本（CAC），结合触达率、转化率',
      inputSchema: {
        type: 'object',
        properties: {
          channels: { type: 'array', description: '渠道元数据', required: true },
          target_volume: { type: 'number', description: '目标获客数量', required: true }
        },
        required: ['channels', 'target_volume']
      },
      outputSchema: {
        type: 'object',
        properties: { cac_breakdown: { type: 'array' } }
      },
      inputPorts: [
        { name: 'channels', type: 'array', description: '渠道', required: true },
        { name: 'target_volume', type: 'number', description: '目标', required: true }
      ],
      outputPorts: [{ name: 'cac_breakdown', type: 'array', description: 'CAC 分解' }]
    })
  }
}
