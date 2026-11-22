import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PerformanceSummary } from '../../api/types'
import { colors, performanceColor } from '../../config/theme'

/** Distinct wells per existing performance class (from GET /api/performance summary). */
export function PerformanceChart({ summary, height = 240 }: { summary: PerformanceSummary; height?: number }) {
  const data = summary.byClass.map((c) => ({ name: c.class, wells: c.wells }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={colors.line} strokeDasharray="3 4" />
        <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: colors.line }} tick={{ fill: colors.muted, fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: colors.muted, fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'rgb(0 0 0 / 0.03)' }}
          contentStyle={{ borderRadius: 12, border: `1px solid ${colors.line}`, fontSize: 12 }}
          formatter={(v) => [Number(v).toLocaleString(), 'Wells']}
        />
        <Bar dataKey="wells" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.name} fill={performanceColor(d.name)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
