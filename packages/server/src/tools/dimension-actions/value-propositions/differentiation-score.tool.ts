import { StubDimensionAction } from '../action-base.js'

export default class DifferentiationScoreTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'value-propositions',
      actionName: 'differentiation-score',
      label: '差异化评分',
      description: '对一个价值主张相对竞品的差异化程度打分（0-100）',
      inputSchema: {
        type: 'object',
        properties: {
          vp: { type: 'string', description: '本方 VP', required: true },
          competitors: { type: 'array', description: '竞品列表 { name, vp }', required: true }
        },
        required: ['vp', 'competitors']
      },
      outputSchema: {
        type: 'object',
        properties: { score: { type: 'number' }, feature_matrix: { type: 'array' } }
      },
      inputPorts: [
        { name: 'vp', type: 'string', description: 'VP', required: true },
        { name: 'competitors', type: 'array', description: '竞品', required: true }
      ],
      outputPorts: [
        { name: 'score', type: 'number', description: '差异化分' },
        { name: 'feature_matrix', type: 'array', description: '特征矩阵' }
      ]
    })
  }
}
