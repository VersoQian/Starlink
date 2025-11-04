import type { CanvasEdge, CanvasNode } from '@branching-chat/shared';
import type { AgentContext, CanvasExecutionState } from './types.js';
export declare function buildInitialState(ctx: AgentContext): CanvasExecutionState;
export declare function pushNode(state: CanvasExecutionState, node: CanvasNode, edge?: CanvasEdge): void;
export declare function pushNodes(state: CanvasExecutionState, nodes: CanvasNode[], edges: CanvasEdge[]): void;
export declare function createNodeId(prefix: string): string;
