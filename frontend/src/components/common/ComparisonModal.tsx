import React from 'react'
import { Modal } from '@/components/ui/modal'
import { formatNumber, formatPercentage } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { BarChart2 } from 'lucide-react'

export interface ComparisonMetric {
  key: string
  label: string
  format?: 'number' | 'percentage' | 'decimal'
}

export interface ComparisonItem {
  id: string
  name: string
  metrics: Record<string, number>
  avatarUrl?: string
}

export interface ComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  items: ComparisonItem[]
  metrics?: ComparisonMetric[]
  title?: string
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7']

const defaultMetrics: ComparisonMetric[] = [
  { key: 'qualityScore', label: 'Overall SQS', format: 'number' },
  { key: 'commitsCount', label: 'Total Commits', format: 'number' },
  { key: 'coverage', label: 'Test Coverage', format: 'percentage' },
  { key: 'reviewScore', label: 'Code Review Score', format: 'decimal' },
  { key: 'debtScore', label: 'Debt Impact', format: 'number' },
]

export function ComparisonModal({
  isOpen,
  onClose,
  items = [],
  metrics = defaultMetrics,
  title = 'Developer & Entity Comparison',
}: ComparisonModalProps) {
  // Format recharts data structure
  const chartData = React.useMemo(() => {
    return metrics.map((m) => {
      const entry: Record<string, unknown> = { metric: m.label }
      items.forEach((item) => {
        entry[item.name] = item.metrics[m.key] ?? 0
      })
      return entry
    })
  }, [items, metrics])

  const formatValue = (val: number, format?: string) => {
    if (format === 'percentage') return formatPercentage(val)
    if (format === 'decimal') return val.toFixed(1)
    return formatNumber(val)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span>{title}</span>
        </div>
      }
      size="xl"
    >
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          No items selected for comparison. Select at least 2 items to compare.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Badges */}
          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/60"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {item.name}
                </span>
              </div>
            ))}
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="metric" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                {items.map((item, idx) => (
                  <Bar
                    key={item.id}
                    dataKey={item.name}
                    fill={COLORS[idx % COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Metric Comparison Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-semibold uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Metric</th>
                  {items.map((item) => (
                    <th key={item.id} className="px-4 py-3">
                      {item.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {metrics.map((m) => (
                  <tr key={m.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {m.label}
                    </td>
                    {items.map((item) => {
                      const rawVal = item.metrics[m.key] ?? 0
                      return (
                        <td key={item.id} className="px-4 py-3 font-medium">
                          {formatValue(rawVal, m.format)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}
