/**
 * Safe, paginated reads of one allowlisted table.
 * - Table: from the TABLES allowlist only.
 * - Sort column: must exist in the table's DESCRIBE output; direction is asc|desc.
 * - Filter values: always bound as named parameters.
 */
import type { SqlExecutor, SqlParam } from '../services/databricks.js'
import type { TtlCache } from '../services/cache.js'
import { Catalog, quoteIdent as q, type LogicalField, type TableKey, type TableSchema } from './catalog.js'
import { badRequest } from '../lib/errors.js'
import type { TableRowsResponse } from '../types/api.js'

export interface FieldFilter {
  field: LogicalField
  value: string | number | undefined
  op?: 'eq' | 'gte' | 'lte'
  /** For `eq` on text: case-insensitive comparison. */
  ci?: boolean
}

export interface TableQuery {
  filters?: FieldFilter[]
  /** Free text matched (case-insensitive, substring) against these fields. */
  search?: { value?: string; fields: LogicalField[] }
  /** Sort column requested by the client; validated against DESCRIBE output. */
  sort?: string
  dir?: 'asc' | 'desc'
  defaultSort?: { field: LogicalField; dir: 'asc' | 'desc' }[]
  limit: number
  offset: number
}

export class TableReader {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly catalog: Catalog,
    private readonly cache: TtlCache,
  ) {}

  async read(key: TableKey, query: TableQuery, notice?: string): Promise<TableRowsResponse> {
    const schema = await this.catalog.schema(key)
    const { sql, params, sort } = buildTableSql(schema, query)
    const cacheKey = `rows:${key}:${JSON.stringify({ sql, params })}`
    const { value, cached, storedAt } = await this.cache.getOrLoad(cacheKey, () => this.sql.query(sql, params, { label: `rows.${key}` }))
    const total = value.rows.length ? Number(value.rows[0].__total ?? 0) : 0
    const rows = value.rows.map(({ __total: _omit, ...rest }) => rest)
    return {
      table: schema.table,
      columns: schema.columns,
      fields: schema.fields,
      rows,
      page: { limit: query.limit, offset: query.offset, total },
      sort,
      cached,
      generatedAt: new Date(storedAt).toISOString(),
      ...(notice ? { notice } : {}),
    }
  }
}

export function buildTableSql(schema: TableSchema, query: TableQuery) {
  const params: SqlParam[] = []
  const where: string[] = []
  let i = 0

  for (const f of query.filters ?? []) {
    if (f.value === undefined || f.value === '') continue
    const col = schema.fields[f.field]
    if (!col) throw badRequest(`Filter "${f.field}" is not supported: ${schema.table} has no matching column.`)
    const name = `p${i++}`
    if (typeof f.value === 'number') {
      params.push({ name, value: f.value, type: 'DOUBLE' })
      const op = f.op === 'gte' ? '>=' : f.op === 'lte' ? '<=' : '='
      where.push(`${q(col)} ${op} :${name}`)
    } else {
      params.push({ name, value: f.ci ? f.value.toLowerCase() : f.value, type: 'STRING' })
      where.push(f.ci ? `lower(CAST(${q(col)} AS STRING)) = :${name}` : `CAST(${q(col)} AS STRING) = :${name}`)
    }
  }

  const term = query.search?.value?.trim()
  if (term) {
    const cols = query.search!.fields.map((fld) => schema.fields[fld]).filter(Boolean) as string[]
    if (!cols.length) throw badRequest(`Search is not supported for ${schema.table}.`)
    const name = `p${i++}`
    // Escape LIKE wildcards in the user term.
    params.push({ name, value: `%${term.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`, type: 'STRING' })
    where.push(`(${cols.map((c) => `lower(CAST(${q(c)} AS STRING)) LIKE :${name}`).join(' OR ')})`)
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

  const limit = Math.trunc(query.limit)
  const offset = Math.trunc(query.offset)
  const sql = [
    `SELECT *, COUNT(*) OVER () AS __total FROM ${schema.fqtn}`,
    where.length ? `WHERE ${where.join(' AND ')}` : '',
    sortCol ? `ORDER BY ${q(sortCol)} ${dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST` : '',
    `LIMIT ${limit} OFFSET ${offset}`,
  ]
    .filter(Boolean)
    .join('\n')
  return { sql, params, sort: { column: sortCol, dir } }
}
