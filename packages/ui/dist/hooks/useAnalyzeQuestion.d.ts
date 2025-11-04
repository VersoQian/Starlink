import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import type { AnalyzeRequest, AnalyzeResponse } from '../types.js';
export type UseAnalyzeQuestionOptions = {
    endpoint?: string;
    fetchImpl?: typeof fetch;
    mutationOptions?: UseMutationOptions<AnalyzeResponse, Error, AnalyzeRequest, unknown>;
};
export declare function useAnalyzeQuestion(options?: UseAnalyzeQuestionOptions): UseMutationResult<AnalyzeResponse, Error, AnalyzeRequest, unknown>;
//# sourceMappingURL=useAnalyzeQuestion.d.ts.map