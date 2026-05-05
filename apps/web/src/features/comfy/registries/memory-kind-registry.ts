/**
 * Memory-kind registry — pluggable dictionary mapping `MemoryItem.kind`
 * to its visual treatment (icon / tint / label / sort priority).
 *
 * Extension: to add a new memory kind (e.g. 'risk', 'commitment',
 * 'assumption'), append a new entry to KIND_REGISTRY at module load
 * time. The Memory tab + UserSkillChip iterate this registry, so any
 * registered kind appears in the UI without changing render code.
 *
 * Backend kinds (memoryKindSchema in @starlink/shared):
 *   preference / decision / insight / constraint / summary / canvas / user-skill
 * Plus arbitrary future kinds — graceful fallback rendering for unknown.
 */

import type { LucideIcon } from 'lucide-react'
import {
  Bookmark,
  GitBranch,
  Lightbulb,
  Lock,
  FileText,
  LayoutPanelTop,
  User2,
  Sparkles,
} from 'lucide-react'

export type MemoryKindKey =
  | 'preference'
  | 'decision'
  | 'insight'
  | 'constraint'
  | 'summary'
  | 'canvas'
  | 'user-skill'
  | (string & {})

export type MemoryKindDescriptor = {
  key: MemoryKindKey
  /** Short display label (Chinese, used in UI) */
  label: string
  /** Stratum tint class for the kind chip + accent line */
  tintClass: string
  /** Icon shown next to the title */
  icon: LucideIcon
  /** Sort priority (lower = top of list when grouping by kind) */
  sortOrder: number
  /** One-line semantic — appears in tooltip */
  description: string
}

const KIND_REGISTRY: Record<string, MemoryKindDescriptor> = {
  'user-skill': {
    key: 'user-skill',
    label: '用户画像',
    tintClass: 'text-stratum-blue',
    icon: User2,
    sortOrder: 0,
    description: '跨会话提取的用户长期偏好与背景',
  },
  decision: {
    key: 'decision',
    label: '决策',
    tintClass: 'text-stratum-navy',
    icon: GitBranch,
    sortOrder: 1,
    description: '已敲定的关键选择',
  },
  insight: {
    key: 'insight',
    label: '洞察',
    tintClass: 'text-byline-product',
    icon: Lightbulb,
    sortOrder: 2,
    description: '推演中浮现的判断与证据',
  },
  constraint: {
    key: 'constraint',
    label: '约束',
    tintClass: 'text-stratum-danger',
    icon: Lock,
    sortOrder: 3,
    description: '不可逾越的边界与限制',
  },
  preference: {
    key: 'preference',
    label: '偏好',
    tintClass: 'text-byline-market',
    icon: Bookmark,
    sortOrder: 4,
    description: '用户在风格 / 优先级上的取向',
  },
  summary: {
    key: 'summary',
    label: '会话摘要',
    tintClass: 'text-stratum-muted',
    icon: FileText,
    sortOrder: 5,
    description: '对一次会话的浓缩归纳',
  },
  canvas: {
    key: 'canvas',
    label: '画布快照',
    tintClass: 'text-byline-finance',
    icon: LayoutPanelTop,
    sortOrder: 6,
    description: 'BMC 输出 + 节点结构存档',
  },
}

const FALLBACK: MemoryKindDescriptor = {
  key: 'unknown',
  label: '其他',
  tintClass: 'text-stratum-muted',
  icon: Sparkles,
  sortOrder: 99,
  description: '未注册的 memory kind — 保底渲染',
}

/** Resolve an arbitrary kind string to its descriptor (with fallback). */
export function getMemoryKindDescriptor(kind: string): MemoryKindDescriptor {
  return KIND_REGISTRY[kind] ?? { ...FALLBACK, key: kind, label: kind }
}

/** Append or override a kind at runtime (used by plugins). */
export function registerMemoryKind(descriptor: MemoryKindDescriptor): void {
  KIND_REGISTRY[descriptor.key] = descriptor
}

/** Get all registered kinds, sorted by sortOrder. */
export function listRegisteredKinds(): MemoryKindDescriptor[] {
  return Object.values(KIND_REGISTRY).sort((a, b) => a.sortOrder - b.sortOrder)
}
