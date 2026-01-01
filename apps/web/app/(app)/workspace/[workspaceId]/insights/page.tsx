'use client'

import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  DataVisualizer,
  type ParsedTable,
  type AnalyzeResponse,
  type AnalyzeRequest
} from '@starlink/ui'
import { useTheme, cn } from '@/lib/theme'

type ChartType = 'bar' | 'line' | 'pie' | 'area'

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

const chartColors = ['#06B6D4', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#F97316']

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
  const { theme } = useTheme()
  const data = useMemo(() => {
    // 饼图最多显示前6行，避免标签重叠
    const maxRows = chartType === 'pie' ? 6 : MAX_PREVIEW_ROWS
    return table.rows.slice(0, maxRows).map((row, index) => ({
      name: row[categoryColumn] ?? `行 ${table.rows.indexOf(row) + 1}`,
      value: Number(row[valueColumn]) || 0,
      fill: chartColors[index % chartColors.length]
    }))
  }, [table, categoryColumn, valueColumn, chartType])

  if (data.length === 0) {
    return <p className={cn('text-sm', theme.colors.text.muted)}>选择包含数字的列以生成图表。</p>
  }

  const isDataTruncated = chartType === 'pie' && table.rows.length > 6

  return (
    <div className={cn('mt-4 rounded-2xl border p-4 shadow-inner', theme.colors.border.default, theme.colors.background.card)}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className={cn('text-sm font-semibold', theme.colors.text.primary)}>图表预览</h4>
        <p className={cn('text-xs', theme.colors.text.muted)}>
          展示前 {data.length} 行数据
          {isDataTruncated && <span className="ml-1 text-amber-600">（饼图限6行）</span>}
        </p>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' && (
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E2FF" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: '11px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #D7DBFF',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="value" fill="#06B6D4" radius={[8, 8, 0, 0]} name="数值">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          )}

          {chartType === 'line' && (
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E2FF" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: '11px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #D7DBFF',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06B6D4"
                strokeWidth={3}
                dot={{ fill: '#3B82F6', r: 5 }}
                activeDot={{ r: 7 }}
                name="数值"
              />
            </LineChart>
          )}

          {chartType === 'pie' && (
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                dataKey="value"
                style={{ fontSize: '11px' }}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #D7DBFF',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          )}

          {chartType === 'area' && (
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0E2FF" />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                angle={-45}
                textAnchor="end"
                height={80}
                style={{ fontSize: '11px' }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #D7DBFF',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#06B6D4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
                name="数值"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function InsightsPage({ params }: { params: { workspaceId: string } }) {
  const { theme } = useTheme()
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
    <div className={cn('flex h-full min-h-[calc(100vh-80px)] overflow-hidden', theme.colors.background.primary)}>
      <div className="flex flex-1 flex-col overflow-hidden">
        <DataVisualizer
          title="数据可视化工作台"
          description="支持 Excel (.xlsx, .xls) 和 CSV 上传，或直接粘贴数据。解析后可生成柱状图、折线图、饼图、面积图，并导出为 Markdown。"
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
            <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3', theme.colors.border.default, theme.colors.background.card)}>
              <label className={cn('flex items-center gap-2 text-xs', theme.colors.text.muted)}>
                图表类型：
                <select
                  value={chartType}
                  onChange={(event) => setChartType(event.target.value as ChartType)}
                  className={cn('rounded-lg border px-2 py-1 text-xs focus:outline-none', theme.colors.border.default, theme.colors.text.secondary, `focus:${theme.colors.border.hover}`)}
                >
                  <option value="bar">柱状图</option>
                  <option value="line">折线图</option>
                  <option value="pie">饼图</option>
                  <option value="area">面积图</option>
                </select>
              </label>
              <label className={cn('flex items-center gap-2 text-xs', theme.colors.text.muted)}>
                分类列：
                <select
                  value={categoryColumn}
                  onChange={(event) => setCategoryColumn(Number(event.target.value))}
                  className={cn('rounded-lg border px-2 py-1 text-xs focus:outline-none', theme.colors.border.default, theme.colors.text.secondary, `focus:${theme.colors.border.hover}`)}
                >
                  {parsedTable.headers.map((header, index) => (
                    <option key={`category-${header}-${index}`} value={index}>
                      {header || `列 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className={cn('flex items-center gap-2 text-xs', theme.colors.text.muted)}>
                数值列：
                <select
                  value={valueColumn}
                  onChange={(event) => setValueColumn(Number(event.target.value))}
                  className={cn('rounded-lg border px-2 py-1 text-xs focus:outline-none', theme.colors.border.default, theme.colors.text.secondary, `focus:${theme.colors.border.hover}`)}
                >
                  {parsedTable.headers.map((header, index) => (
                    <option key={`value-${header}-${index}`} value={index}>
                      {header || `列 ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
              {numericColumns.length === 0 && (
                <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] text-red-600">
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

      <aside className={cn('w-80 overflow-y-auto border-l px-5 py-6', theme.colors.border.default, theme.colors.background.secondary)}>
        <div className="space-y-5">
          <div className={cn('rounded-2xl border p-4 shadow-sm', theme.colors.border.default, theme.colors.background.card)}>
            <h3 className={cn('text-sm font-semibold', theme.colors.text.primary)}>AI 洞察</h3>
            <p className={cn('mt-2 text-xs', theme.colors.text.muted)}>根据上传的数据生成总结、要点和建议，可用于社群分享或行动规划。</p>
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
                'mt-3 w-full rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-xs font-semibold text-white transition hover:from-cyan-500 hover:to-blue-600',
                { 'opacity-50': !hasTable }
              )}
              disabled={!hasTable || insightMutation.isPending}
            >
              {insightMutation.isPending ? '生成中…' : '生成洞察'}
            </button>
            {insightMutation.isError && (
              <p className="mt-2 text-[11px] text-red-600">{insightMutation.error?.message}</p>
            )}
            {insightText && (
              <div className={cn('mt-3 space-y-2 rounded-xl border p-3 text-xs', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.secondary)}>
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
                className={cn('mt-3 w-full rounded-lg border px-4 py-2 text-xs transition', theme.colors.border.default, theme.colors.text.secondary, theme.colors.interactive.hover)}
              >
                下载洞察 Markdown
              </button>
            )}
          </div>

          <div className={cn('rounded-2xl border border-dashed p-4 text-xs', theme.colors.border.default, theme.colors.background.secondary, theme.colors.text.muted)}>
            <p className={cn('font-semibold', theme.colors.text.primary)}>📊 使用指南</p>
            <ul className="mt-2 space-y-1">
              <li>• 支持 <span className={cn('font-medium', theme.colors.text.primary)}>Excel (.xlsx, .xls)</span> 和 CSV 文件上传</li>
              <li>• 文件大小限制：<span className={cn('font-medium', theme.colors.text.primary)}>5MB</span></li>
              <li>• 点击"<span className={cn('font-medium', theme.colors.text.primary)}>加载示例数据</span>"快速体验</li>
              <li>• 柱状图/折线图/面积图最多显示 <span className={cn('font-medium', theme.colors.text.primary)}>8 行</span></li>
              <li>• 饼图最多显示 <span className={cn('font-medium', theme.colors.text.primary)}>6 行</span>（避免标签重叠）</li>
              <li>• 可切换图表类型、调整分类/数值列</li>
              <li>• 导出的 Markdown 可直接发布到社群</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
