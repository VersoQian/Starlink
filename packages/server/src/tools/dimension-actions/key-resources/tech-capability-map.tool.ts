import { StubDimensionAction } from '../action-base.js'

export default class TechCapabilityMapTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'key-resources',
      actionName: 'tech-capability-map',
      label: '技术能力矩阵',
      description: '将技术栈与 VP 关键能力对齐，识别能力缺口与外部依赖',
      inputSchema: {
        type: 'object',
        properties: {
          vp: { type: 'string', description: 'VP', required: true },
          current_stack: { type: 'array', description: '当前技术栈', required: true }
        },
        required: ['vp', 'current_stack']
      },
      outputSchema: { type: 'object', properties: { matrix: { type: 'array' } } },
      inputPorts: [
        { name: 'vp', type: 'string', description: 'VP', required: true },
        { name: 'current_stack', type: 'array', description: '技术栈', required: true }
      ],
      outputPorts: [{ name: 'matrix', type: 'array', description: '能力矩阵' }]
    })
  }
}
