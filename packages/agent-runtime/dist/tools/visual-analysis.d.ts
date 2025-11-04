import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import type { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
export declare const visualizationChartTypes: readonly ["bar", "line", "pie", "stacked_bar", "area", "scatter", "table", "geo"];
export type VisualizationChartType = (typeof visualizationChartTypes)[number];
export type VisualizationAnalysisRequest = {
    datasetSummary: string;
    goal: string;
    preferredVisuals?: VisualizationChartType[];
    audience?: 'executive' | 'marketing' | 'product' | 'general';
    emphasizeNarrative?: boolean;
    constraints?: string;
};
export type VisualizationAnalysisChart = {
    type: VisualizationChartType;
    title: string;
    description: string;
    xField: string;
    yField?: string;
    breakdownField?: string;
    notes?: string[];
};
export type VisualizationAnalysisResult = {
    charts: VisualizationAnalysisChart[];
    insights: string[];
    narrative?: string;
    followUpActions?: string[];
    checks?: string[];
};
type VisualizationModelOptions = BaseChatModelCallOptions & {
    responseFormat?: 'json' | 'text';
};
export declare function resolveVisualizationModel(): BaseChatModel<VisualizationModelOptions>;
export declare function runVisualizationAnalysis(input: VisualizationAnalysisRequest, llm?: BaseChatModel<VisualizationModelOptions>): Promise<VisualizationAnalysisResult>;
export declare function createVisualizationAnalysisTool(llm: BaseChatModel<VisualizationModelOptions>): DynamicStructuredTool<z.ZodObject<{
    datasetSummary: z.ZodString;
    goal: z.ZodString;
    preferredVisuals: z.ZodOptional<z.ZodArray<z.ZodEnum<["bar", "line", "pie", "stacked_bar", "area", "scatter", "table", "geo"]>, "many">>;
    audience: z.ZodOptional<z.ZodEnum<["executive", "marketing", "product", "general"]>>;
    emphasizeNarrative: z.ZodOptional<z.ZodBoolean>;
    constraints: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    datasetSummary: string;
    goal: string;
    preferredVisuals?: ("bar" | "line" | "pie" | "stacked_bar" | "area" | "scatter" | "table" | "geo")[] | undefined;
    audience?: "executive" | "marketing" | "product" | "general" | undefined;
    emphasizeNarrative?: boolean | undefined;
    constraints?: string | undefined;
}, {
    datasetSummary: string;
    goal: string;
    preferredVisuals?: ("bar" | "line" | "pie" | "stacked_bar" | "area" | "scatter" | "table" | "geo")[] | undefined;
    audience?: "executive" | "marketing" | "product" | "general" | undefined;
    emphasizeNarrative?: boolean | undefined;
    constraints?: string | undefined;
}>, {
    datasetSummary: string;
    goal: string;
    preferredVisuals?: ("bar" | "line" | "pie" | "stacked_bar" | "area" | "scatter" | "table" | "geo")[] | undefined;
    audience?: "executive" | "marketing" | "product" | "general" | undefined;
    emphasizeNarrative?: boolean | undefined;
    constraints?: string | undefined;
}, {
    datasetSummary: string;
    goal: string;
    preferredVisuals?: ("bar" | "line" | "pie" | "stacked_bar" | "area" | "scatter" | "table" | "geo")[] | undefined;
    audience?: "executive" | "marketing" | "product" | "general" | undefined;
    emphasizeNarrative?: boolean | undefined;
    constraints?: string | undefined;
}, string>;
export {};
