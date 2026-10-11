import React from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'

export interface TrendChartPoint {
  date: string
  value: number
  label?: string
}

interface TrendChartProps {
  data: TrendChartPoint[]
  height?: number
  color?: 'blue' | 'green' | 'amber' | 'rose'
  valueLabel?: string
  className?: string
}

const colorConfig = {
  blue: { stroke: '#2563eb', fill: '#dbeafe' },
  green: { stroke: '#16a34a', fill: '#dcfce7' },
  amber: { stroke: '#d97706', fill: '#fef3c7' },
  rose: { stroke: '#e11d48', fill: '#ffe4e6' },
}

export const TrendChart = React.memo(function TrendChart({
  data,
  height = 280,
  color = 'blue',
  valueLabel = 'Value',
  className,
}: TrendChartProps) {
  const palette = colorConfig[color]

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={`trend-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.stroke} stopOpacity={0.22} />
              <stop offset="95%" stopColor={palette.fill} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <Tooltip
            formatter={(value) => [value, valueLabel]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              borderColor: '#334155', 
              borderRadius: 8, 
              color: '#f8fafc' 
            }}
            labelStyle={{ color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={palette.stroke}
            strokeWidth={2}
            fill={`url(#trend-${color})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})
