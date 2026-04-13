import { AgentAvatarNode } from './nodes/agent-avatar-node'
import { AgentNode } from './nodes/agent-node'
import { CanvasImageNode } from './nodes/canvas-image-node'
import { CanvasNoteNode } from './nodes/canvas-note-node'
import { CCBMCCardNode } from './nodes/cc-bmc-card-node'
import { ConflictAlertNode } from './nodes/conflict-alert-node'
import { DataSourceNode } from './nodes/data-source-node'
import { InsightNoteNode } from './nodes/insight-note-node'
import { PlanNode } from './nodes/plan-node'
import { ResourceNode } from './nodes/resource-node'
import { ResultNode } from './nodes/result-node'

export const comfyNodeTypes = {
  resource: ResourceNode,
  agent: AgentNode,
  result: ResultNode,
  'agent-avatar': AgentAvatarNode,
  'cc-bmc-card': CCBMCCardNode,
  'cc-bmc-customer-segments': CCBMCCardNode,
  'cc-bmc-customer-relationships': CCBMCCardNode,
  'cc-bmc-channels': CCBMCCardNode,
  'cc-bmc-value-propositions': CCBMCCardNode,
  'cc-bmc-revenue-streams': CCBMCCardNode,
  'cc-bmc-key-activities': CCBMCCardNode,
  'cc-bmc-key-resources': CCBMCCardNode,
  'cc-bmc-key-partnerships': CCBMCCardNode,
  'cc-bmc-cost-structure': CCBMCCardNode,
  'conflict-alert': ConflictAlertNode,
  'insight-note': InsightNoteNode,
  'plan-node': PlanNode,
  'data-source': DataSourceNode,
  'canvas-note': CanvasNoteNode,
  'canvas-image': CanvasImageNode,
}

export const COMFY_NODE_PALETTE = [
  {
    type: 'cc-bmc-card',
    label: '商业卡片',
    icon: '💎',
    gradient: 'from-amber-400 to-amber-500',
    description: '核心业务模型卡片',
  },
  {
    type: 'agent-avatar',
    label: 'AI 顾问',
    icon: '🤖',
    gradient: 'from-emerald-400 to-emerald-500',
    description: '虚拟专家顾问',
  },
  {
    type: 'insight-note',
    label: '洞察便签',
    icon: '💡',
    gradient: 'from-blue-400 to-blue-500',
    description: 'AI 生成的洞察',
  },
  {
    type: 'data-source',
    label: '数据源',
    icon: '🗂️',
    gradient: 'from-cyan-400 to-sky-500',
    description: '研究资料与数据输入',
  },
  {
    type: 'resource',
    label: '资源',
    icon: '📁',
    gradient: 'from-slate-400 to-slate-500',
    description: '文档或数据源',
  },
] as const
