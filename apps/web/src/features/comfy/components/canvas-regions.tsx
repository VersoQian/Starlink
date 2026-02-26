'use client'

import { memo } from 'react'
import { useViewport } from 'reactflow'

// CC-BMC 区域定义 - 与后端 DOMAIN_POSITIONS 保持一致
const BMC_REGIONS = [
  {
    id: 'supply-chain',
    label: '供应链与运营',
    sublabel: 'Supply Chain & Operations',
    x: 50,
    y: 50,
    width: 480,
    height: 950,
    gradient: 'from-cyan-500/5 to-cyan-600/10',
    borderColor: 'rgba(6, 182, 212, 0.2)',
    accentColor: '#06b6d4',
    domains: ['重要合作', '关键业务', '核心资源']
  },
  {
    id: 'value-core',
    label: '价值核心',
    sublabel: 'Value Core',
    x: 560,
    y: 350,
    width: 380,
    height: 350,
    gradient: 'from-amber-500/10 to-orange-500/15',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    accentColor: '#fbbf24',
    domains: ['价值主张']
  },
  {
    id: 'customer-market',
    label: '客户与市场',
    sublabel: 'Customer & Market',
    x: 970,
    y: 50,
    width: 480,
    height: 950,
    gradient: 'from-emerald-500/5 to-emerald-600/10',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    accentColor: '#10b981',
    domains: ['客户细分', '客户关系', '渠道通路']
  },
  {
    id: 'finance',
    label: '财务结构',
    sublabel: 'Financial Structure',
    x: 50,
    y: 1030,
    width: 1400,
    height: 280,
    gradient: 'from-pink-500/5 to-pink-600/10',
    borderColor: 'rgba(244, 114, 182, 0.2)',
    accentColor: '#f472b6',
    domains: ['成本结构', '收入来源']
  }
]

export const CanvasRegions = memo(() => {
  const { x, y, zoom } = useViewport()

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      style={{
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        transformOrigin: '0 0'
      }}
    >
      <svg
        width="2000"
        height="1500"
        viewBox="0 0 2000 1500"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          {BMC_REGIONS.map((region) => (
            <linearGradient key={`gradient-${region.id}`} id={`gradient-${region.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={region.accentColor} stopOpacity="0.03" />
              <stop offset="100%" stopColor={region.accentColor} stopOpacity="0.08" />
            </linearGradient>
          ))}

          {/* 噪点纹理 */}
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
            <feBlend mode="multiply" in="SourceGraphic" />
          </filter>

          {/* 光晕效果 */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* 绘制区域背景和边框 */}
        {BMC_REGIONS.map((region) => (
          <g key={region.id}>
            {/* 背景填充 */}
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill={`url(#gradient-${region.id})`}
              rx="24"
              ry="24"
              opacity="0.4"
            />

            {/* 边框 - 双层描边效果 */}
            <rect
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              fill="none"
              stroke={region.borderColor}
              strokeWidth="2"
              strokeDasharray="12 8"
              rx="24"
              ry="24"
              opacity="0.6"
            >
              {/* 动画虚线 */}
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="20"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>

            {/* 外层光晕边框 */}
            <rect
              x={region.x - 2}
              y={region.y - 2}
              width={region.width + 4}
              height={region.height + 4}
              fill="none"
              stroke={region.accentColor}
              strokeWidth="1"
              rx="26"
              ry="26"
              opacity="0.15"
              filter="url(#glow)"
            />
          </g>
        ))}
      </svg>

      {/* 区域标签 - 使用 HTML 以获得更好的排版 */}
      {BMC_REGIONS.map((region) => (
        <div
          key={`label-${region.id}`}
          className="absolute pointer-events-none"
          style={{
            left: `${region.x + 20}px`,
            top: `${region.y + 20}px`,
            transform: 'translate(0, 0)'
          }}
        >
          {/* 主标签背景 */}
          <div
            className="inline-flex flex-col gap-1 px-6 py-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${region.accentColor}15, ${region.accentColor}08)`,
              borderColor: region.borderColor,
              boxShadow: `0 8px 32px ${region.accentColor}20, inset 0 1px 0 rgba(255,255,255,0.1)`
            }}
          >
            <div
              className="text-sm font-black uppercase tracking-widest"
              style={{
                color: region.accentColor,
                fontFamily: "'Outfit', sans-serif",
                textShadow: `0 0 20px ${region.accentColor}40`
              }}
            >
              {region.label}
            </div>
            <div
              className="text-[10px] font-semibold uppercase tracking-wider opacity-60"
              style={{
                color: region.accentColor,
                fontFamily: "'JetBrains Mono', monospace"
              }}
            >
              {region.sublabel}
            </div>
          </div>

          {/* 维度标签列表 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {region.domains.map((domain, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide backdrop-blur-md"
                style={{
                  background: `${region.accentColor}10`,
                  borderColor: region.borderColor,
                  color: region.accentColor,
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: `0 4px 12px ${region.accentColor}15`
                }}
              >
                {domain}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 画布中心指示器 - 精致的十字线 */}
      <svg
        width="2000"
        height="1500"
        viewBox="0 0 2000 1500"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <line
          x1="700"
          y1="0"
          x2="700"
          y2="1500"
          stroke="rgba(251, 191, 36, 0.08)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
        <line
          x1="0"
          y1="500"
          x2="2000"
          y2="500"
          stroke="rgba(251, 191, 36, 0.08)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
      </svg>

      {/* 顶部图例说明 */}
      <div
        className="absolute top-6 right-6 backdrop-blur-xl border rounded-2xl px-6 py-4 shadow-2xl"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3" style={{ fontFamily: "'Outfit', sans-serif" }}>
          CC-BMC 九维结构
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
          {BMC_REGIONS.map((region) => (
            <div key={`legend-${region.id}`} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border-2"
                style={{
                  backgroundColor: `${region.accentColor}30`,
                  borderColor: region.accentColor,
                  boxShadow: `0 0 8px ${region.accentColor}40`
                }}
              />
              <span className="text-slate-300 font-medium" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                {region.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

CanvasRegions.displayName = 'CanvasRegions'
