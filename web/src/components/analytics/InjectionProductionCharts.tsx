import { useMemo, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { AnalyticsWell, MetricInfo } from '../../api/types'
import { colors, performanceColor } from '../../config/theme'
import { areaTotals, classSort } from '../../lib/analyticsData'
import { axisTick, fmt, gridProps, tooltipStyle } from './chartTheme'
import { ChartEmpty, LegendItem } from './chartKit'

const DUAL = '#8FA7B8'

/** Historical role mix per area; each well sits in exactly one bucket. */
export function RolesByAreaChart({ data, limit = 12 }: { data: Array<{ area: string; producedOnly: number; injectedOnly: number; dual: number; neither: number; total: number }>; limit?: number }) {
  if (!data.length) return <ChartEmpty />
  const shown = data.slice(0, limit)
  const height = Math.max(180, shown.length * 30 + 60)
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barCategoryGap="22%">
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: 'Unique wells', position: 'insideBottom', offset: -2, fill: colors.muted, fontSize: 11.5 }} height={40} />
          <YAxis type="category" dataKey="area" width={150} tick={axisTick} tickLine={false} axisLine={false} interval={0} />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgb(0 0 0 / 0.03)' }} formatter={(v, name) => [`${fmt.int(Number(v))} wells`, name]} />
          <Legend itemSorter={null} verticalAlign="top" height={28} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: colors.muted }} />
          <Bar dataKey="producedOnly" name="Produced only" stackId="r" fill={colors.production} isAnimationActive={false} />
          <Bar dataKey="injectedOnly" name="Injected only" stackId="r" fill={colors.injection} isAnimationActive={false} />
          <Bar dataKey="dual" name="Both (dual-role)" stackId="r" fill={DUAL} isAnimationActive={false} />
          <Bar dataKey="neither" name="Neither recorded" stackId="r" fill={colors.unknown} radius={[0, 5, 5, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {data.length > limit && <p className="text-[12px] text-muted">Showing the {limit} areas with the most wells; {data.length - limit} smaller areas are hidden. Filter by area to see one.</p>}
    </div>
  )
}

interface ScatterProps {
  wells: AnalyticsWell[]
  metrics: Record<string, MetricInfo>
  mode: 'wells' | 'areas'
}

/** Injection context vs oil production. Association only — never presented as cause and effect. */
export function InjectionProductionScatter({ wells, metrics, mode }: ScatterProps) {
  const wellPoints = useMemo(
    () =>
      wells
        .filter((w) => w.performance && w.performance.activeInjectorsNearby !== null && w.performance.oilRate13w !== null)
        .map((w) => ({ x: w.performance!.activeInjectorsNearby!, y: w.performance!.oilRate13w!, uwi: w.uwi, area: w.area, cls: w.performance!.class ?? 'Not classified' })),
    [wells],
  )
  const byClass = useMemo(() => {
    const m = new Map<string, typeof wellPoints>()
    for (const p of wellPoints) m.set(p.cls, [...(m.get(p.cls) ?? []), p])
    return [...m].sort(([a], [b]) => classSort(a, b))
  }, [wellPoints])
  const areaPoints = useMemo(() => areaTotals(wells).filter((a) => a.wells > 0).map((a) => ({ x: a.inj, y: a.oil, z: a.wells, ...a })), [wells])

  if (mode === 'wells') {
    if (!wellPoints.length) return <ChartEmpty title="No wells with both values" description="This view needs wells with a performance record (13-week oil rate and nearby-injector count)." height={320} />
    const median = (xs: number[]) => {
      if (!xs.length) return null
      const s = [...xs].sort((a, b) => a - b)
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    }
    const none = wellPoints.filter((p) => p.x === 0).map((p) => p.y)
    const some = wellPoints.filter((p) => p.x > 0).map((p) => p.y)
    const xm = metrics.activeInjectorsNearby
    const ym = metrics.oilRate13w
    return (
      <div className="flex flex-col gap-3">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
            <CartesianGrid {...gridProps} />
            <XAxis type="number" dataKey="x" name={xm.label} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: `${xm.label} (${xm.unit})`, position: 'insideBottom', offset: -4, fill: colors.muted, fontSize: 11.5 }} height={44} />
            <YAxis type="number" dataKey="y" name={ym.label} tick={axisTick} tickLine={false} axisLine={false} width={56} label={{ value: `${ym.label} (${ym.unit})`, angle: -90, position: 'insideLeft', offset: 8, dy: 90, fill: colors.muted, fontSize: 11.5 }} />
            <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} content={<WellTip xUnit={xm.unit} yUnit={ym.unit} />} />
            {byClass.map(([cls, pts]) => (
              <Scatter key={cls} name={cls} data={pts} fill={performanceColor(cls)} fillOpacity={0.6} isAnimationActive={false} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {byClass.map(([cls, pts]) => <LegendItem key={cls} color={performanceColor(cls)} label={cls} value={fmt.int(pts.length)} />)}
        </div>
        <dl className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-[#FBFAF7] p-3 text-[12.5px] sm:grid-cols-2">
          <div>
            <dt className="text-muted">Median oil rate, no active injector nearby</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{fmt.num(median(none))} {ym.unit} <span className="font-normal text-muted">· {fmt.int(none.length)} wells</span></dd>
          </div>
          <div>
            <dt className="text-muted">Median oil rate, ≥1 active injector nearby</dt>
            <dd className="mt-0.5 font-medium tabular-nums">{fmt.num(median(some))} {ym.unit} <span className="font-normal text-muted">· {fmt.int(some.length)} wells</span></dd>
          </div>
        </dl>
      </div>
    )
  }

  if (!areaPoints.length) return <ChartEmpty height={320} />
  const xm = metrics.totalInjM3
  const ym = metrics.totalOilM3
  return (
    <ResponsiveContainer width="100%" height={380}>
      <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 4 }}>
        <CartesianGrid {...gridProps} />
        <XAxis type="number" dataKey="x" scale="sqrt" domain={[0, 'auto']} tickFormatter={(v) => fmt.compact(v)} tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: `${xm.label}, area total (${xm.unit}) · square-root scale`, position: 'insideBottom', offset: -4, fill: colors.muted, fontSize: 11.5 }} height={44} />
        <YAxis type="number" dataKey="y" scale="sqrt" domain={[0, 'auto']} tickFormatter={(v) => fmt.compact(v)} tick={axisTick} tickLine={false} axisLine={false} width={56} label={{ value: `${ym.label} (${ym.unit})`, angle: -90, position: 'insideLeft', offset: 8, dy: 80, fill: colors.muted, fontSize: 11.5 }} />
        <ZAxis type="number" dataKey="z" range={[40, 600]} name="Wells" />
        <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} content={<AreaTip />} />
        <Scatter data={areaPoints} fill={colors.primary} fillOpacity={0.45} stroke={colors.primary} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

interface TipProps { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }> }

function TipBox({ children }: { children: ReactNode }) {
  return <div style={tooltipStyle.contentStyle} className="bg-surface">{children}</div>
}

function WellTip({ active, payload, xUnit, yUnit }: TipProps & { xUnit: string; yUnit: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { uwi: string; area: string | null; x: number; y: number; cls: string }
  return (
    <TipBox>
      <p className="font-mono text-[11.5px] font-semibold text-ink">{p.uwi}</p>
      <p className="text-muted">{p.area ?? 'Area not recorded'} · {p.cls}</p>
      <p className="mt-1 tabular-nums">Oil rate (13-wk avg): <b>{fmt.num(p.y)} {yUnit}</b></p>
      <p className="tabular-nums">Active injectors nearby: <b>{fmt.int(p.x)}</b> {xUnit}</p>
    </TipBox>
  )
}

function AreaTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { area: string; oil: number; inj: number; wells: number; injectors: number; producers: number; missing: number }
  return (
    <TipBox>
      <p className="font-semibold text-ink">{p.area}</p>
      <p className="text-muted">{fmt.int(p.wells)} wells · {fmt.int(p.producers)} have produced · {fmt.int(p.injectors)} have injected</p>
      <p className="mt-1 tabular-nums">Cumulative oil: <b>{fmt.int(p.oil)} m³</b></p>
      <p className="tabular-nums">Cumulative injection: <b>{fmt.int(p.inj)} m³</b></p>
      {p.missing > 0 && <p className="text-muted">{p.missing} wells with a missing total are not summed.</p>}
    </TipBox>
  )
}
