import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import type { Well } from '../../types/well'
import { formatDate, formatNumber } from '../../lib/format'
import { Badge, DualTag, StatusBadge, WellTypeBadge } from '../ui/Badge'
import { EmptyState } from '../ui/States'

type SortKey = 'uwi' | 'wellName' | 'province' | 'operatingArea' | 'wellType' | 'status' | 'performanceClass' | 'latestOilM3' | 'latestInjectedWaterM3'
interface Column {
  key: SortKey
  label: string
  numeric?: boolean
  className?: string
}

const BASE_COLUMNS: Column[] = [
  { key: 'uwi', label: 'UWI' },
  { key: 'wellName', label: 'Well name', className: 'min-w-[200px]' },
  { key: 'province', label: 'Prov.' },
  { key: 'operatingArea', label: 'Operating area' },
  { key: 'wellType', label: 'Type' },
  { key: 'status', label: 'Status' },
]
const PERFORMANCE_COLUMN: Column = { key: 'performanceClass', label: 'Performance' }
// Only the local parquet snapshot has daily "latest" readings.
const LATEST_COLUMNS: Column[] = [
  { key: 'latestOilM3', label: 'Latest oil (m³/d)', numeric: true },
  { key: 'latestInjectedWaterM3', label: 'Latest water inj. (m³/d)', numeric: true },
]
const PERF_TONE: Record<string, 'green' | 'amber' | 'neutral'> = { good: 'green', moderate: 'amber', low: 'neutral' }

const PAGE_SIZES = [10, 25, 50]

interface WellsTableProps {
  wells: Well[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function WellsTable({ wells, selectedId, onSelect }: WellsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'uwi', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>())
  const hasPerformance = useMemo(() => wells.some((w) => w.performanceClass), [wells])
  const hasLatest = useMemo(() => wells.some((w) => w.latestOilM3 !== undefined), [wells])
  const COLUMNS = useMemo(
    () => [...BASE_COLUMNS, ...(hasPerformance ? [PERFORMANCE_COLUMN] : []), ...(hasLatest ? LATEST_COLUMNS : [])],
    [hasPerformance, hasLatest],
  )

  const sorted = useMemo(() => {
    const { key, dir } = sort
    const m = dir === 'asc' ? 1 : -1
    return [...wells].sort((a, b) => {
      const av = a[key], bv = b[key]
      // Missing values always sort last.
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * m
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * m
    })
  }, [wells, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  useEffect(() => setPage(0), [wells, pageSize])
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1)
  }, [page, pageCount])

  // When selection comes from the map, jump to the page containing that row.
  useEffect(() => {
    if (selectedId == null) return
    const idx = sorted.findIndex((w) => w.id === selectedId)
    if (idx === -1) return
    const target = Math.floor(idx / pageSize)
    setPage(target)
    requestAnimationFrame(() => rowRefs.current.get(selectedId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const rows = sorted.slice(page * pageSize, page * pageSize + pageSize)
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: [...BASE_COLUMNS, ...LATEST_COLUMNS].find((c) => c.key === key)?.numeric ? 'desc' : 'asc' }))

  if (!wells.length) {
    return <EmptyState icon={<SearchX className="size-5" />} title="No wells match these filters" description="Try a different province, operating area, or search term — or reset the filters." />
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-[13px]">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key
                const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={clsx('sticky top-0 border-b border-line bg-[#FBFAF7] px-4 py-0 font-medium text-muted', c.numeric && 'text-right', c.className)}
                  >
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={clsx('inline-flex h-10 items-center gap-1.5 whitespace-nowrap text-[12px] transition-colors hover:text-ink cursor-pointer', active && 'text-ink', c.numeric && 'flex-row-reverse')}
                    >
                      {c.label}
                      <Icon className={clsx('size-3.5', active ? 'text-primary' : 'opacity-40')} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const selected = w.id === selectedId
              return (
                <tr
                  key={w.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(w.id, el)
                    else rowRefs.current.delete(w.id)
                  }}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => onSelect(w.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(w.id)
                    }
                  }}
                  className={clsx(
                    'group cursor-pointer transition-colors focus:outline-none focus-visible:bg-primary-soft/60',
                    selected ? 'bg-primary-soft' : 'hover:bg-[#FBFAF7]',
                  )}
                >
                  <td className={clsx('border-b border-line px-4 py-3 font-mono text-[12px] whitespace-nowrap', selected ? 'shadow-[inset_3px_0_0_var(--color-primary)] text-primary-hover' : 'text-[#5F5A53]')}>
                    {w.formattedUwi ?? w.uwi}
                  </td>
                  <td className="border-b border-line px-4 py-3 font-medium text-ink">{w.wellName ?? <Missing />}</td>
                  <td className="border-b border-line px-4 py-3 text-[#5F5A53]">{w.province ?? <Missing />}</td>
                  <td className="border-b border-line px-4 py-3 whitespace-nowrap text-[#5F5A53]">{w.operatingArea ?? <Missing />}</td>
                  <td className="border-b border-line px-4 py-3">
                    <div className="flex items-center gap-2">
                      <WellTypeBadge type={w.wellType} />
                      {w.roles.dualRole && <DualTag />}
                    </div>
                  </td>
                  <td className="border-b border-line px-4 py-3"><StatusBadge status={w.status} /></td>
                  {hasPerformance && (
                    <td className="border-b border-line px-4 py-3">
                      {w.performanceClass ? <Badge tone={PERF_TONE[w.performanceClass.toLowerCase()] ?? 'neutral'}>{w.performanceClass}</Badge> : <Missing />}
                    </td>
                  )}
                  {hasLatest && (
                    <>
                      <td className="border-b border-line px-4 py-3 text-right tabular-nums" title={w.latestOilDate ? `Recorded ${formatDate(w.latestOilDate)}` : undefined}>
                        {formatNumber(w.latestOilM3) ?? <Missing />}
                      </td>
                      <td className="border-b border-line px-4 py-3 text-right tabular-nums" title={w.latestInjectedWaterDate ? `Recorded ${formatDate(w.latestInjectedWaterDate)}` : undefined}>
                        {formatNumber(w.latestInjectedWaterM3) ?? <Missing />}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size">Rows</label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px] text-ink cursor-pointer hover:border-[#D5CDC1]"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="ml-2 tabular-nums">
            {(page * pageSize + 1).toLocaleString()}–{Math.min((page + 1) * pageSize, sorted.length).toLocaleString()} of {sorted.length.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <PageBtn label="Previous page" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></PageBtn>
          <span className="px-2 tabular-nums text-ink">Page {page + 1} of {pageCount.toLocaleString()}</span>
          <PageBtn label="Next page" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></PageBtn>
        </div>
      </div>
    </div>
  )
}

function Missing() {
  return <span className="text-[#B5AEA4]" title="Not recorded">—</span>
}

function PageBtn({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-line bg-surface text-ink transition-colors hover:border-[#D5CDC1] disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
    >
      {children}
    </button>
  )
}
