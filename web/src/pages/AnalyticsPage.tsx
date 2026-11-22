import { useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Activity, Database, Droplets, Factory, Gauge, Layers3, ListOrdered, Map, PieChart as PieIcon, RotateCcw, ScatterChart, Trophy, TrendingDown, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { SearchInput } from '../components/ui/SearchInput'
import { DualTag } from '../components/ui/Badge'
import { LoadingState } from '../components/ui/States'
import { ApiErrorState, Notice, SourceTag } from '../components/data/DataStates'
import { Panel, SectionHeader, Segmented } from '../components/analytics/chartKit'
import { fmt } from '../components/analytics/chartTheme'
import { SortableTable, type Column } from '../components/analytics/SortableTable'
import { AreaOilRateChart, AreaPerformanceChart, PerformanceDonut } from '../components/analytics/PerformanceCharts'
import { InjectionProductionScatter, RolesByAreaChart } from '../components/analytics/InjectionProductionCharts'
import { CandidateDetail, ScenarioChart, TopCandidatesChart } from '../components/analytics/ConversionCharts'
import { useApi } from '../hooks/useApi'
import { floodiqApi } from '../api/floodiq'
import type { AnalyticsCandidate, AnalyticsWell } from '../api/types'
import { colors, performanceColor } from '../config/theme'
import {
  classByArea, classCounts, oilRateByArea, classOf, classSort, DEFAULT_FILTERS, filterCandidates, filterWells, kpis, ROLE_OPTIONS, rolesByArea,
  type AnalyticsFilters, type RoleFilter,
} from '../lib/analyticsData'

export default function AnalyticsPage() {
  const state = useApi((s) => floodiqApi.analytics(s), 'analytics-dataset')
  const [params, setParams] = useSearchParams()

  const filters: AnalyticsFilters = {
    area: params.get('area') ?? DEFAULT_FILTERS.area,
    role: (params.get('role') as RoleFilter) ?? DEFAULT_FILTERS.role,
    perf: params.get('perf') ?? DEFAULT_FILTERS.perf,
    search: params.get('q') ?? DEFAULT_FILTERS.search,
  }
  const selected = params.get('candidate')
  const scatterMode = params.get('view') === 'areas' ? 'areas' : 'wells'
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== 'all') next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const dirty = filters.area !== 'all' || filters.role !== 'all' || filters.perf !== 'all' || filters.search !== ''
  const reset = () => update({ area: null, role: null, perf: null, q: null })

  const data = state.status === 'ready' ? state.data : null
  const wells = useMemo(() => (data ? filterWells(data.wells, filters) : []), [data, filters.area, filters.role, filters.perf, filters.search]) // eslint-disable-line react-hooks/exhaustive-deps
  const candidates = useMemo(() => (data ? filterCandidates(data.candidates, wells) : []), [data, wells])
  const wellByUwi = useMemo(() => new globalThis.Map((data?.wells ?? []).map((w) => [w.uwi, w])), [data])
  const areas = useMemo(() => [...new Set((data?.wells ?? []).map((w) => w.area).filter(Boolean) as string[])].sort(), [data])
  const classes = useMemo(() => [...new Set((data?.wells ?? []).map(classOf).filter(Boolean) as string[])].sort(classSort), [data])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Analyze"
        title="Analytics"
        subtitle="Explore well performance, producing and injecting wells, and saved conversion results from the team's exported Databricks tables. Every chart uses the same filters; nothing is estimated or filled in on this page."
      />

      {/* Filters */}
      <Card className="z-20 p-4 sm:p-5 lg:sticky lg:top-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_minmax(220px,1.4fr)_auto] lg:items-end">
          <Select label="Operating area" value={filters.area} onChange={(e) => update({ area: e.target.value })} options={[{ value: 'all', label: 'All areas' }, ...areas.map((a) => ({ value: a, label: a }))]} />
          <Select label="Well type (history)" value={filters.role} onChange={(e) => update({ role: e.target.value })} options={ROLE_OPTIONS} />
          <Select
            label="Performance"
            value={filters.perf}
            onChange={(e) => update({ perf: e.target.value })}
            options={[{ value: 'all', label: 'All wells' }, ...classes.map((c) => ({ value: c, label: c })), { value: 'none', label: 'Not classified' }]}
          />
          <SearchInput label="Search UWI or name" placeholder="e.g. 141030103628W300" value={filters.search} onChange={(v) => update({ q: v || null })} />
          <Button variant="secondary" icon={<RotateCcw className="size-4" />} disabled={!dirty} onClick={reset}>Reset</Button>
        </div>
        {data && (
          <p className="mt-3 border-t border-line pt-3 text-[12px] text-muted">
            <span className="font-medium tabular-nums text-ink">{wells.length.toLocaleString()}</span> of {data.wells.length.toLocaleString()} unique wells
            · <span className="tabular-nums text-ink">{candidates.length}</span> of {data.candidates.length} conversion candidates match
          </p>
        )}
      </Card>

      {state.status === 'loading' && <Card><LoadingState label="Loading analytics data…" /></Card>}
      {state.status === 'error' && <Card><ApiErrorState error={state.error} onRetry={state.retry} /></Card>}

      {data && (
        <>
          {/* 1. KPIs */}
          <section aria-labelledby="kpi-heading" className="flex flex-col gap-4">
            <h2 id="kpi-heading" className="sr-only">Key figures</h2>
            <KpiRow wells={wells} />
          </section>

          {/* 2. Performance */}
          <section aria-labelledby="perf-heading" className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Well performance"
              title="Good, Moderate and Low wells"
              description={<>Existing classes from <span className="font-mono text-[12px]">performance.csv</span> for the week of {data.snapshotWeek ?? 'the snapshot'}, read as saved (not recomputed). Only wells with a performance record appear here.</>}
            />
            <PerformanceSection wells={wells} metrics={data.metrics} view={(params.get('areaView') as AreaView) ?? 'count'} onView={(v) => update({ areaView: v === 'count' ? null : v })} />
          </section>

          {/* 3. Injection & production */}
          <section aria-labelledby="inj-heading" className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Injection & production"
              title="Producing and injecting wells"
              description="Roles come from each well's history in wells.csv. A well that has both produced and injected counts once, in the dual-role group."
            />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <Panel title="Role mix by operating area" description="Unique wells by recorded history." icon={Factory} footer={<SourceTag>wells.csv · is_producer · is_injector</SourceTag>}>
                <RolesByAreaChart data={rolesByArea(wells)} />
              </Panel>
              <Panel
                title={scatterMode === 'wells' ? 'Nearby injection vs oil rate, by producing well' : 'Cumulative injection vs cumulative oil, by area'}
                description={
                  scatterMode === 'wells'
                    ? 'Each point is a well with a performance record: active injectors counted nearby vs its 13-week average daily oil rate.'
                    : 'Each bubble is an operating area (size = number of wells): total injection vs total oil produced over the export period.'
                }
                icon={ScatterChart}
                action={
                  <Segmented label="Scatter view" value={scatterMode} options={[{ value: 'wells', label: 'By well' }, { value: 'areas', label: 'By area' }]} onChange={(m) => update({ view: m === 'wells' ? null : m })} />
                }
                footer={<SourceTag>{scatterMode === 'wells' ? 'performance.csv · active_injectors_nearby · oil_rate_13w' : 'wells.csv · total_inj_m3 · total_oil_m3'}</SourceTag>}
              >
                <InjectionProductionScatter wells={wells} metrics={data.metrics} mode={scatterMode} />
                <Notice tone="neutral" className="mt-3">
                  This shows association only. Nearby injection is not shown to cause higher or lower oil production, and well proximity does not establish hydraulic connectivity. Other factors such as reservoir quality, well age and uptime are not controlled for.
                </Notice>
              </Panel>
            </div>
          </section>

          {/* 4. Conversion */}
          <section aria-labelledby="conv-heading" className="flex flex-col gap-4">
            <SectionHeader
              eyebrow="Conversion opportunities"
              title="Saved conversion ranking and economics"
              description="Model outputs exported by the team: producing wells ranked as candidates for conversion to injection. Select a candidate to see everything the exports hold for it."
            />
            <Notice>{data.notices.ranking} {data.notices.economics}</Notice>
            <ConversionSection
              candidates={candidates}
              total={data.candidates.length}
              wellByUwi={wellByUwi}
              metrics={data.metrics}
              selected={selected}
              onSelect={(u) => update({ candidate: u === selected ? null : u })}
              notice={data.notices.model}
            />
          </section>

          {/* Data notes */}
          <DataNotes data={data} />
        </>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, note, color, ring }: { icon: LucideIcon; label: string; value: number; note: ReactNode; color?: string; ring?: string }) {
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex items-center justify-between text-[12.5px] font-medium text-muted">
        <span className="flex items-center gap-2">
          {color ? <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: ring ? `0 0 0 1.5px ${ring}` : undefined }} /> : null}
          {label}
        </span>
        <Icon className="size-4 text-[#B5AEA4]" />
      </div>
      <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value.toLocaleString()}</p>
      <p className="text-[12px] leading-relaxed text-muted">{note}</p>
    </Card>
  )
}

function KpiRow({ wells }: { wells: AnalyticsWell[] }) {
  const k = kpis(wells)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={Map} label="Total unique wells" value={k.total} note={<>One per UWI. {k.dual > 0 ? <>{k.dual.toLocaleString()} <DualTag className="mx-0.5" /> wells counted once.</> : 'No dual-role wells in selection.'}</>} />
      <Kpi icon={Droplets} label="Injection wells" value={k.injected} color={colors.injection} note={<>Have injected (total injection &gt; 0){k.dual ? `, incl. ${k.dual} dual-role` : ''}.</>} />
      <Kpi icon={Activity} label="Production wells" value={k.produced} color={colors.production} note={<>Have produced oil (total oil &gt; 0){k.dual ? `, incl. ${k.dual} dual-role` : ''}.</>} />
      <Kpi icon={TrendingDown} label="Low-performing wells" value={k.low} color={performanceColor('Low')} note={k.classified ? `${fmt.pct(k.low / k.classified)} of ${k.classified.toLocaleString()} classified wells.` : 'No classified wells in selection.'} />
    </div>
  )
}

type AreaView = 'count' | 'share' | 'rate'

function PerformanceSection({ wells, metrics, view, onView }: { wells: AnalyticsWell[]; metrics: import('../api/types').AnalyticsResponse['metrics']; view: AreaView; onView: (v: AreaView) => void }) {
  const counts = classCounts(wells)
  const byArea = classByArea(wells)
  const classified = wells.filter((w) => w.performance)
  const columns: Column<AnalyticsWell>[] = [
    { key: 'uwi', label: 'UWI', mono: true, value: (w) => w.uwi },
    { key: 'name', label: 'Well name', value: (w) => w.wellName, render: (w) => <span className="block max-w-[220px] truncate" title={w.wellName ?? ''}>{w.wellName}</span> },
    { key: 'area', label: 'Area', value: (w) => w.area },
    { key: 'class', label: 'Class', value: (w) => classOf(w), render: (w) => classOf(w) && <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: performanceColor(classOf(w)!) }} />{classOf(w)}</span> },
    { key: 'rate', label: 'Oil rate (13-wk avg)', unit: metrics.oilRate13w.unit, title: metrics.oilRate13w.note, numeric: true, value: (w) => w.performance?.oilRate13w, render: (w) => fmt.num(w.performance?.oilRate13w) },
    { key: 'wc', label: 'Water cut (4-wk)', unit: '%', title: metrics.waterCut4w.note, numeric: true, value: (w) => w.performance?.waterCut4w, render: (w) => (w.performance?.waterCut4w == null ? null : fmt.pct(w.performance.waterCut4w, 1)) },
    { key: 'up', label: 'Uptime (4-wk)', unit: '%', title: metrics.uptime4w.note, numeric: true, value: (w) => w.performance?.uptime4w, render: (w) => (w.performance?.uptime4w == null ? null : fmt.pct(w.performance.uptime4w)) },
    { key: 'inj', label: 'Injectors nearby', unit: 'active', title: metrics.activeInjectorsNearby.note, numeric: true, value: (w) => w.performance?.activeInjectorsNearby },
    { key: 'pct', label: 'Area percentile', unit: '%', title: metrics.areaPercentile.note, numeric: true, value: (w) => w.performance?.areaPercentile, render: (w) => (w.performance?.areaPercentile == null ? null : fmt.pct(w.performance.areaPercentile)) },
  ]
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Classification share" description="Wells per existing class." icon={PieIcon} footer={<SourceTag>performance.csv · performance_class</SourceTag>}>
          <PerformanceDonut data={counts} unclassified={wells.length - classified.length} />
        </Panel>
        <Panel
          title="Performance by operating area"
          description={
            view === 'rate'
              ? 'Median 13-week average oil rate per area (wells with a value in brackets). Hover for the middle-half range.'
              : view === 'share'
                ? 'Share of each class within the area (classified wells in brackets).'
                : "Classified wells per area, stacked by class. Hover for each class's share."
          }
          icon={Layers3}
          action={<Segmented label="Area chart view" value={view} options={[{ value: 'count', label: 'Count' }, { value: 'share', label: 'Share' }, { value: 'rate', label: 'Oil rate' }]} onChange={onView} />}
          footer={<SourceTag>{view === 'rate' ? 'performance.csv · area · oil_rate_13w' : 'performance.csv · area · performance_class'}</SourceTag>}
        >
          {view === 'rate' ? <AreaOilRateChart data={oilRateByArea(wells)} unit={metrics.oilRate13w.unit} /> : <AreaPerformanceChart classes={byArea.classes} data={byArea.data} share={view === 'share'} />}
          {view !== 'rate' && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              In this export the classes follow each well's percentile within its own area (Low below the 1/3 percentile, Moderate 1/3–2/3, Good 2/3 and above), so every area splits roughly into thirds. Use the Oil rate view to compare areas in absolute terms.
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Well performance metrics" description="Wells with a performance record in the current selection. Click a column to sort; hover a header for its definition." icon={Gauge} footer={<SourceTag>performance.csv joined to wells.csv by UWI</SourceTag>}>
        <SortableTable caption="Well performance metrics" rows={classified} columns={columns} rowKey={(w) => w.uwi} initialSort={{ key: 'rate', dir: 'desc' }} minWidth={980} />
      </Panel>
    </>
  )
}

function ConversionSection({ candidates, total, wellByUwi, metrics, selected, onSelect, notice }: {
  candidates: AnalyticsCandidate[]
  total: number
  wellByUwi: globalThis.Map<string, AnalyticsWell>
  metrics: import('../api/types').AnalyticsResponse['metrics']
  selected: string | null
  onSelect: (uwi: string) => void
  notice: string
}) {
  const current = selected ? candidates.find((c) => c.uwi === selected) ?? null : null
  const columns: Column<AnalyticsCandidate>[] = [
    { key: 'rank', label: 'Rank', numeric: true, value: (c) => c.rank },
    { key: 'uwi', label: 'Candidate UWI', mono: true, value: (c) => c.uwi },
    { key: 'area', label: 'Area', value: (c) => wellByUwi.get(c.uwi)?.area },
    { key: 'cls', label: 'Class', value: (c) => wellByUwi.get(c.uwi)?.performance?.class },
    { key: 'ratio', label: 'Net oil / water', unit: metrics.oilPerM3Water.unit, title: metrics.oilPerM3Water.note, numeric: true, value: (c) => c.oilPerM3Water, render: (c) => fmt.num(c.oilPerM3Water, 3) },
    { key: 'net', label: 'Net oil, 4 wk', unit: 'm³ (modelled)', title: metrics.netOil4w.note, numeric: true, value: (c) => c.netOil4w, render: (c) => fmt.num(c.netOil4w, 1) },
    { key: 'nb', label: 'Neighbours', numeric: true, value: (c) => c.neighbours },
    { key: 'exp', label: 'Expected profit', unit: 'CAD (projection)', title: metrics.expectedProfitCad.note, numeric: true, value: (c) => c.economics?.expectedProfitCad, render: (c) => (c.economics ? fmt.cad(c.economics.expectedProfitCad) : null) },
    { key: 'chance', label: 'Chance of profit', unit: 'model', title: metrics.chanceOfProfit.note, numeric: true, value: (c) => c.economics?.chanceOfProfit, render: (c) => (c.economics ? fmt.pct(c.economics.chanceOfProfit) : null) },
  ]
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Top 10 conversion candidates" description={`By saved rank. Bar length is the ranking metric: ${metrics.oilPerM3Water.label.toLowerCase()}. Click a bar to select.`} icon={Trophy} footer={<SourceTag>conversion_ranking.csv · rank · oil_per_m3_water</SourceTag>}>
          <TopCandidatesChart candidates={candidates} metric={metrics.oilPerM3Water} selected={selected} onSelect={onSelect} />
        </Panel>
        <Panel title="Projected profit range (P10 / expected / P90)" description="Hypothetical outcomes from the saved economics model for the top candidates with an estimate. Click a group to select. Not guaranteed returns." icon={Wallet} footer={<SourceTag>conversion_economics.csv · p10 / expected / p90_profit_cad</SourceTag>}>
          <ScenarioChart candidates={candidates} selected={selected} onSelect={onSelect} />
          <p className="mt-2 text-[11.5px] text-muted">The export has no named price or cost scenarios; P10 and P90 are the model's low and high outcomes for each candidate.</p>
        </Panel>
      </div>
      {current && (
        <CandidateDetail candidate={current} well={wellByUwi.get(current.uwi) ?? null} metrics={metrics} total={total} onClose={() => onSelect(current.uwi)} notice={notice} />
      )}
      {selected && !current && <Notice tone="neutral">Candidate {selected} is outside the current filters. Reset the filters to see it.</Notice>}
      <Panel title="Candidate ranking" description="All saved candidates in the current selection. Economics columns are blank where the export has no estimate (it covers the top 50). Click a row to see details." icon={ListOrdered} footer={<SourceTag>conversion_ranking.csv ⟕ conversion_economics.csv by candidate</SourceTag>}>
        <SortableTable caption="Conversion candidates" rows={candidates} columns={columns} rowKey={(c) => c.uwi} initialSort={{ key: 'rank', dir: 'asc' }} onRowClick={(c) => onSelect(c.uwi)} selectedKey={selected} minWidth={980} pageSize={10} />
      </Panel>
    </>
  )
}

function DataNotes({ data }: { data: import('../api/types').AnalyticsResponse }) {
  const q = data.quality
  return (
    <Panel title="About this data" icon={Database} footer={<SourceTag>{data.files.join(' · ')}</SourceTag>}>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-2 text-[12.5px] leading-relaxed text-muted md:grid-cols-2">
        <li>{q.uniqueWells.toLocaleString()} unique wells from {q.masterRows.toLocaleString()} rows in wells.csv ({q.duplicateWells} duplicate UWIs merged).</li>
        <li>{q.withoutCoordinates} wells have no coordinates. They are counted here but can't appear on the map.</li>
        <li>{q.withoutPerformance.toLocaleString()} wells have no row in performance.csv, so they have no class or rate.</li>
        <li>{q.candidatesWithEconomics} of {data.candidates.length} candidates have an economics estimate.</li>
        <li>Volumes are cumulative totals for the export period; rates are 13-week averages (m³/d) at the snapshot week. No dated time series is served, so there are no trend charts.</li>
        <li>Not in the export: {data.unavailable.join(', ')}.</li>
        {q.missingColumns.length > 0 && <li className="text-[#8A5A1E]">Missing columns: {q.missingColumns.join(', ')}.</li>}
      </ul>
    </Panel>
  )
}
