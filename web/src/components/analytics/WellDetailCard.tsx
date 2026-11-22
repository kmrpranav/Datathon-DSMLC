import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { LoadingState } from '../ui/States'
import { ApiErrorState, Notice, SourceTag } from '../data/DataStates'
import { DataTable } from '../data/DataTable'
import { useApi } from '../../hooks/useApi'
import { floodiqApi } from '../../api/floodiq'
import type { DataRow } from '../../api/types'
import { formatCell, prettyColumn } from '../../lib/format'

const PERF_TONE: Record<string, 'green' | 'amber' | 'neutral'> = { good: 'green', moderate: 'amber', low: 'neutral' }
const toColumns = (rows: DataRow[]) => Object.keys(rows[0] ?? {}).map((name) => ({ name, type: typeof rows[0][name] === 'number' ? 'DOUBLE' : 'STRING' }))

/** Everything the Catalog tables hold for one well (GET /api/wells/:uwi). */
export function WellDetailCard({ uwi }: { uwi: string }) {
  const state = useApi((s) => floodiqApi.well(uwi, s), `well:${uwi}`)
  if (state.status === 'loading') return <Card><LoadingState label="Loading well from Databricks…" /></Card>
  if (state.status === 'error') {
    return (
      <Card>
        {state.error.status === 404 ? (
          <p className="p-6 text-[13px] text-muted">UWI <span className="font-mono">{uwi}</span> is not in bushra_well_master.</p>
        ) : (
          <ApiErrorState compact error={state.error} onRetry={state.retry} />
        )}
      </Card>
    )
  }
  const d = state.data
  const perf = d.performance
  const cls = perf.classColumn && perf.latest ? (perf.latest[perf.classColumn] as string | null) : null
  const pairRows = [...d.pairs.asInjector, ...d.pairs.asProducer]

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-[-0.01em]">Well record · <span className="font-mono text-[13px]">{uwi}</span></h3>
        {cls && <Badge tone={PERF_TONE[cls.toLowerCase()] ?? 'neutral'}>{cls} performance</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Latest performance record</p>
          {perf.latest ? (
            <dl className="divide-y divide-line">
              {Object.entries(perf.latest).filter(([, v]) => v !== null && v !== '').map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5 text-[12.5px]">
                  <dt className="text-muted" title={k}>{prettyColumn(k)}</dt>
                  <dd className="text-right tabular-nums text-ink">{formatCell(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-[12.5px] text-muted">{perf.available ? 'No performance record for this well.' : 'Performance table not available.'}</p>
          )}
          {perf.recordCount > 1 && <p className="mt-1 text-[11.5px] text-muted">{perf.recordCount} performance rows exist; the most recent is shown.</p>}
        </section>

        <section className="flex flex-col gap-4">
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Conversion ranking</p>
            {d.conversion.ranking.length ? (
              <div className="overflow-hidden rounded-xl border border-line"><DataTable columns={toColumns(d.conversion.ranking)} rows={d.conversion.ranking} minWidth={360} /></div>
            ) : (
              <p className="text-[12.5px] text-muted">Not in the saved ranking.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Economics scenarios</p>
            {d.conversion.economics.length ? (
              <div className="overflow-hidden rounded-xl border border-line"><DataTable columns={toColumns(d.conversion.economics)} rows={d.conversion.economics} minWidth={360} /></div>
            ) : (
              <p className="text-[12.5px] text-muted">No saved economics rows.</p>
            )}
          </div>
        </section>
      </div>

      <section>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Injector–producer pairs ({d.pairs.asInjector.length} as injector · {d.pairs.asProducer.length} as producer)
        </p>
        {pairRows.length ? (
          <div className="overflow-hidden rounded-xl border border-line"><DataTable columns={toColumns(pairRows)} rows={pairRows.slice(0, 20)} /></div>
        ) : (
          <p className="text-[12.5px] text-muted">{d.pairs.available ? 'No saved pairs include this well.' : 'Pairs table not available.'}</p>
        )}
      </section>

      <Notice>{d.pairs.notice} {d.conversion.notice}</Notice>
      <SourceTag>bushra_well_master · bushra_well_performance · pairs · ranking · economics</SourceTag>
    </Card>
  )
}
