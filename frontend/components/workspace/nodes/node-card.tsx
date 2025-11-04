'use client'

import { type ReactNode } from 'react'
import clsx from 'clsx'

type NodeCardProps = {
  icon?: ReactNode
  title: string
  subtitle?: string
  children?: ReactNode
  footer?: ReactNode
  accent?: boolean
  bodyClassName?: string
  width?: number
  badgeLabel?: string
  badgeTone?: 'neutral' | 'purple' | 'blue' | 'pink' | 'green' | 'orange'
}

const BADGE_CLASSNAME: Record<NonNullable<NodeCardProps['badgeTone']>, string> = {
  neutral: 'bg-[#EEF1FF] text-[#7C80A9]',
  purple: 'bg-[#F1E7FF] text-[#7A4CE5]',
  blue: 'bg-[#E6F1FF] text-[#3563C8]',
  pink: 'bg-[#FFE7F1] text-[#C94D92]',
  green: 'bg-[#E6F8EE] text-[#2E9B66]',
  orange: 'bg-[#FFF2E0] text-[#CD6B2D]'
}

export function NodeCard({
  icon,
  title,
  subtitle,
  children,
  footer,
  accent = false,
  bodyClassName,
  width,
  badgeLabel,
  badgeTone = 'neutral'
}: NodeCardProps) {
  return (
    <div
      className={clsx(
        'group relative rounded-[32px] border transition-shadow',
        accent ? 'border-[#b9b5ff]/70 bg-white' : 'border-white/80 bg-white/95',
        'shadow-[0px_30px_60px_-45px_rgba(66,76,117,0.45)] backdrop-blur'
      )}
      style={{ width: width ?? 360 }}
    >
      <div className="flex items-center gap-3 px-6 pb-2 pt-6">
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ECE7FF] to-[#F6F8FF] text-xl text-[#6f5ce6] shadow-inner">
            {icon}
          </span>
        )}
        <div className="flex flex-col">
          <span className="text-lg font-semibold text-slate-900">{title}</span>
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        </div>
        {badgeLabel && (
          <span
            className={clsx(
              'ml-auto rounded-full px-3 py-1 text-[11px] font-medium',
              BADGE_CLASSNAME[badgeTone]
            )}
          >
            {badgeLabel}
          </span>
        )}
      </div>

      {children && (
        <div className={clsx('px-6 pb-6 text-sm text-slate-700', bodyClassName)} data-testid="node-card-body">
          {children}
        </div>
      )}

      {footer && (
        <div className="flex items-center gap-3 rounded-b-[32px] border-t border-dashed border-[#E4E7FD] bg-[#F7F8FF] px-6 py-4 text-xs text-[#8286A6]">
          {footer}
        </div>
      )}
    </div>
  )
}
