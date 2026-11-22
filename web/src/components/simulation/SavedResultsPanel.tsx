import { useMemo } from 'react'
import clsx from 'clsx'
import { Eye, EyeOff, Trophy } from 'lucide-react'
import type { TableRowsResponse, EconomicsResponse } from '../../api/types'
import type { ApiState } from '../../hooks/useApi'
import { ApiErrorState, Notice, SourceTag } from '../data/DataStates'
import { Spinner } from '../ui/States'
import { formatCell, prettyColumn } from '../../lib/format'

interface SavedResultsPanelProps {
  ranking: ApiState<TableRowsResponse> & { retry: () => void }
  economics: ApiState<EconomicsResponse> & { retry: () => void }
  showOnMap: boolean
  onToggleMap: () => void
  onSelectUwi: (uwi: string) => void
  selectedUwi: string | null
  className?: string
}

/** Saved conversion ranking + economics scenarios (saved model outputs; no live inference). */
export function SavedResultsPanel({ ranking, economics, showOnMap, onToggleMap, onSelectUwi, selectedUwi, className }: SavedResultsPanelProps) {
  const r = ranking.status === 'ready' ? ranking.data : null
  const uwiCol = r?.fields.uwi
  const rankCol = r?.fields.rank
  const scoreCol = r?.fields.score
  const top = useMemo(() => r?.rows.slice(0, 8) ?? [], [r])

  return (
    <section aria-labelledby="saved-results-title" className={clsx('flex flex-col gap-3 rounded-2xl border border-line bg-surface/95 p-5 shadow-float backdrop-blur-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="saved-results-title" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <Trophy className="size-4 text-muted" /> Saved conversion ranking
        </h2>
        {r && uwiCol && (
          <button onClick={onToggleMap} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-primary hover:bg-primary-soft cursor-pointer">
            {showOnMap ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {showOnMap ? 'Hide' : 'Show'} on map
          </button>
        )}
      </div>

      {ranking.status === 'loading' && <div className="grid place-items-center py-6"><Spinner /></div>}
      {ranking.status === 'error' && <ApiErrorState compact error={ranking.error} onRetry={ranking.retry} />}
      {r && (
        r.rows.length === 0 ? (
          <p className="text-[12.5px] text-muted">The ranking table is empty.</p>
        ) : !uwiCol ? (
          <p className="text-[12.5px] text-muted">No UWI column was found in {r.table}.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line">
            {top.map((row, i) => {
              const uwi = String(row[uwiCol])
              return (
                <li key={uwi + i}>
                  <button
                    onClick={() => onSelectUwi(uwi)}
                    className={clsx('flex w-full items-center gap-3 px-1 py-2 text-left text-[12.5px] cursor-pointer rounded-lg', selectedUwi === uwi ? 'bg-primary-soft' : 'hover:bg-[#FBFAF7]')}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#F3EFE8] text-[11px] font-semibold tabular-nums text-ink">
                      {rankCol ? formatCell(row[rankCol]) : i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink">{uwi}</span>
                    {scoreCol && <span className="tabular-nums text-muted" title={prettyColumn(scoreCol)}>{formatCell(row[scoreCol])}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        )
      )}
      {r && <SourceTag>{r.table} · {r.page.total.toLocaleString()} candidates</SourceTag>}

      <div className="border-t border-line pt-3">
        <p className="text-[13px] font-medium">Economics scenarios</p>
        {economics.status === 'loading' && <p className="mt-1 text-[12.5px] text-muted">Loading…</p>}
        {economics.status === 'error' && <p className="mt-1 text-[12.5px] text-muted">{economics.error.message}</p>}
        {economics.status === 'ready' && (
          <>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {economics.data.scenarios.length
                ? economics.data.scenarios.map((s) => <span key={s} className="rounded-md border border-line bg-[#FBFAF7] px-1.5 py-0.5 text-[11.5px] text-ink">{s}</span>)
                : <span className="text-[12.5px] text-muted">No scenario column in this table; each row is one saved estimate.</span>}
            </div>
            <SourceTag className="mt-1.5">{economics.data.table} · {economics.data.page.total.toLocaleString()} rows</SourceTag>
          </>
        )}
      </div>

      <Notice>Saved model-generated estimates — not live inference and not verified realized savings or profits.</Notice>
    </section>
  )
}
