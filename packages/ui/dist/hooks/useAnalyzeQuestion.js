'use client';
import { useMutation } from '@tanstack/react-query';
async function requestAnalysis(endpoint, payload, fetchImpl) {
    const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || '分析服务返回错误');
    }
    const data = (await response.json());
    return data;
}
export function useAnalyzeQuestion(options = {}) {
    const { endpoint = '/api/analyze', fetchImpl = fetch, mutationOptions } = options;
    return useMutation({
        mutationFn: (payload) => requestAnalysis(endpoint, payload, fetchImpl),
        ...mutationOptions
    });
}
