import { z } from 'zod'

export const ccBmcDomainSchema = z.enum([
  '客户细分',
  '客户关系',
  '渠道通路',
  '价值主张',
  '收入来源',
  '关键业务',
  '核心资源',
  '重要合作',
  '成本结构'
])

export const ccBmcDomains = ccBmcDomainSchema.options

export const bmcAgentSignatureSchema = z.enum([
  'Market_Agent',
  'Product_Agent',
  'Finance_Agent',
  'Compliance_Agent',
  'Orchestrator',
  'Adversarial_Critic'
])

export const bmcConfidenceSchema = z.enum(['high', 'medium', 'low'])

export const bmcCompactCardContextSchema = z.object({
  id: z.string(),
  domain: ccBmcDomainSchema.optional(),
  label: z.string(),
  agentSignature: bmcAgentSignatureSchema.optional(),
  confidence: bmcConfidenceSchema.optional(),
  keyClaims: z.array(z.string()).max(5),
  assumptions: z.array(z.string()).max(3).default([]),
  risks: z.array(z.string()).max(3).default([]),
  evidenceRefs: z.array(z.string()).max(8).default([])
})

export const bmcCompactContextSchema = z.object({
  cards: z.array(bmcCompactCardContextSchema),
  notes: z.array(z.string()).default([])
})

export const bmcAnalysisCardSchema = z.object({
  domain: ccBmcDomainSchema,
  content: z.string().min(1),
  confidence: z.number().min(0).max(1)
})

export const bmcAnalysisSchema = z.object({
  bmcCards: z.array(bmcAnalysisCardSchema)
})

export type CcBmcDomain = z.infer<typeof ccBmcDomainSchema>
export type BmcAgentSignature = z.infer<typeof bmcAgentSignatureSchema>
export type BmcCompactCardContext = z.infer<typeof bmcCompactCardContextSchema>
export type BmcCompactContext = z.infer<typeof bmcCompactContextSchema>
export type BmcAnalysisCard = z.infer<typeof bmcAnalysisCardSchema>
export type BmcAnalysis = z.infer<typeof bmcAnalysisSchema>
