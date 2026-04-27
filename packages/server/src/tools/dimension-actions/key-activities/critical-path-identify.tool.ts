import { StubDimensionAction } from '../action-base.js'

export default class CriticalPathIdentifyTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-activities',
      actionName: 'critical-path-identify',
      label: '关键路径识别',
      description: '识别交付 VP 所需关键活动路径，标注每步时间 + 负责人',
      inputSchema: {
        type: 'object',
        properties: {
          vp: { type: 'string', description: 'VP', required: true },
          delivery_milestone: { type: 'string', description: '里程碑', required: true }
        },
        required: ['vp', 'delivery_milestone']
      },
      outputSchema: { type: 'object', properties: { path: { type: 'array' } } },
      inputPorts: [
        { name: 'vp', type: 'string', description: 'VP', required: true },
        { name: 'delivery_milestone', type: 'string', description: '里程碑', required: true }
      ],
      outputPorts: [{ name: 'path', type: 'array', description: '关键路径' }]
    })
  }
}
