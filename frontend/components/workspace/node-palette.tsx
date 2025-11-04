'use client'

import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { REACT_FLOW_DRAG_TYPE } from '@/lib/drag-constants'

const paletteGroups = [
  {
    title: '知识节点',
    items: [
      { id: 'note', label: '笔记节点', description: '富文本笔记，可@引用资料' },
      { id: 'document', label: '文档摘要', description: '解析文档后生成的节点' },
      { id: 'reference', label: '引用卡片', description: '对文档片段的索引' }
    ]
  },
  {
    title: '行动节点',
    items: [
      { id: 'task', label: '任务', description: '分配责任与截止日期' },
      { id: 'outline', label: 'AI 大纲', description: '自动生成结构列表' }
    ]
  },
  {
    title: '媒体节点',
    items: [
      { id: 'image', label: '图像', description: '上传或抓取的图片' },
      { id: 'web', label: '网页卡片', description: '网页内容快照' }
    ]
  }
]

export function NodePalette() {
  const [openGroup, setOpenGroup] = useState<string | null>('知识节点')
  const [search, setSearch] = useState('')

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return paletteGroups
    return paletteGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label}${item.description}`.toLowerCase().includes(search.toLowerCase())
        )
      }))
      .filter((group) => group.items.length > 0)
  }, [search])

  return (
    <div
      className="pointer-events-auto w-72 rounded-3xl border border-[#E3E6FF] bg-white p-4 shadow-xl backdrop-blur"
      data-testid="node-palette"
    >
      <header className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">节点库</h2>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索节点或模板…"
          className="w-full rounded-xl border border-[#E3E6FF] bg-[#F7F8FF] px-3 py-2 text-xs text-slate-600 outline-none placeholder:text-slate-400 focus:border-[#9B87F5]/60 focus:ring-2 focus:ring-[#9B87F5]/20"
        />
      </header>
      <div className="mt-4 space-y-3">
        {filteredGroups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-[#E3E6FF]">
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-[#F6F7FF] px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-[#ECEEFF]"
              onClick={() => setOpenGroup((current) => (current === group.title ? null : group.title))}
              type="button"
            >
              {group.title}
              <span className="text-slate-400">{openGroup === group.title ? '−' : '+'}</span>
            </button>
            <AnimatePresence initial={false}>
              {openGroup === group.title && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1 overflow-hidden px-3 py-2"
                >
                  {group.items.map((item) => {
                    const draggable = ['note', 'document', 'task', 'reference'].includes(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          draggable={draggable}
                          onDragStart={(event) => {
                            if (!draggable) return
                            event.dataTransfer.setData(REACT_FLOW_DRAG_TYPE, item.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-[#E5E8FF]"
                          data-testid={`palette-item-${item.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{item.label}</p>
                            {!draggable && <span className="text-[10px] text-slate-400">即将上线</span>}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{item.description}</p>
                        </button>
                      </li>
                    )
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
