import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { X } from 'lucide-react'
import type { AnalyticsCandidate, AnalyticsWell, MetricInfo, MetricKey } from '../../api/types'
import { colors, performanceColor } from '../../config/theme'
import { axisTick, fmt, gridProps, tooltipStyle } from './chartTheme'
import { ChartEmpty } from './chartKit'
import { Badge, DualTag } from '../ui/Badge'

const P10 = '#C9B8A6'
const P90 = '#A9C9E6'

/** Top 10 by the saved rank, bar length = the ranking metric (net oil per m³ water). */
export function TopCandidatesChart({ candidates, metric, selected, onSelect }: { candidates: AnalyticsCandidate[]; metric: MetricInfo; selected: string | null; onSelect: (uwi: string) => void }) {
  const data = candidates.filter((c) => c.oilPerM3Water !== null).slice(0, 10).map((c) => ({ ...c, label: `#${c.rank ?? '—'} · ${c.uwi}` }))
  if (!data.length) return <ChartEmpty title="No conversion candidates in this selection" description="Candidates are producing wells from the saved ranking; filters for areas, roles or classes without candidates leave this empty." />
  return (
    <ResponsiveContainer width="100%" height={data.length * 32 + 60}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap="24%">
        <CartesianGrid {...gridProps} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} tickFormatter={(v) => fmt.num(v, 2)} label={{ value: `${metric.label} (${metric.unit})`, position: 'insideBottom', offset: -2, fill: colors.muted, fontSize: 11.5 }} height={40} />
        <YAxis type="category" dataKey="label" width={196} tick={{ ...axisTick, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgb(0 0 0 / 0.03)' }}
          formatter={(v, _n, item) => {
            const c = item?.payload as AnalyticsCandidate
            return [`${fmt.num(Number(v), 3)} ${metric.unit} · net oil ${fmt.num(c.netOil4w, 1)} m³ over 4 weeks (modelled)`, 'Ranking metric']
          }}
        />
        <Bar dataKey="oilPerM3Water" radius={[0, 5, 5, 0]} isAnimationActive={false} onClick={(d) => onSelect((d as unknown as { uwi: string }).uwi)} className="cursor-pointer">
          {data.map((d) => <Cell key={d.uwi} fill={d.uwi === selected ? colors.primary : colors.production} fillOpacity={d.uwi === selected || !selected ? 0.9 : 0.45} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** P10 / expected / P90 projected profit per candidate (the saved model's outcome range). */
export function ScenarioChart({ candidates, selected, onSelect }: { candidates: AnalyticsCandidate[]; selected: string | null; onSelect: (uwi: string) => void }) {
  const data = candidates.filter((c) => c.economics).slice(0, 10).map((c) => ({
    uwi: c.uwi,
    label: `#${c.economics!.rank ?? c.rank ?? '—'}`,
    p10: c.economics!.p10ProfitCad,
    expected: c.economics!.expectedProfitCad,
    p90: c.economics!.p90ProfitCad,
    chance: c.economics!.chanceOfProfit,
  }))
  if (!data.length) return <ChartEmpty title="No economics estimates in this selection" description="Only the top 50 ranked candidates have an economics row in conversion_economics.csv." height={300} />
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} barCategoryGap="18%" barGap={2} onClick={(s) => { const u = (s as { activePayload?: Array<{ payload: { uwi: string } }> })?.activePayload?.[0]?.payload.uwi; if (u) onSelect(u) }}>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: colors.line }} label={{ value: 'Economics rank', position: 'insideBottom', offset: -2, fill: colors.muted, fontSize: 11.5 }} height={40} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={(v) => `$${fmt.compact(v)}`} label={{ value: 'Projected profit (CAD)', angle: -90, position: 'insideLeft', offset: 4, dy: 70, fill: colors.muted, fontSize: 11.5 }} />
        <ReferenceLine y={0} stroke={colors.muted} strokeOpacity={0.5} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: 'rgb(0 0 0 / 0.03)' }}
          labelFormatter={(_l, p) => {
            const d = p?.[0]?.payload as { uwi: string; chance: number | null } | undefined
            return d ? `${d.uwi} · chance of profit ${fmt.pct(d.chance)}` : ''
          }}
          formatter={(v, name) => [fmt.cad(Number(v)), name]}
        />
        <Legend itemSorter={null} verticalAlign="top" height={28} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: colors.muted }} />
        <Bar dataKey="p10" name="P10 (low case)" fill={P10} radius={[3, 3, 0, 0]} isAnimationActive={false} className="cursor-pointer">
          {data.map((d) => <Cell key={d.uwi} fillOpacity={!selected || d.uwi === selected ? 1 : 0.4} />)}
        </Bar>
        <Bar dataKey="expected" name="Expected" fill={colors.primary} radius={[3, 3, 0, 0]} isAnimationActive={false} className="cursor-pointer">
          {data.map((d) => <Cell key={d.uwi} fillOpacity={!selected || d.uwi === selected ? 1 : 0.4} />)}
        </Bar>
        <Bar dataKey="p90" name="P90 (high case)" fill={P90} radius={[3, 3, 0, 0]} isAnimationActive={false} className="cursor-pointer">
          {data.map((d) => <Cell key={d.uwi} fillOpacity={!selected || d.uwi === selected ? 1 : 0.4} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Everything the exports hold for one candidate. Missing pieces are said to be missing. */
export function CandidateDetail({ candidate, well, metrics, total, onClose, notice }: {
  candidate: AnalyticsCandidate
  well: AnalyticsWell | null
  metrics: Record<MetricKey, MetricInfo>
  total: number
  onClose: () => void
  notice: string
}) {
  const e = candidate.economics
  const cls = well?.performance?.class ?? null
  const rows: Array<[MetricKey, ReactNode]> = [
    ['oilPerM3Water', fmt.num(candidate.oilPerM3Water, 3)],
    ['netOil4w', fmt.num(candidate.netOil4w, 1)],
    ['extraOil4w', fmt.num(candidate.extraOil4w, 1)],
    ['ownOilLost4w', fmt.num(candidate.ownOilLost4w, 1)],
    ['water4w', fmt.int(candidate.water4w)],
  ]
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-[#FBFAF7] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Selected candidate · rank {candidate.rank ?? '—'} of {total}</p>
          <p className="mt-1 font-mono text-[14px] font-semibold text-ink">{candidate.uwi}</p>
          <p className="text-[12.5px] text-muted">{well?.wellName ?? 'Name not recorded'} · {well?.area ?? 'Area not recorded'}</p>
        </div>
        <button onClick={onClose} aria-label="Clear selected candidate" className="rounded-lg p-1.5 text-muted hover:bg-black/5 hover:text-ink cursor-pointer"><X className="size-4" /></button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {cls && <Badge><span className="size-2 rounded-full" style={{ background: performanceColor(cls) }} /> {cls} performance</Badge>}
        {well?.dualRole && <DualTag />}
        {candidate.neighbours !== null && <Badge>{fmt.int(candidate.neighbours)} neighbouring wells in model</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DetailList title="Ranking model (4-week estimate)">
          {rows.map(([k, v]) => <Item key={k} label={metrics[k].label} value={v} unit={metrics[k].unit} title={metrics[k].note} />)}
        </DetailList>
        <DetailList title="Economics (hypothetical projection)">
          {e ? (
            <>
              <Item label={metrics.expectedProfitCad.label} value={fmt.cad(e.expectedProfitCad)} title={metrics.expectedProfitCad.note} />
              <Item label={metrics.p10ProfitCad.label} value={fmt.cad(e.p10ProfitCad)} title={metrics.p10ProfitCad.note} />
              <Item label={metrics.p90ProfitCad.label} value={fmt.cad(e.p90ProfitCad)} title={metrics.p90ProfitCad.note} />
              <Item label={metrics.chanceOfProfit.label} value={fmt.pct(e.chanceOfProfit)} title={metrics.chanceOfProfit.note} />
              <Item label={metrics.breakevenPriceBbl.label} value={fmt.num(e.breakevenPriceBbl)} unit={metrics.breakevenPriceBbl.unit} title={metrics.breakevenPriceBbl.note} />
            </>
          ) : (
            <p className="text-[12.5px] text-muted">No economics row for this candidate. The export only has estimates for the top 50.</p>
          )}
        </DetailList>
        <DetailList title="Well record (observed)">
          {well ? (
            <>
              <Item label="Production start" value={well.onProductionDate ?? '—'} />
              <Item label={metrics.totalOilM3.label} value={fmt.int(well.totalOilM3)} unit="m³" title={metrics.totalOilM3.note} />
              <Item label={metrics.oilRate13w.label} value={fmt.num(well.performance?.oilRate13w)} unit={metrics.oilRate13w.unit} title={metrics.oilRate13w.note} />
              <Item label={metrics.waterCut4w.label} value={fmt.pct(well.performance?.waterCut4w)} />
              <Item label={metrics.activeInjectorsNearby.label} value={fmt.int(well.performance?.activeInjectorsNearby)} title={metrics.activeInjectorsNearby.note} />
            </>
          ) : (
            <p className="text-[12.5px] text-muted">This UWI is not in wells.csv.</p>
          )}
        </DetailList>
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted">{notice}</p>
    </div>
  )
}

function DetailList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12px] font-semibold text-ink">{title}</p>
      <dl className="flex flex-col divide-y divide-line">{children}</dl>
    </div>
  )
}

function Item({ label, value, unit, title }: { label: string; value: ReactNode; unit?: string; title?: string }) {
  const empty = value === '—'
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[12.5px]" title={title}>
      <dt className="min-w-0 text-muted">{label}</dt>
      <dd className="shrink-0 text-right font-medium tabular-nums text-ink">
        {value}
        {unit && !empty && unit !== 'CAD' && unit !== 'fraction' && unit !== 'probability' && <span className="ml-1 font-normal text-muted">{unit}</span>}
      </dd>
    </div>
  )
}
