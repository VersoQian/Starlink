import type { TimelineNode, TimelineEdge } from '../types.js';
export type ParsedTable = {
    headers: string[];
    rows: string[][];
};
export declare const parseCsv: (input: string) => ParsedTable;
export type DataVisualizerProps = {
    title?: string;
    description?: string;
    tenantId?: string;
    taskId?: string;
    timeline?: TimelineNode[];
    edges?: TimelineEdge[];
    onDataExtracted?: (data: ParsedTable) => void;
};
export declare function DataVisualizer({ title, description, onDataExtracted }: DataVisualizerProps): JSX.Element;
//# sourceMappingURL=DataVisualizer.d.ts.map