import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Database, HardDrive, Maximize2, MousePointerClick, RefreshCw } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState, LoadingState } from '../components/ui/States'
import { WellsMap } from '../components/map/WellsMap'
import { MapLegend } from '../components/map/MapLegend'
import { WellFilterBar } from '../components/wells/WellFilterBar'
import { WellInfoPanel } from '../components/wells/WellInfoPanel'
import { WellsTable } from '../components/wells/WellsTable'
import { useWells } from '../hooks/useWells'
import { filterWells, operatingAreasFor, performanceClassesFor } from '../lib/wellFilters'
import { Notice } from '../components/data/DataStates'
import { colors } from '../config/theme'
import { DEFAULT_WELL_FILTERS, type WellFilters } from '../types/well'

export default function WellExplorerPage() {
  const { status, wells, error, reload, source, metadata, fallbackReason } = useWells()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<WellFilters>(DEFAULT_WELL_FILTERS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [fitNonce, setFitNonce] = useState(0)

  const filtered = useMemo(() => filterWells(wells, filters), [wells, filters])
  const areas = useMemo(() => operatingAreasFor(wells, filters.province), [wells, filters.province])
  const selected = useMemo(() => wells.find((w) => w.id === selectedId) ?? null, [wells, selectedId])
  const performanceClasses = useMemo(() => performanceClassesFor(wells), [wells])
  const counts = useMemo(() => {
    const c = { injection: 0, production: 0, unknown: 0, dual: 0 }
    for (const w of filtered) {
      c[w.wellType]++
      if (w.roles.dualRole) c.dual++
    }
    return c
  }, [filtered])

  // Re-fit only on structural filter changes (not every keystroke of search is fine too — cheap).
  const fitKey = `${filters.province}|${filters.operatingArea}|${filters.wellType}|${filters.performance}|${filters.search.trim()}|${fitNonce}|${status}`

  const legend = [
    { label: 'Injection', color: colors.injection, count: counts.injection },
    { label: 'Production', color: colors.production, count: counts.production },
    ...(counts.unknown ? [{ label: 'Unclassified', color: colors.unknown, count: counts.unknown }] : []),
    ...(counts.dual ? [{ label: 'Dual-role history', color: colors.injection, ring: colors.production, count: counts.dual }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Explore"
        title="Well Explorer"
        subtitle="One point per unique well, positioned by surface coordinates and classified by its current status. Rings mark wells that have both produced and injected."
        actions={
          <Button variant="secondary" icon={<Maximize2 className="size-4" />} onClick={() => setFitNonce((n) => n + 1)} disabled={status !== 'ready'}>
            Fit to wells
          </Button>
        }
      />

      <Card className="p-4 sm:p-5">
        <WellFilterBar filters={filters} onChange={setFilters} operatingAreas={areas} performanceClasses={performanceClasses} />
        {status === 'ready' && (
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {source !== 'static' ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                <Database className="size-3.5 text-primary" />
                <span>{source === 'csv' ? 'Loaded from the local CSV export' : 'Live from Databricks'}</span>
                <span className="font-mono text-[11px] text-[#A39C92]">{metadata?.tables?.join(' + ')}</span>
              </p>
            ) : (
              <Notice tone="neutral">
                <span className="inline-flex items-center gap-1.5 font-medium text-ink"><HardDrive className="size-3.5" /> Showing the local parquet snapshot.</span>{' '}
                {fallbackReason} Performance classes come from the FloodIQ API and appear once the backend is running.{' '}
                <button onClick={reload} className="font-medium text-primary hover:text-primary-hover cursor-pointer">Retry</button>
              </Notice>
            )}
            {source !== 'static' && metadata?.warnings?.map((w) => <Notice key={w} tone="neutral">{w}</Notice>)}
          </div>
        )}
      </Card>

      {status === 'error' ? (
        <Card>
          <EmptyState
            icon={<AlertCircle className="size-5" />}
            title="Couldn't load well data"
            description={error}
            action={<Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={reload}>Try again</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="relative">
              <WellsMap
                wells={filtered}
                selectedId={selectedId}
                onSelect={setSelectedId}
                fitKey={fitKey}
                className="h-[clamp(440px,62vh,720px)]"
              >
                <MapLegend items={legend} className="absolute bottom-10 left-3 z-10" />
                <div className="absolute left-14 top-3 z-10 hidden rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[12px] text-muted shadow-soft backdrop-blur-sm sm:block">
                  <span className="font-semibold tabular-nums text-ink">{filtered.length.toLocaleString()}</span> of {wells.length.toLocaleString()} wells shown
                </div>
                {!selected && (
                  <div className="pointer-events-none absolute right-3 top-3 z-10 hidden items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[12px] text-muted shadow-soft md:flex">
                    <MousePointerClick className="size-3.5" /> Click a well for details
                  </div>
                )}
              </WellsMap>
                {selected && (
                  <WellInfoPanel
                    key={selected.id}
                    well={selected}
                    onClose={() => setSelectedId(null)}
                    onViewDetails={(w) => navigate(`/analytics?uwi=${encodeURIComponent(w.uwi)}`)}
                    className="absolute inset-x-3 bottom-3 z-20 max-h-[62%] md:inset-x-auto md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-[340px]"
                  />
                )}
              {status === 'loading' && <LoadingState label="Loading wells…" className="absolute inset-0 z-30 bg-surface/70 backdrop-blur-[1px]" />}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-2 px-5 pb-3 pt-5">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Wells</h2>
                <p className="mt-0.5 text-[13px] text-muted">
                  Select a row to locate the well on the map.{' '}
                  {source === 'static' ? 'Latest values are the most recent non-empty daily reading.' : `Performance classes are the existing labels from ${metadata?.tables?.[1] ?? 'the performance table'}.`}
                </p>
              </div>
            </div>
            {status === 'loading' ? <LoadingState label="Loading wells…" /> : <WellsTable wells={filtered} selectedId={selectedId} onSelect={setSelectedId} />}
          </Card>
        </>
      )}
    </div>
  )
}
