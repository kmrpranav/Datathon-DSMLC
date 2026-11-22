import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { colors, performanceColor } from '../../config/theme'
import { axisTick, fmt, gridProps, tooltipStyle } from './chartTheme'
import { ChartEmpty, LegendItem } from './chartKit'

/** Donut of existing performance labels (one well = one label). */
export function PerformanceDonut({ data, unclassified }: { data: Array<{ name: string; value: number }>; unclassified: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <ChartEmpty title="No classified wells in this selection" description={`${unclassified.toLocaleString()} wells here have no performance record.`} />
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative h-[220px] w-full max-w-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.name} fill={performanceColor(d.name)} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v, name) => [`${fmt.int(Number(v))} wells (${fmt.pct(Number(v) / total, 1)})`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[24px] font-semibold tabular-nums tracking-[-0.02em]">{fmt.int(total)}</p>
            <p className="text-[11.5px] text-muted">classified wells</p>
          </div>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2.5">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 text-[13px]">
            <LegendItem color={performanceColor(d.name)} label={d.name} />
            <span className="tabular-nums text-ink">
              {fmt.int(d.value)} <span className="text-muted">· {fmt.pct(d.value / total, 1)}</span>
            </span>
          </li>
        ))}
        <li className="border-t border-line pt-2.5 text-[12px] text-muted">
          {unclassified.toLocaleString()} wells in this selection have no performance record and are not shown.
        </li>
      </ul>
    </div>
  )
}

/** Stacked horizontal bars: class counts per operating area. */
export function AreaPerformanceChart({ classes, data, share = false }: { classes: string[]; data: Array<{ area: string; total: number } & Record<string, number>>; share?: boolean }) {
  if (!data.length) return <ChartEmpty />
  const height = Math.max(180, data.length * 30 + 60)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" stackOffset={share ? 'expand' : undefined} margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap="22%">
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" allowDecimals={share} domain={share ? [0, 1] : undefined} ticks={share ? [0, 0.25, 0.5, 0.75, 1] : undefined} tickFormatter={share ? (v) => fmt.pct(v) : undefined} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: share ? 'Share of classified wells in the area' : 'Classified wells', position: 'insideBottom', offset: -2, fill: colors.muted, fontSize: 11.5 }} height={40} />
        <YAxis type="category" dataKey="area" width={150} tickFormatter={(a) => { const r = data.find((d) => d.area === a); return share && r ? `${a} (${r.total})` : a }} tick={axisTick} tickLine={false} axisLine={false} interval={0} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgb(0 0 0 / 0.03)' }}
          formatter={(v, name, item) => {
            const total = (item?.payload as { total: number } | undefined)?.total ?? 0
            return [`${fmt.int(Number(v))} wells (${fmt.pct(total ? Number(v) / total : 0)})`, name]
          }}
        />
        <Legend itemSorter={null} verticalAlign="top" height={28} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: colors.muted }} />
        {classes.map((c, i) => (
          <Bar key={c} dataKey={c} stackId="cls" fill={performanceColor(c)} radius={i === classes.length - 1 ? [0, 5, 5, 0] : 0} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Median 13-week average oil rate per area — an absolute comparison, since classes are relative within each area. */
export function AreaOilRateChart({ data, unit }: { data: Array<{ area: string; median: number; n: number; q1: number; q3: number }>; unit: string }) {
  if (!data.length) return <ChartEmpty />
  const height = Math.max(180, data.length * 30 + 60)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap="28%">
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: `Median oil rate, 13-week average (${unit})`, position: 'insideBottom', offset: -2, fill: colors.muted, fontSize: 11.5 }} height={40} />
        <YAxis type="category" dataKey="area" width={150} tick={axisTick} tickLine={false} axisLine={false} interval={0} tickFormatter={(a) => `${a} (${data.find((d) => d.area === a)?.n ?? 0})`} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgb(0 0 0 / 0.03)' }}
          formatter={(v, _n, item) => {
            const d = item?.payload as { n: number; q1: number; q3: number }
            return [`${fmt.num(Number(v))} ${unit} (middle half: ${fmt.num(d.q1)}–${fmt.num(d.q3)}, ${d.n} wells)`, 'Median']
          }}
        />
        <Bar dataKey="median" fill={colors.primary} fillOpacity={0.8} radius={[0, 5, 5, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
