import { StubDimensionAction } from '../action-base.js'

export default class ChurnRiskAnalysisTool extends StubDimensionAction {
  constructor() {
    super({
      dimension: 'customer-relationships',
      actionName: 'churn-risk-analysis',
      label: '流失风险分析',
      description: '估计流失触发因素 + 流失预警信号',
      inputSchema: {
        type: 'object',
        properties: {
          segment: { type: 'string', description: '目标客群', required: true },
          product_context: { type: 'string', description: '产品描述', required: true },
          competitor_landscape: { type: 'array', description: '竞品数组' }
        },
        required: ['segment', 'product_context']
      },
      outputSchema: {
        type: 'object',
        properties: {
          risk_factors: { type: 'array' },
          estimated_annual_churn: { type: 'number' }
        }
      },
      inputPorts: [
        { name: 'segment', type: 'string', description: '客群', required: true },
        { name: 'product_context', type: 'string', description: '产品', required: true },
        { name: 'competitor_landscape', type: 'array', description: '竞品', required: false }
      ],
      outputPorts: [
        { name: 'risk_factors', type: 'array', description: '风险' },
        { name: 'estimated_annual_churn', type: 'number', description: '流失率' }
      ]
    })
  }
}
