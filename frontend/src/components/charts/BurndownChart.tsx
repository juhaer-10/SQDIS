import React from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { SprintBurndown, SprintBurndownPoint } from '@/types'
import { Activity } from 'lucide-react'

interface BurndownChartProps {
  data?: SprintBurndown | null
  height?: number
  className?: string
}

export const BurndownChart = React.memo(function BurndownChart({
  data,
  height = 260,
  className,
}: BurndownChartProps) {
  const points: SprintBurndownPoint[] = data?.burndownData || data?.data || []

  if (!data || points.length === 0) {
    return (
      <div
        className={cn(
          'w-full flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-900/20 rounded-lg',
          className
        )}
        style={{ height }}
      >
        <Activity className="h-8 w-8 text-slate-400 dark:text-slate-600 mb-2 opacity-60" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No burndown data recorded yet</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Burndown points are computed automatically from commits made during the sprint window.
        </p>
      </div>
    )
  }

  const chartData = points.map((p) => ({
    date: p.date.length > 5 ? p.date.slice(5) : p.date,
    fullDate: p.date,
    'Ideal Remaining': p.idealRemaining ?? p.ideal ?? 0,
    'Actual Remaining': p.actualRemaining ?? p.remaining ?? 0,
    'Completed': p.completed ?? 0,
  }))

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="#94a3b8"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="#94a3b8"
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: '1px solid #334155',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
              fontSize: '12px',
              color: '#f8fafc',
            }}
            labelStyle={{ color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', paddingTop: '-6px' }}
          />
          <Line
            type="monotone"
            dataKey="Ideal Remaining"
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="Actual Remaining"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#6366f1' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})
