'use client'

import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  DataVisualizer,
  type ParsedTable,
  type AnalyzeResponse,
  type AnalyzeRequest
} from '@branching-chat/ui'

type ChartType = 'bar' | 'line'

const MAX_PREVIEW_ROWS = 8

const extractNumericColumns = (table: ParsedTable) => {
  const numericColumns: number[] = []
  table.headers.forEach((_, columnIndex) => {
    const values = table.rows
      .slice(0, MAX_PREVIEW_ROWS)
      .map((row) => Number(row[columnIndex]))
      .filter((value) => !Number.isNaN(value))
    if (values.length > 0) {
      numericColumns.push(columnIndex)
    }
  })
  return numericColumns
}

const chartColors = ['#7F5BFA', '#5B8DEF', '#F89E6B', '#60C6A8']

function SimpleChart({
  table,
  chartType,
  categoryColumn,
  valueColumn
}: {
  table: ParsedTable
  chartType: ChartType
  categoryColumn: number
  valueColumn: number
}) {
  const data = useMemo(() => {
    return table.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => ({
      label: row[categoryColumn] ?? `行 ${table.rows.indexOf(row) + 1}`,
      value: Number(row[valueColumn]) || 0
    }))
  }, [table, categoryColumn, valueColumn])

  if (data.length === 0) {
    return <p className="text-sm text-slate-400">选择包含数字的列以生成图表。</p>
  }

  const maxValue = Math.max(...data.map((item) => item.value)) || 1

  return (
    <div className="mt-4 rounded-2xl border border-[#D7DBFF] bg-white/90 p-4 shadow-inner">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">图表预览</h4>
        <p className="text-xs text-slate-400">展示前 {data.length} 行数据</p>
      </div>
      <div className="h-64">
        {chartType === 'bar' ? (
          <div className="flex h-full items-end gap-3">
            {data.map((item, index) => {
              const height = (item.value / maxValue) * 100
              return (
                <div key={item.label} className="flex w-full flex-col items-center gap-2 text-xs text-slate-500">
                  <div className="flex h-full w-full flex-col-reverse rounded-lg bg-[#F3F4FF]">
                    <div
                      className="rounded-lg"
                      style={{
                        height: `${height}%`,
                        background: chartColors[index % chartColors.length]
                      }}
                    />
                  </div>
                  <span className="line-clamp-2 text-center text-[11px] tracking-tight">{item.label}</span>
                  <span className="text-[11px] font-semibold text-slate-600">{item.value}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <svg viewBox="0 0 400 220" className="h-full w-full">
            <polyline
              fill="none"
              stroke="#7F5BFA"
              strokeWidth="3"
              points={data
                .map((item, index) => {
                  const x = (index / Math.max(data.length - 1, 1)) * 380 + 10
                  const y = 200 - (item.value / maxValue) * 180 + 10
                  return `${x},${y}`
                })
                .join(' ')}
            />
            {data.map((item, index) => {
              const x = (index / Math.max(data.length - 1, 1)) * 380 + 10
              const y = 200 - (item.value / maxValue) * 180 + 10
              return (
                <g key={`${item.label}-${index}`}>
                  <circle cx={x} cy={y} r={4} fill="#5B8DEF" />
                  <text x={x} y={y - 10} fontSize={11} textAnchor="middle" fill="#475569">
                    {item.value}
                  </text>
                  <text x={x} y={210} fontSize={10} textAnchor="middle" fill="#94A3B8">
                    {item.label}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

export default function InsightsPage({ params }: { params: { workspaceId: string } }) {
  const [parsedTable, setParsedTable] = useState<ParsedTable>({ headers: [], rows: [] })
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [categoryColumn, setCategoryColumn] = useState<number>(0)
  const [valueColumn, setValueColumn] = useState<number>(0)
  const [insightText, setInsightText] = useState<string>('')

  const numericColumns = useMemo(() => extractNumericColumns(parsedTable), [parsedTable])

  const insightMutation = useMutation<AnalyzeResponse, Error, AnalyzeRequest>({
    mutationFn: async (payload) => {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || '洞察生成失败')
      }
      return response.json() as Promise<AnalyzeResponse>
    },
    onSuccess: (result) => {
      setInsightText(result.summary ?? 'AI 已生成洞察。')
    }
  })

  const hasTable = parsedTable.headers.length > 0 && parsedTable.rows.length > 0

  return (
    <div className="flex h-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#F4F5FF]/60">
      <div className="flex flex-1 flex-col overflow-hidden">
        <DataVisualizer
          title="上传数据生成可视化"
          description="支持 CSV 粘贴或上传，解析后可选择 chart 类型并导出。"
          onDataExtracted={(table) => {
            setParsedTable(table)
            setInsightText('')
            const numericCols = extractNumericColumns(table)
            setCategoryColumn(0)
            setValueColumn(numericCols[0] ?? 0)
          }}
        />

        {hasTable && (
          <div className="flex flex-col gap-4 px-6 pb-6">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#D7DBFF] bg-white/90 px-4 py-3">
              <label className="flex items-center gap-2 text-xs text-slate-500">
                图表类型：
                <select
                  value={chartType}
                  onChange={(event) => setChartType(event.target.value as ChartType)}
                  className="rounded-lg border border-[#E0E2FF] px-2 py-1 text-xs text-slate-600 focus:border-[#A5B4FC] focus:outline-none"
                >
                  <option value="bar">柱状图</option>
                  <option value="line">折线图</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                分类列：
                <select
                  value={categoryColumn}
                  onChange={(event) => setCategoryColumn(Number(event.target.value))}
                  className="rounded-lg border border-[#E0E2FF] px-2 py-1 text-xs text-slate-600 focus:border-[#A5B4FC] focus:outline-none"
                >
                  {parsedTable.headers.map((header, index) => (
                    <option key={`category-${header}-${index}`} value={index}>
                      {header || `列 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                数值列：
                <select
                  value={valueColumn}
                  onChange={(event) => setValueColumn(Number(event.target.value))}
                  className="rounded-lg border border-[#E0E2FF] px-2 py-1 text-xs text-slate-600 focus:border-[#A5B4FC] focus:outline-none"
                >
                  {parsedTable.headers.map((header, index) => (
                    <option key={`value-${header}-${index}`} value={index}>
                      {header || `列 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              {numericColumns.length === 0 && (
                <span className="rounded-full bg-[#FEF2F2] px-3 py-1 text-[11px] text-[#B91C1C]">
                  未检测到数值列，可尝试清洗数据
                </span>
              )}
            </div>

            <SimpleChart
              table={parsedTable}
              chartType={chartType}
              categoryColumn={categoryColumn}
              valueColumn={valueColumn}
            />
          </div>
        )}
      </div>

      <aside className="w-80 overflow-y-auto border-l border-[#E3E6FF] bg-white/80 px-5 py-6">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#E3E6FF] bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">AI 洞察</h3>
            <p className="mt-2 text-xs text-slate-500">根据上传的数据生成总结、要点和建议，可用于社群分享或行动规划。</p>
            <button
              type="button"
              onClick={() => {
                if (!hasTable) return
                const previewRows = parsedTable.rows.slice(0, MAX_PREVIEW_ROWS)
                const serializedRows = previewRows
                  .map((row) => parsedTable.headers.map((header, index) => `${header || `列${index + 1}`}: ${row[index] ?? ''}`).join('，'))
                  .join('\n')
                const prompt = `基于以下表格数据给出3条洞察和3条行动建议：\n${serializedRows}`
                insightMutation.mutate({
                  tenantId: params.workspaceId,
                  userId: 'insight-analyst',
                  taskId: `${params.workspaceId}-insight`,
                  question: prompt,
                  timeline: [],
                  edges: []
                })
              }}
              className={clsx(
                'mt-3 w-full rounded-lg bg-gradient-to-r from-[#7F5BFA] to-[#6350E8] px-4 py-2 text-xs font-semibold text-white transition hover:from-[#6F4EE5] hover:to-[#5645D7]',
                { 'opacity-50': !hasTable }
              )}
              disabled={!hasTable || insightMutation.isPending}
            >
              {insightMutation.isPending ? '生成中…' : '生成洞察'}
            </button>
            {insightMutation.isError && (
              <p className="mt-2 text-[11px] text-[#B91C1C]">{insightMutation.error?.message}</p>
            )}
            {insightText && (
              <div className="mt-3 space-y-2 rounded-xl border border-[#E3E6FF] bg-[#F8F9FF] p-3 text-xs text-slate-600">
                {insightText.split('\n').map((line, index) => (
                  <p key={`insight-line-${index}`}>{line}</p>
                ))}
              </div>
            )}
            {insightText && (
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([insightText], { type: 'text/markdown;charset=utf-8;' })
                  const link = document.createElement('a')
                  link.href = URL.createObjectURL(blob)
                  link.download = `insights-${Date.now()}.md`
                  link.click()
                  URL.revokeObjectURL(link.href)
                }}
                className="mt-3 w-full rounded-lg border border-[#D7DBFF] px-4 py-2 text-xs text-slate-600 transition hover:bg-[#EEF0FF]"
              >
                下载洞察 Markdown
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F8F9FF] p-4 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">操作提示</p>
            <ul className="mt-2 space-y-1">
              <li>• 上传 CSV 后可即时预览表格与图表。</li>
              <li>• 导出的 Markdown 可直接发布到社群或画布。</li>
              <li>• 调整分类/数值列即可切换图表维度。</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
