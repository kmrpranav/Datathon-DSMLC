import { ArrowRight, GitCompareArrows, Layers3, Map, Trophy, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ApiErrorState, Notice, SourceTag } from '../data/DataStates'
import { useApi } from '../../hooks/useApi'
import { floodiqApi } from '../../api/floodiq'
import type { OverviewResponse } from '../../api/types'
import { colors, performanceColor } from '../../config/theme'
import { formatNumber } from '../../lib/format'

/** Overview KPIs aggregated by the backend (CSV export or Databricks) via GET /api/overview. */
export function LiveSummary() {
  const state = useApi((signal) => floodiqApi.overview(signal), 'overview')
  const navigate = useNavigate()

  if (state.status === 'loading') return <SummarySkeleton />
  if (state.status === 'error') return <Card><ApiErrorState error={state.error} onRetry={state.retry} /></Card>
  const d = state.data

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Map} label="Unique wells" value={d.wells?.totalUnique ?? d.wells?.mapped} note={d.wells ? `${d.wells.mapped.toLocaleString()} mapped` : undefined} />
        <Kpi label="Injection (current)" value={d.wells?.byRole.injection} dot={colors.injection} />
        <Kpi label="Production (current)" value={d.wells?.byRole.production} dot={colors.production} />
        <Kpi label="Dual-role history" value={d.wells?.dualRole} dot={colors.injection} ring={colors.production} note="Both produced and injected" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PerformanceCard data={d} onOpen={() => navigate('/analytics')} />
        <Card className="flex flex-col gap-3 p-5">
          <Heading icon={GitCompareArrows} title="Injector–producer pairs" />
          {d.pairs ? (
            <>
              <BigNumber value={d.pairs.pairs} />
              <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
                <Stat label="Injectors" value={d.pairs.injectors} />
                <Stat label="Producers" value={d.pairs.producers} />
                {d.pairs.distanceColumn && <Stat label="Median distance" value={d.pairs.medianDistance} suffix={d.pairs.distanceColumn.endsWith('km') ? 'km' : d.pairs.distanceColumn.endsWith('_m') ? 'm' : ''} />}
              </dl>
              <p className="text-[11.5px] leading-relaxed text-muted">Spatial pairings only — not confirmed hydraulic connectivity.</p>
              <SourceTag className="mt-auto">{d.pairs.table}</SourceTag>
            </>
          ) : (
            <Unavailable />
          )}
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <Heading icon={Trophy} title="Conversion candidates" />
          {d.conversion ? (
            <>
              <BigNumber value={d.conversion.candidates} />
              <p className="text-[12.5px] text-muted">Wells ranked in the team's saved conversion-ranking table.</p>
              <SourceTag>{d.conversion.table}</SourceTag>
            </>
          ) : (
            <Unavailable />
          )}
          <div className="mt-auto border-t border-line pt-3">
            <div className="flex items-center gap-2 text-[13px] font-medium"><Wallet className="size-4 text-muted" /> Economics scenarios</div>
            {d.economics ? (
              <>
                <p className="mt-1 text-[12.5px] text-muted">
                  {d.economics.rows.toLocaleString()} rows{d.economics.scenarios.length ? ` · ${d.economics.scenarios.join(', ')}` : ''}
                </p>
                <SourceTag className="mt-1">{d.economics.table}</SourceTag>
              </>
            ) : (
              <Unavailable />
            )}
          </div>
        </Card>
      </div>

      <Notice>
        Rankings and economics are model-generated estimates saved by the team — not live predictions and not verified realized savings or profits.
      </Notice>
      {d.warnings.length > 0 && (
        <Notice tone="neutral">Some sections are unavailable: {d.warnings.join(' · ')}</Notice>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SourceTag>workspace.default · updated {new Date(d.generatedAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</SourceTag>
        <Button variant="secondary" size="sm" iconRight={<ArrowRight className="size-3.5" />} onClick={() => navigate('/wells')}>Open Well Explorer</Button>
      </div>
    </div>
  )
}

function PerformanceCard({ data, onOpen }: { data: OverviewResponse; onOpen: () => void }) {
  const p = data.performance
  const total = p?.byClass.reduce((s, c) => s + c.wells, 0) ?? 0
  return (
    <Card className="flex flex-col gap-3 p-5">
      <Heading icon={Layers3} title="Well performance" />
      {p && total > 0 ? (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-[#F3EFE8]" role="img" aria-label={p.byClass.map((c) => `${c.class}: ${c.wells}`).join(', ')}>
            {p.byClass.map((c) => (
              <div key={c.class} style={{ width: `${(c.wells / total) * 100}%`, background: performanceColor(c.class) }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1.5">
            {p.byClass.map((c) => (
              <li key={c.class} className="flex items-center gap-2 text-[13px]">
                <span className="size-2.5 rounded-full" style={{ background: performanceColor(c.class) }} />
                {c.class}
                <span className="ml-auto tabular-nums text-ink">{c.wells.toLocaleString()}</span>
                <span className="w-12 text-right tabular-nums text-muted">{Math.round((c.wells / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] text-muted">Existing classifications from <span className="font-mono">{p.classColumn}</span>; counts are distinct wells.</p>
          <div className="mt-auto flex items-center justify-between">
            <SourceTag>{p.table}</SourceTag>
            <button onClick={onOpen} className="text-[12.5px] font-medium text-primary hover:text-primary-hover cursor-pointer">Analytics →</button>
          </div>
        </>
      ) : (
        <Unavailable />
      )}
    </Card>
  )
}

function Kpi({ icon: Icon, label, value, note, dot, ring }: { icon?: LucideIcon; label: string; value?: number | null; note?: string; dot?: string; ring?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon ? <Icon className="size-[18px] text-[#A39C92]" /> : dot ? <span className="size-3 rounded-full" style={{ background: dot, boxShadow: ring ? `0 0 0 2px ${ring}` : '0 0 0 2px #fff, 0 0 0 3px rgb(0 0 0 / 0.08)' }} /> : null}
      </div>
      <p className="mt-2 text-[30px] font-semibold tabular-nums tracking-[-0.03em]">{value == null ? <span className="text-[20px] text-muted">—</span> : value.toLocaleString()}</p>
      {note && <p className="mt-1 text-[12px] text-muted">{note}</p>}
    </Card>
  )
}

function Heading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-[10px] bg-[#F3EFE8] text-muted"><Icon className="size-4" /></div>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
    </div>
  )
}

const BigNumber = ({ value }: { value: number }) => <p className="text-[30px] font-semibold tabular-nums tracking-[-0.03em]">{value.toLocaleString()}</p>
const Stat = ({ label, value, suffix }: { label: string; value: number | null | undefined; suffix?: string }) => (
  <div className="rounded-lg border border-line bg-[#FBFAF7] px-2.5 py-1.5">
    <dt className="text-[11px] text-muted">{label}</dt>
    <dd className="font-medium tabular-nums">{formatNumber(value ?? null, suffix || undefined) ?? '—'}</dd>
  </div>
)
const Unavailable = () => <p className="text-[12.5px] text-muted">Not included in the current data source.</p>

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading field summary">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-[112px] animate-pulse bg-[#FBFAF7]" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-[220px] animate-pulse bg-[#FBFAF7]" />)}
      </div>
    </div>
  )
}
