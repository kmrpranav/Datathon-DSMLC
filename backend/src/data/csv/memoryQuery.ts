/**
 * In-memory equivalent of `buildTableSql` (repositories/tableQuery.ts): same
 * filter, search, sort-allowlist and paging rules, applied to parsed CSV rows.
 */
import type { TableSchema } from '../../repositories/catalog.js'
import type { TableQuery } from '../../repositories/tableQuery.js'
import { badRequest } from '../../lib/errors.js'
import type { CsvRow, CsvValue } from './parse.js'

const text = (v: CsvValue) => (v === null ? null : String(v))

/** Ascending comparison; nulls are handled by the caller (always last). */
function compare(a: CsvValue, b: CsvValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

export function queryRows(schema: TableSchema, rows: CsvRow[], query: TableQuery) {
  const preds: Array<(r: CsvRow) => boolean> = []

  for (const f of query.filters ?? []) {
    if (f.value === undefined || f.value === '') continue
    const col = schema.fields[f.field]
    if (!col) throw badRequest(`Filter "${f.field}" is not supported: ${schema.table} has no matching column.`)
    if (typeof f.value === 'number') {
      const target = f.value
      preds.push((r) => {
        const v = r[col]
        if (typeof v !== 'number') return false
        return f.op === 'gte' ? v >= target : f.op === 'lte' ? v <= target : v === target
      })
    } else {
      const target = f.ci ? f.value.toLowerCase() : f.value
      preds.push((r) => {
        const v = text(r[col])
        return v !== null && (f.ci ? v.toLowerCase() : v) === target
      })
    }
  }

  const term = query.search?.value?.trim().toLowerCase()
  if (term) {
    const cols = query.search!.fields.map((fld) => schema.fields[fld]).filter(Boolean) as string[]
    if (!cols.length) throw badRequest(`Search is not supported for ${schema.table}.`)
    preds.push((r) => cols.some((c) => text(r[c])?.toLowerCase().includes(term)))
  }

  let sortCol: string | null = null
  let dir: 'asc' | 'desc' = query.dir ?? 'asc'
  if (query.sort) {
    const match = schema.columns.find((c) => c.name.toLowerCase() === query.sort!.toLowerCase())
    if (!match) throw badRequest(`Unknown sort column "${query.sort}" for ${schema.table}.`, { allowed: schema.columns.map((c) => c.name) })
    sortCol = match.name
  } else {
    for (const d of query.defaultSort ?? []) {
      const col = schema.fields[d.field]
      if (col) {
        sortCol = col
        dir = query.dir ?? d.dir
        break
      }
    }
  }

  let matched = preds.length ? rows.filter((r) => preds.every((p) => p(r))) : [...rows]
  if (sortCol) {
    const col = sortCol
    const sign = dir === 'desc' ? -1 : 1
    matched = matched.sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      if (va === null && vb === null) return 0
      if (va === null) return 1 // NULLS LAST in both directions
      if (vb === null) return -1
      return sign * compare(va, vb)
    })
  }
  const offset = Math.trunc(query.offset)
  const limit = Math.trunc(query.limit)
  return { rows: matched.slice(offset, offset + limit), total: matched.length, sort: { column: sortCol, dir } }
}
