import type { AnalyzeResponse, TimelineEdge, TimelineNode } from '../types.js';
export type AgentAnalyzeButtonProps = {
    question: string;
    workspaceId: string;
    tenantId?: string;
    userId?: string;
    taskId?: string;
    timeline: TimelineNode[];
    edges: TimelineEdge[];
    endpoint?: string;
    fetchImpl?: typeof fetch;
    onSuccess?: (result: AnalyzeResponse) => void;
    onError?: (error: Error) => void;
    label?: string;
    className?: string;
    disabled?: boolean;
};
export declare function AgentAnalyzeButton(props: AgentAnalyzeButtonProps): JSX.Element;
//# sourceMappingURL=AgentAnalyzeButton.d.ts.map