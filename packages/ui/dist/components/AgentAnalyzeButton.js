'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from 'react';
import { useAnalyzeQuestion } from '../hooks/useAnalyzeQuestion.js';
import clsx from 'clsx';
export function AgentAnalyzeButton(props) {
    const { question, workspaceId, tenantId, userId = 'anonymous', taskId, timeline, edges, endpoint, fetchImpl, onSuccess, onError, label = '生成分析', className, disabled } = props;
    const mutation = useAnalyzeQuestion({
        endpoint,
        fetchImpl,
        mutationOptions: {
            onSuccess,
            onError
        }
    });
    const payload = useMemo(() => ({
        tenantId: tenantId ?? workspaceId,
        userId,
        taskId: taskId ?? `${workspaceId}-default`,
        question,
        timeline,
        edges
    }), [tenantId, workspaceId, userId, taskId, question, timeline, edges]);
    const handleClick = () => {
        if (disabled || mutation.isPending)
            return;
        mutation.mutate(payload);
    };
    return (_jsx("button", { type: "button", onClick: handleClick, disabled: disabled || mutation.isPending, className: clsx('inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300', className), children: mutation.isPending ? '分析中…' : label }));
}
