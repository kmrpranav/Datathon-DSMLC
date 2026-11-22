import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, BrainCircuit, CalendarRange, Droplets, GitCompareArrows, Layers3, RotateCcw, Trophy, Wallet, Wrench, X } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ChartCard } from '../components/charts/ChartCard'
import { StatusBadge, WellTypeBadge } from '../components/ui/Badge'
import { useWells } from '../hooks/useWells'
import { datasetMeta } from '../data/datasetMeta'
import { provinceName } from '../lib/format'
import { useApi } from '../hooks/useApi'
import { floodiqApi } from '../api/floodiq'
import { ApiErrorState, SourceTag } from '../components/data/DataStates'
import { PerformanceChart } from '../components/analytics/PerformanceChart'
import { ResultsTableCard } from '../components/analytics/ResultsTableCard'
import { WellDetailCard } from '../components/analytics/WellDetailCard'

const { start: MIN_DATE, end: MAX_DATE } = datasetMeta.productionDateRange

export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams()
  const { wells, status } = useWells()
  const uwi = params.get('uwi') ?? ''
  const from = params.get('from') ?? MIN_DATE
  const to = params.get('to') ?? MAX_DATE
  const well = useMemo(() => wells.find((w) => w.uwi === uwi) ?? null, [wells, uwi])
  const performance = useApi((sig) => floodiqApi.performance({ limit: 1 }, sig), 'analytics-performance')
  const [scenario, setScenario] = useState('')
  const [scenarios, setScenarios] = useState<string[]>([])
  const selectWell = (u: string) => {
    const next = new URLSearchParams(params)
    next.set('uwi', u)
    setParams(next, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const dirty = Boolean(uwi) || from !== MIN_DATE || to !== MAX_DATE

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Analyze"
        title="Analytics"
        subtitle="Performance classes and saved model results from Databricks. Time-series charts stay empty until a daily-history table is connected — no values are invented."
      />

      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(260px,2fr)_auto] lg:items-end">
          <DateField label="From" value={from} min={MIN_DATE} max={to} onChange={(v) => update({ from: v === MIN_DATE ? null : v })} />
          <DateField label="To" value={to} min={from} max={MAX_DATE} onChange={(v) => update({ to: v === MAX_DATE ? null : v })} />
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <label htmlFor="well-pick" className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Well</label>
            <div className="relative">
              <input
                id="well-pick"
                list="well-options"
                placeholder={status === 'loading' ? 'Loading wells…' : 'All wells — type a UWI to focus'}
                value={uwi}
                onChange={(e) => update({ uwi: e.target.value.trim() || null })}
                className={`h-10 w-full rounded-[10px] border bg-surface pl-3 pr-9 text-sm text-ink placeholder:text-[#ABA49A] hover:border-[#D5CDC1] focus:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 ${uwi ? 'border-primary/50' : 'border-line'}`}
              />
              {uwi && (
                <button onClick={() => update({ uwi: null })} aria-label="Clear well" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-black/5 hover:text-ink cursor-pointer">
                  <X className="size-3.5" />
                </button>
              )}
              <datalist id="well-options">
                {wells.map((w) => (
                  <option key={w.id} value={w.uwi}>{w.wellName ?? ''}</option>
                ))}
              </datalist>
            </div>
          </div>
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} disabled={!dirty} onClick={() => setParams(new URLSearchParams(), { replace: true })} className="sm:col-span-2 lg:col-span-1">
            Reset
          </Button>
        </div>

        {uwi && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-[#FBFAF7] px-4 py-3 text-[13px]">
            {well ? (
              <>
                <span className="font-semibold text-ink">{well.wellName ?? well.uwi}</span>
                <WellTypeBadge type={well.wellType} />
                <StatusBadge status={well.status} />
                <span className="text-muted">{provinceName(well.province)} · {well.operatingArea ?? 'Area not recorded'}</span>
              </>
            ) : (
              <span className="text-muted">{status === 'loading' ? 'Looking up well…' : `No well found with UWI “${uwi}”.`}</span>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-2 text-[12.5px] text-muted">
        <CalendarRange className="size-4" />
        Scope: {well ? 'selected well' : 'all wells'} · dates apply to time-series charts ({from} → {to})
      </div>

      {uwi && well && <WellDetailCard key={uwi} uwi={uwi} />}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Well Performance Classification"
          description="Distinct wells per existing Good / Moderate / Low class. Classes are read as saved, not recomputed."
          icon={Layers3}
          status={performance.status === 'loading' ? 'loading' : 'ready'}
          action={performance.status === 'ready' ? <SourceTag>{performance.data.summary.table}</SourceTag> : undefined}
        >
          {performance.status === 'ready' ? (
            performance.data.summary.byClass.length ? <PerformanceChart summary={performance.data.summary} /> : <p className="text-[13px] text-muted">No classified wells.</p>
          ) : performance.status === 'error' ? (
            <ApiErrorState compact error={performance.error} onRetry={performance.retry} />
          ) : null}
        </ChartCard>

        <ResultsTableCard
          title="Conversion Candidates"
          description="Saved ranking of wells for potential conversion. Click a row to open that well."
          icon={Trophy}
          filterKey="ranking"
          load={(p, sig) => floodiqApi.conversionRanking(p, sig)}
          onRowClick={(r, d) => d.fields.uwi && selectWell(String(r[d.fields.uwi]))}
          highlight={(r, d) => Boolean(d.fields.uwi) && String(r[d.fields.uwi!]) === uwi}
        />
      </div>

      <ResultsTableCard
        title="Conversion Economics"
        description="Scenario-based financial estimates exactly as saved, including their assumption columns."
        icon={Wallet}
        filterKey={`economics|${scenario}|${uwi}`}
        load={async (p, sig) => {
          const d = await floodiqApi.conversionEconomics({ ...p, scenario: scenario || undefined, uwi: well ? uwi : undefined }, sig)
          setScenarios(d.scenarios)
          return d
        }}
        toolbar={
          scenarios.length > 0 && (
            <select
              aria-label="Scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="h-9 rounded-[10px] border border-line bg-surface px-2.5 text-[13px] text-ink hover:border-[#D5CDC1] cursor-pointer"
            >
              <option value="">All scenarios</option>
              {scenarios.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )
        }
      />

      <ResultsTableCard
        title="Injector–Producer Pairs"
        description={well ? `Saved pairs that include ${well.wellName ?? uwi}.` : 'Saved spatial pairings between injectors and nearby producers.'}
        icon={GitCompareArrows}
        filterKey={`pairs|${well ? uwi : ''}`}
        load={(p, sig) => floodiqApi.pairs({ ...p, uwi: well ? uwi : undefined }, sig)}
      />

      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Requires additional data pipelines</h2>
        <p className="mt-0.5 text-[13px] text-muted">These need daily history or model-evaluation tables that aren't in the connected Catalog tables yet.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Oil Production Trends" description="Daily and monthly oil volumes over time." icon={Activity} status="awaiting" plannedSources={['production_date', 'oil_produced_m3']} />
        <ChartCard title="Water Injection Trends" description="Injected water volumes and injection pressure." icon={Droplets} status="awaiting" plannedSources={['injected_water_m3', 'injection_pressure_kpa']} />
        <ChartCard title="Production vs. Injection Comparison" description="Producer response relative to nearby injection over time." icon={GitCompareArrows} status="awaiting" plannedSources={['daily oil by producer', 'daily injection by injector']} />
        <ChartCard title="Maintenance and Operational Events" description="Well jobs and equipment failures over time." icon={Wrench} status="awaiting" plannedSources={['well_jobs.parquet', 'production_failures.parquet']} />
        <ChartCard title="Forecasting and Model Results" description="LightGBM forecasts and evaluation metrics." icon={BrainCircuit} status="awaiting" plannedSources={['forecast output table (TBD)', 'Model Serving endpoint']} className="xl:col-span-2" />
      </div>
    </div>
  )
}

function DateField({ label, value, min, max, onChange }: { label: string; value: string; min: string; max: string; onChange: (v: string) => void }) {
  const id = `date-${label.toLowerCase()}`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-sm text-ink hover:border-[#D5CDC1] focus:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
      />
    </div>
  )
}
