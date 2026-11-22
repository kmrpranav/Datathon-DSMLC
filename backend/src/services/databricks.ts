/**
 * Minimal client for the Databricks SQL Statement Execution API
 * (POST /api/2.0/sql/statements). Handles submission, status polling,
 * cancellation on timeout, chunked results and type normalization.
 *
 * Callers pass SQL that the backend itself built from allowlisted tables and
 * columns; user-provided values always go through `params` (named `:markers`).
 */
import { DatabricksError } from '../lib/errors.js'

export type SqlParamType = 'STRING' | 'INT' | 'BIGINT' | 'DOUBLE' | 'BOOLEAN' | 'DATE'
export interface SqlParam {
  name: string
  /** `null` binds SQL NULL. */
  value: string | number | boolean | null
  type?: SqlParamType
}

export interface ResultColumn {
  name: string
  /** Databricks `type_name`, e.g. STRING, DOUBLE, DATE. */
  type: string
}

export type Row = Record<string, unknown>

export interface QueryResult<T extends Row = Row> {
  statementId: string
  columns: ResultColumn[]
  rows: T[]
  rowCount: number
  /** True if Databricks truncated the result (row/byte limits). */
  truncated: boolean
}

export interface QueryOptions {
  /** Overall deadline for this statement, including polling. */
  timeoutMs?: number
  /** Short label used in logs, e.g. "wells.list". Never include values. */
  label?: string
}

/** Anything that can run read-only SQL — the real client or a test fake. */
export interface SqlExecutor {
  query<T extends Row = Row>(sql: string, params?: SqlParam[], opts?: QueryOptions): Promise<QueryResult<T>>
}

export interface DatabricksClientConfig {
  host: string
  token: string
  warehouseId: string
  catalog: string
  schema: string
  queryTimeoutMs: number
}

type Fetch = typeof fetch
type StatementState = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'CLOSED'

interface StatementResponse {
  statement_id: string
  status: { state: StatementState; error?: { error_code?: string; message?: string } }
  manifest?: {
    schema?: { columns?: Array<{ name: string; type_name?: string; type_text?: string; position?: number }> }
    total_row_count?: number
    total_chunk_count?: number
    truncated?: boolean
  }
  result?: ResultChunk
}
interface ResultChunk {
  data_array?: Array<Array<string | null>>
  next_chunk_internal_link?: string
  chunk_index?: number
  row_count?: number
}

const READ_ONLY = /^\s*(SELECT|WITH|DESCRIBE|SHOW)\b/i
/** Rough guard against stacked statements; SQL is backend-built anyway. */
const STACKED = /;\s*\S/

export class DatabricksClient implements SqlExecutor {
  constructor(
    private readonly cfg: DatabricksClientConfig,
    private readonly fetchImpl: Fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
    private readonly log: (msg: string) => void = (m) => console.log(m),
  ) {}

  async query<T extends Row = Row>(sql: string, params: SqlParam[] = [], opts: QueryOptions = {}): Promise<QueryResult<T>> {
    if (!READ_ONLY.test(sql) || STACKED.test(sql.trim().replace(/;\s*$/, ''))) {
      throw new DatabricksError('FAILED', 'Refusing to run a non read-only or multi-statement query')
    }
    const timeoutMs = opts.timeoutMs ?? this.cfg.queryTimeoutMs
    const deadline = Date.now() + timeoutMs
    const started = Date.now()

    let res = await this.request<StatementResponse>('POST', '/api/2.0/sql/statements', {
      warehouse_id: this.cfg.warehouseId,
      catalog: this.cfg.catalog,
      schema: this.cfg.schema,
      statement: sql,
      parameters: params.map(toApiParam),
      // Wait synchronously up to 30s, then fall back to polling.
      wait_timeout: `${Math.min(30, Math.max(5, Math.floor(timeoutMs / 1000)))}s`,
      on_wait_timeout: 'CONTINUE',
      disposition: 'INLINE',
      format: 'JSON_ARRAY',
    })

    let delay = 500
    while (res.status.state === 'PENDING' || res.status.state === 'RUNNING') {
      if (Date.now() + delay > deadline) {
        await this.cancel(res.statement_id)
        throw new DatabricksError('TIMEOUT', `Query timed out after ${Math.round(timeoutMs / 1000)}s`, { statementId: res.statement_id })
      }
      await this.sleep(delay)
      delay = Math.min(delay * 1.6, 3000)
      res = await this.request<StatementResponse>('GET', `/api/2.0/sql/statements/${encodeURIComponent(res.statement_id)}`)
    }

    const { state, error } = res.status
    if (state !== 'SUCCEEDED') {
      const providerMessage = error?.message
      const code = state === 'FAILED' ? (/TABLE_OR_VIEW_NOT_FOUND/i.test(providerMessage ?? '') ? 'TABLE_NOT_FOUND' : 'FAILED') : state
      throw new DatabricksError(code, `Statement ${state.toLowerCase()}`, {
        statementId: res.statement_id,
        providerCode: error?.error_code,
        providerMessage,
      })
    }

    const columns: ResultColumn[] = (res.manifest?.schema?.columns ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ name: c.name, type: (c.type_name ?? c.type_text ?? 'STRING').toUpperCase() }))

    const rows: T[] = []
    let chunk: ResultChunk | undefined = res.result
    let pages = 0
    while (chunk) {
      for (const arr of chunk.data_array ?? []) rows.push(toObject(columns, arr) as T)
      const next = chunk.next_chunk_internal_link
      if (!next) break
      if (++pages > 10_000) throw new DatabricksError('BAD_RESPONSE', 'Too many result chunks')
      if (Date.now() > deadline) throw new DatabricksError('TIMEOUT', 'Timed out while fetching result chunks', { statementId: res.statement_id })
      chunk = await this.request<ResultChunk>('GET', next)
    }

    this.log(`[databricks] ${opts.label ?? 'query'} → ${rows.length} rows in ${Date.now() - started}ms (${res.statement_id})`)
    return { statementId: res.statement_id, columns, rows, rowCount: rows.length, truncated: Boolean(res.manifest?.truncated) }
  }

  private async cancel(statementId: string) {
    try {
      await this.request('POST', `/api/2.0/sql/statements/${encodeURIComponent(statementId)}/cancel`)
    } catch {
      /* best effort */
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/api/2.0/sql/statements')) throw new DatabricksError('BAD_RESPONSE', 'Unexpected result link')
    let res: Response
    try {
      res = await this.fetchImpl(`${this.cfg.host}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.cfg.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'floodiq-backend/0.1',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      })
    } catch (e) {
      const reason = e instanceof Error && e.name === 'TimeoutError' ? 'request timed out' : 'network error'
      throw new DatabricksError('NETWORK', `Could not reach Databricks (${reason})`)
    }
    const text = await res.text()
    let json: unknown = undefined
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      const providerMessage = (json as { message?: string } | undefined)?.message
      const providerCode = (json as { error_code?: string } | undefined)?.error_code
      if (res.status === 401 || res.status === 403) {
        throw new DatabricksError('AUTH', 'Databricks rejected the credentials', { httpStatus: res.status, providerCode, providerMessage })
      }
      throw new DatabricksError('HTTP', `Databricks API returned HTTP ${res.status}`, { httpStatus: res.status, providerCode, providerMessage })
    }
    if (json === undefined) throw new DatabricksError('BAD_RESPONSE', 'Databricks returned a non-JSON response')
    return json as T
  }
}

function toApiParam(p: SqlParam) {
  const out: { name: string; type: SqlParamType; value?: string } = { name: p.name, type: p.type ?? inferType(p.value) }
  if (p.value !== null) out.value = String(p.value) // omitted value = SQL NULL
  return out
}

function inferType(v: SqlParam['value']): SqlParamType {
  if (typeof v === 'boolean') return 'BOOLEAN'
  if (typeof v === 'number') return Number.isInteger(v) ? 'BIGINT' : 'DOUBLE'
  return 'STRING'
}

function toObject(columns: ResultColumn[], values: Array<string | null>): Row {
  const row: Row = {}
  columns.forEach((c, i) => {
    row[c.name] = normalizeValue(values[i] ?? null, c.type)
  })
  return row
}

/** JSON_ARRAY results arrive as strings; convert them to proper JSON types. */
export function normalizeValue(raw: string | null, type: string): unknown {
  if (raw === null || raw === undefined) return null
  const t = type.toUpperCase()
  switch (t) {
    case 'BYTE':
    case 'TINYINT':
    case 'SHORT':
    case 'SMALLINT':
    case 'INT':
    case 'INTEGER':
    case 'FLOAT':
    case 'DOUBLE':
    case 'DECIMAL': {
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'LONG':
    case 'BIGINT': {
      const n = Number(raw)
      if (!Number.isFinite(n)) return null
      return Number.isSafeInteger(n) ? n : raw
    }
    case 'BOOLEAN':
      return raw === 'true' ? true : raw === 'false' ? false : null
    case 'ARRAY':
    case 'MAP':
    case 'STRUCT':
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    default:
      // STRING, DATE (YYYY-MM-DD), TIMESTAMP (ISO-8601), BINARY, INTERVAL…
      return raw
  }
}
