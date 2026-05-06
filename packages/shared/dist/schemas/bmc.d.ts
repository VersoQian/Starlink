import { z } from 'zod';
export declare const ccBmcDomainSchema: z.ZodEnum<["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"]>;
export declare const ccBmcDomains: ["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"];
export declare const bmcAgentSignatureSchema: z.ZodEnum<["Market_Agent", "Product_Agent", "Finance_Agent", "Compliance_Agent", "Orchestrator", "Adversarial_Critic"]>;
export declare const bmcConfidenceSchema: z.ZodEnum<["high", "medium", "low"]>;
export declare const bmcCompactCardContextSchema: z.ZodObject<{
    id: z.ZodString;
    domain: z.ZodOptional<z.ZodEnum<["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"]>>;
    label: z.ZodString;
    agentSignature: z.ZodOptional<z.ZodEnum<["Market_Agent", "Product_Agent", "Finance_Agent", "Compliance_Agent", "Orchestrator", "Adversarial_Critic"]>>;
    confidence: z.ZodOptional<z.ZodEnum<["high", "medium", "low"]>>;
    keyClaims: z.ZodArray<z.ZodString, "many">;
    assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    risks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    evidenceRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    keyClaims: string[];
    assumptions: string[];
    risks: string[];
    evidenceRefs: string[];
    domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
    agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
    confidence?: "high" | "medium" | "low" | undefined;
}, {
    id: string;
    label: string;
    keyClaims: string[];
    domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
    agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
    confidence?: "high" | "medium" | "low" | undefined;
    assumptions?: string[] | undefined;
    risks?: string[] | undefined;
    evidenceRefs?: string[] | undefined;
}>;
export declare const bmcCompactContextSchema: z.ZodObject<{
    cards: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        domain: z.ZodOptional<z.ZodEnum<["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"]>>;
        label: z.ZodString;
        agentSignature: z.ZodOptional<z.ZodEnum<["Market_Agent", "Product_Agent", "Finance_Agent", "Compliance_Agent", "Orchestrator", "Adversarial_Critic"]>>;
        confidence: z.ZodOptional<z.ZodEnum<["high", "medium", "low"]>>;
        keyClaims: z.ZodArray<z.ZodString, "many">;
        assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        risks: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        evidenceRefs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        keyClaims: string[];
        assumptions: string[];
        risks: string[];
        evidenceRefs: string[];
        domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
        agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
        confidence?: "high" | "medium" | "low" | undefined;
    }, {
        id: string;
        label: string;
        keyClaims: string[];
        domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
        agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
        confidence?: "high" | "medium" | "low" | undefined;
        assumptions?: string[] | undefined;
        risks?: string[] | undefined;
        evidenceRefs?: string[] | undefined;
    }>, "many">;
    notes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    cards: {
        id: string;
        label: string;
        keyClaims: string[];
        assumptions: string[];
        risks: string[];
        evidenceRefs: string[];
        domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
        agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
        confidence?: "high" | "medium" | "low" | undefined;
    }[];
    notes: string[];
}, {
    cards: {
        id: string;
        label: string;
        keyClaims: string[];
        domain?: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构" | undefined;
        agentSignature?: "Market_Agent" | "Product_Agent" | "Finance_Agent" | "Compliance_Agent" | "Orchestrator" | "Adversarial_Critic" | undefined;
        confidence?: "high" | "medium" | "low" | undefined;
        assumptions?: string[] | undefined;
        risks?: string[] | undefined;
        evidenceRefs?: string[] | undefined;
    }[];
    notes?: string[] | undefined;
}>;
export declare const bmcAnalysisCardSchema: z.ZodEffects<z.ZodObject<{
    domain: z.ZodEnum<["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"]>;
    /**
     * One-line conclusion (≤60 chars). Surfaces as the BMC card title and
     * the drawer "摘要" section. Optional for back-compat with older agent
     * outputs that only emit content; the drawer derives summary from
     * content's first sentence when missing.
     */
    summary: z.ZodOptional<z.ZodString>;
    /**
     * Detailed analysis (3-6 paragraphs / 200-600 chars). Drawer's full
     * detail section. May be empty when the agent only has a 1-sentence
     * answer (then summary holds the result, content stays "").
     */
    content: z.ZodString;
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    content: string;
    domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
    confidence: number;
    summary?: string | undefined;
}, {
    content: string;
    domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
    confidence: number;
    summary?: string | undefined;
}>, {
    content: string;
    domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
    confidence: number;
    summary?: string | undefined;
}, {
    content: string;
    domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
    confidence: number;
    summary?: string | undefined;
}>;
export declare const bmcAnalysisSchema: z.ZodObject<{
    bmcCards: z.ZodArray<z.ZodEffects<z.ZodObject<{
        domain: z.ZodEnum<["客户细分", "客户关系", "渠道通路", "价值主张", "收入来源", "关键业务", "核心资源", "重要合作", "成本结构"]>;
        /**
         * One-line conclusion (≤60 chars). Surfaces as the BMC card title and
         * the drawer "摘要" section. Optional for back-compat with older agent
         * outputs that only emit content; the drawer derives summary from
         * content's first sentence when missing.
         */
        summary: z.ZodOptional<z.ZodString>;
        /**
         * Detailed analysis (3-6 paragraphs / 200-600 chars). Drawer's full
         * detail section. May be empty when the agent only has a 1-sentence
         * answer (then summary holds the result, content stays "").
         */
        content: z.ZodString;
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }, {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }>, {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }, {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    bmcCards: {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }[];
}, {
    bmcCards: {
        content: string;
        domain: "客户细分" | "客户关系" | "渠道通路" | "价值主张" | "收入来源" | "关键业务" | "核心资源" | "重要合作" | "成本结构";
        confidence: number;
        summary?: string | undefined;
    }[];
}>;
export type CcBmcDomain = z.infer<typeof ccBmcDomainSchema>;
export type BmcAgentSignature = z.infer<typeof bmcAgentSignatureSchema>;
export type BmcCompactCardContext = z.infer<typeof bmcCompactCardContextSchema>;
export type BmcCompactContext = z.infer<typeof bmcCompactContextSchema>;
export type BmcAnalysisCard = z.infer<typeof bmcAnalysisCardSchema>;
export type BmcAnalysis = z.infer<typeof bmcAnalysisSchema>;
