import clsx from 'clsx'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ColumnInfo, DataRow } from '../../api/types'
import { formatCell, prettyColumn } from '../../lib/format'

const NUMERIC = /^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|SHORT|BYTE|FLOAT|DOUBLE|DECIMAL|REAL)/i

interface DataTableProps {
  columns: ColumnInfo[]
  rows: DataRow[]
  /** Restrict / order visible columns (real column names). */
  visible?: string[]
  sort?: { column: string | null; dir: 'asc' | 'desc' }
  onSort?: (column: string) => void
  onRowClick?: (row: DataRow) => void
  highlight?: (row: DataRow) => boolean
  className?: string
  minWidth?: number
}

/** Generic table for Databricks result rows. Headers keep the real column name in a tooltip. */
export function DataTable({ columns, rows, visible, sort, onSort, onRowClick, highlight, className, minWidth = 560 }: DataTableProps) {
  const cols = visible ? (visible.map((v) => columns.find((c) => c.name === v)).filter(Boolean) as ColumnInfo[]) : columns
  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full border-separate border-spacing-0 text-left text-[12.5px]" style={{ minWidth }}>
        <thead>
          <tr>
            {cols.map((c) => {
              const numeric = NUMERIC.test(c.type)
              const active = sort?.column === c.name
              return (
                <th key={c.name} scope="col" title={c.name} className={clsx('sticky top-0 border-b border-line bg-[#FBFAF7] px-3 py-2 font-medium text-muted whitespace-nowrap', numeric && 'text-right')}>
                  {onSort ? (
                    <button onClick={() => onSort(c.name)} className={clsx('inline-flex items-center gap-1 hover:text-ink cursor-pointer', active && 'text-ink')}>
                      {prettyColumn(c.name)}
                      {active && (sort!.dir === 'asc' ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />)}
                    </button>
                  ) : (
                    prettyColumn(c.name)
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={clsx(onRowClick && 'cursor-pointer', highlight?.(r) ? 'bg-primary-soft' : onRowClick && 'hover:bg-[#FBFAF7]')}
            >
              {cols.map((c) => {
                const v = formatCell(r[c.name])
                return (
                  <td key={c.name} className={clsx('border-b border-line px-3 py-2 text-ink', NUMERIC.test(c.type) && 'text-right tabular-nums', /uwi/i.test(c.name) && 'font-mono text-[11.5px]')}>
                    {v ?? <span className="text-[#B5AEA4]">—</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
