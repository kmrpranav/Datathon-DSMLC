import { useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { sortBy, type SortDir } from '../../lib/analyticsData'

export interface Column<T> {
  key: string
  label: string
  /** Unit shown under the header, e.g. "m³/d". */
  unit?: string
  title?: string
  numeric?: boolean
  mono?: boolean
  value: (row: T) => string | number | null | undefined
  render?: (row: T) => ReactNode
}

interface Props<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  initialSort: { key: string; dir: SortDir }
  pageSize?: number
  onRowClick?: (row: T) => void
  selectedKey?: string | null
  minWidth?: number
  caption: string
}

/** Client-side sorted, paginated table. Null values render as "—" and sort last. */
export function SortableTable<T>({ rows, columns, rowKey, initialSort, pageSize = 12, onRowClick, selectedKey, minWidth = 720, caption }: Props<T>) {
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0]
    return sortBy(rows, col.value, sort.dir)
  }, [rows, columns, sort])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggle = (key: string, numeric?: boolean) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: numeric ? 'desc' : 'asc' }))
    setPage(0)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort.key === c.key
                return (
                  <th key={c.key} scope="col" title={c.title} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={clsx('border-b border-line bg-[#FBFAF7] px-3 py-2 align-bottom font-medium text-muted', c.numeric && 'text-right')}>
                    <button onClick={() => toggle(c.key, c.numeric)} className={clsx('inline-flex items-center gap-1 whitespace-nowrap hover:text-ink cursor-pointer', active && 'text-ink', c.numeric && 'flex-row-reverse')}>
                      <span className="flex flex-col leading-tight">
                        {c.label}
                        {c.unit && <span className="text-[10.5px] font-normal text-[#A39C92]">{c.unit}</span>}
                      </span>
                      {active && (sort.dir === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const k = rowKey(r)
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={clsx(onRowClick && 'cursor-pointer', selectedKey === k ? 'bg-primary-soft' : onRowClick && 'hover:bg-[#FBFAF7]')}
                >
                  {columns.map((c) => {
                    const content = c.render ? c.render(r) : c.value(r)
                    return (
                      <td key={c.key} className={clsx('border-b border-line px-3 py-2 text-ink', c.numeric && 'text-right tabular-nums', c.mono && 'font-mono text-[11.5px]')}>
                        {content === null || content === undefined || content === '' ? <span className="text-[#B5AEA4]">—</span> : content}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[13px] text-muted">No rows match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="tabular-nums">
          {sorted.length ? `${current * pageSize + 1}–${Math.min(sorted.length, (current + 1) * pageSize)} of ${sorted.length.toLocaleString()}` : '0 rows'}
        </span>
        <div className="flex items-center gap-1">
          <button aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-40 cursor-pointer disabled:cursor-default">
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums">{current + 1} / {pages}</span>
          <button aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-lg p-1.5 hover:bg-black/5 disabled:opacity-40 cursor-pointer disabled:cursor-default">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
