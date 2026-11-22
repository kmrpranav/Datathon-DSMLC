import { useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { Card } from '../ui/Card'
import { LoadingState, EmptyState } from '../ui/States'
import { DataTable } from '../data/DataTable'
import { ApiErrorState, Notice, SourceTag } from '../data/DataStates'
import { useApi } from '../../hooks/useApi'
import type { DataRow, TableRowsResponse } from '../../api/types'
import type { PageParams } from '../../api/floodiq'

interface ResultsTableCardProps<T extends TableRowsResponse> {
  title: string
  description: string
  icon: LucideIcon
  /** Fetcher receives server-side paging/sorting; filters are captured by the caller. */
  load: (p: PageParams, signal: AbortSignal) => Promise<T>
  /** Changes when caller filters change (resets to page 1). */
  filterKey: string
  pageSize?: number
  toolbar?: ReactNode
  /** Choose which real columns to show (defaults to all). */
  pickColumns?: (data: T) => string[] | undefined
  onRowClick?: (row: DataRow, data: T) => void
  highlight?: (row: DataRow, data: T) => boolean
  footer?: (data: T) => ReactNode
}

/** Card wrapping a paginated, server-sorted table with loading / error / empty states. */
export function ResultsTableCard<T extends TableRowsResponse>({ title, description, icon: Icon, load, filterKey, pageSize = 10, toolbar, pickColumns, onRowClick, highlight, footer }: ResultsTableCardProps<T>) {
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ column?: string; dir?: 'asc' | 'desc' }>({})
  const [lastKey, setLastKey] = useState(filterKey)
  if (lastKey !== filterKey) {
    setLastKey(filterKey)
    setPage(0)
  }
  const state = useApi((signal) => load({ limit: pageSize, offset: page * pageSize, sort: sort.column, dir: sort.dir }, signal), `${filterKey}|${page}|${sort.column}|${sort.dir}`)
  const d = state.status === 'ready' ? state.data : null
  const pages = d ? Math.max(1, Math.ceil(d.page.total / pageSize)) : 1

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#F3EFE8] text-muted"><Icon className="size-[18px]" /></div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>
          </div>
        </div>
        {toolbar}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
        {state.status === 'loading' && <LoadingState label="Loading…" />}
        {state.status === 'error' && <ApiErrorState compact error={state.error} onRetry={state.retry} />}
        {d && (d.rows.length === 0 ? (
          <EmptyState className="p-6" icon={<SearchX className="size-5" />} title="No rows" description="No records match the current filters." />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-line">
              <DataTable
                columns={d.columns}
                rows={d.rows}
                visible={pickColumns?.(d)}
                sort={d.sort}
                onSort={(column) => setSort({ column, dir: d.sort.column === column && d.sort.dir === 'asc' ? 'desc' : 'asc' })}
                onRowClick={onRowClick ? (r) => onRowClick(r, d) : undefined}
                highlight={highlight ? (r) => highlight(r, d) : undefined}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted">
              <SourceTag>{d.table} · {d.page.total.toLocaleString()} rows</SourceTag>
              <div className="flex items-center gap-1">
                <PageBtn label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></PageBtn>
                <span className="px-2 tabular-nums text-ink">{page + 1} / {pages.toLocaleString()}</span>
                <PageBtn label="Next page" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></PageBtn>
              </div>
            </div>
          </>
        ))}
        {d?.notice && <Notice>{d.notice}</Notice>}
        {d && footer?.(d)}
      </div>
    </Card>
  )
}

function PageBtn({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick} className="grid size-7 place-items-center rounded-lg border border-line bg-surface text-ink hover:border-[#D5CDC1] disabled:pointer-events-none disabled:opacity-40 cursor-pointer">
      {children}
    </button>
  )
}
