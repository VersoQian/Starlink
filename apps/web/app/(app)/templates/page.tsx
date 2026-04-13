'use client'

import { useState, useEffect } from 'react'

interface FlowTemplate {
  id: string
  name: string
  description: string | null
  definition: unknown
  version: number
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<FlowTemplate[]>([])

  // In production, fetch from GraphQL flowTemplates query
  useEffect(() => {
    setTemplates([
      {
        id: 'tpl-bmc',
        name: 'CC-BMC 商业分析',
        description: '使用市场/产品/财务 Agent 进行 9 维度商业模型画布分析，包含冲突检测和 PDF 导出。',
        definition: {},
        version: 1,
      },
      {
        id: 'tpl-competitive',
        name: '竞品分析',
        description: '对多家公司进行网页搜索、摘要、对比分析，生成图表和 PPT 报告。',
        definition: {},
        version: 1,
      },
      {
        id: 'tpl-research',
        name: '知识库深度研究',
        description: '结合知识库检索和网页搜索，通过 AI 综合分析生成 PDF 研究报告。',
        definition: {},
        version: 1,
      },
    ])
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
      <h1 className="text-2xl font-bold mb-6">工作流模板</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-blue-500 transition-colors cursor-pointer"
          >
            <h2 className="text-lg font-semibold mb-2">{tpl.name}</h2>
            <p className="text-slate-400 text-sm mb-4">{tpl.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">v{tpl.version}</span>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors">
                使用模板
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
