import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { colors } from '../../config/theme'

export interface SeriesDef {
  key: string
  label: string
  color: string
}

interface TimeSeriesChartProps {
  data: Array<Record<string, number | string | null>>
  xKey: string
  series: SeriesDef[]
  height?: number
  unit?: string
}

/**
 * Reusable themed line chart for time series. Ready for use once real,
 * aggregated data is supplied to a ChartCard with status="ready".
 */
export function TimeSeriesChart({ data, xKey, series, height = 240, unit }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke={colors.line} strokeDasharray="3 5" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: colors.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: colors.line }} minTickGap={24} />
        <YAxis tick={{ fill: colors.muted, fontSize: 11 }} tickLine={false} axisLine={false} unit={unit} width={56} />
        <Tooltip
          contentStyle={{ borderRadius: 10, border: `1px solid ${colors.line}`, boxShadow: '0 8px 24px rgb(41 39 36 / 0.08)', fontSize: 12 }}
          labelStyle={{ color: colors.ink, fontWeight: 600 }}
        />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} connectNulls={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
