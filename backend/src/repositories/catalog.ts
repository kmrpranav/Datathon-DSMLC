/**
 * Table allowlist + schema-verified column resolution.
 *
 * Column names in Bushra's tables have not been confirmed yet, so queries never
 * hard-code them. Each *logical* field lists candidate column names; at runtime
 * the backend runs `DESCRIBE TABLE`, and a field resolves only to a column that
 * actually exists. Unresolved fields are reported (GET /api/meta/schema) and
 * simply come back as `null` — nothing is invented.
 *
 * After running `npm run inspect`, pin exact names in `COLUMN_OVERRIDES`.
 */
import type { SqlExecutor } from '../services/databricks.js'
import type { TtlCache } from '../services/cache.js'
import { AppError, DatabricksError } from '../lib/errors.js'

export const TABLES = {
  wellMaster: 'bushra_well_master',
  wellPerformance: 'bushra_well_performance',
  pairs: 'bushra_injector_producer_pairs',
  producerFeatures: 'bushra_producer_features_latest',
  conversionRanking: 'bushra_conversion_ranking',
  conversionEconomics: 'bushra_conversion_economics',
} as const
export type TableKey = keyof typeof TABLES

/** Logical fields and candidate column names (case-insensitive), in priority order. */
export const FIELD_CANDIDATES = {
  uwi: ['uwi', 'well_uwi', 'well_id', 'candidate', 'candidate_uwi'],
  formattedUwi: ['formatted_uwi', 'uwi_formatted', 'display_uwi'],
  wellName: ['well_name', 'name'],
  latitude: ['surface_latitude', 'latitude', 'lat', 'bh_latitude'],
  longitude: ['surface_longitude', 'longitude', 'lon', 'lng', 'long', 'bh_longitude'],
  operatingArea: ['field_operating_area', 'operating_area', 'area', 'field'],
  province: ['province', 'province_state', 'state_province'],
  status: ['current_status', 'well_status', 'latest_status', 'well_daily_status', 'latest_well_daily_status', 'status'],
  flowDirection: ['current_flow_direction', 'latest_flow_direction', 'flow_direction'],
  wellType: ['current_well_type', 'well_type', 'well_role', 'current_role', 'role', 'primary_role'],
  performanceClass: [
    'performance_class', 'performance_category', 'performance_classification', 'performance_label', 'performance_tier',
    'performance_group', 'performance', 'perf_class', 'perf_category', 'classification', 'category', 'class',
  ],
  // Evidence for historical roles (explicit flags first, then cumulative totals).
  everProduced: ['ever_produced', 'has_produced', 'was_producer', 'is_producer', 'historically_produced'],
  everInjected: ['ever_injected', 'has_injected', 'was_injector', 'is_injector', 'historically_injected'],
  oilTotal: ['cum_oil_m3', 'cumulative_oil_m3', 'total_oil_m3', 'oil_total_m3', 'total_oil_produced_m3', 'cum_oil', 'total_oil'],
  injectionTotal: [
    'total_inj_m3', 'cum_inj_m3',
    'cum_injected_water_m3', 'cumulative_injected_water_m3', 'total_injected_water_m3', 'cum_injection_m3',
    'cumulative_injection_m3', 'total_injection_m3', 'total_injection_volume_m3', 'cum_injection', 'total_injection',
  ],
  // Role start dates (used to order roles when a well has both histories)
  productionStartDate: ['on_production_date', 'first_production_date', 'production_start_date'],
  injectionStartDate: ['first_injection_date', 'injection_start_date', 'on_injection_date'],
  recordDate: ['as_of_date', 'snapshot_date', 'latest_date', 'last_production_date', 'period_end', 'production_date', 'date', 'month', 'week', 'updated_at'],
  // Pairs
  injectorUwi: ['injector_uwi', 'inj_uwi', 'injector', 'injector_well', 'uwi_injector'],
  producerUwi: ['producer_uwi', 'prod_uwi', 'producer', 'producer_well', 'uwi_producer'],
  distance: ['distance_m', 'distance_km', 'distance_meters', 'distance', 'dist_m', 'dist_km', 'separation_m'],
  // Ranking / economics
  rank: ['rank', 'conversion_rank', 'candidate_rank', 'ranking', 'overall_rank'],
  score: ['conversion_score', 'score', 'candidate_score', 'ranking_score', 'priority_score', 'total_score', 'oil_per_m3_water'],
  scenario: ['scenario', 'scenario_name', 'case', 'case_name', 'price_scenario'],
} as const
export type LogicalField = keyof typeof FIELD_CANDIDATES

/** Which logical fields to look for in which table. */
export const TABLE_FIELDS: Record<TableKey, LogicalField[]> = {
  wellMaster: ['uwi', 'formattedUwi', 'wellName', 'latitude', 'longitude', 'operatingArea', 'province', 'status', 'flowDirection', 'wellType', 'everProduced', 'everInjected', 'oilTotal', 'injectionTotal', 'productionStartDate', 'injectionStartDate', 'recordDate'],
  wellPerformance: ['uwi', 'wellName', 'operatingArea', 'performanceClass', 'status', 'flowDirection', 'everProduced', 'everInjected', 'oilTotal', 'injectionTotal', 'recordDate'],
  pairs: ['injectorUwi', 'producerUwi', 'distance', 'operatingArea'],
  producerFeatures: ['uwi', 'operatingArea', 'recordDate'],
  conversionRanking: ['uwi', 'wellName', 'operatingArea', 'rank', 'score'],
  conversionEconomics: ['uwi', 'wellName', 'operatingArea', 'scenario', 'rank', 'score'],
}

/**
 * Pin verified column names here once `npm run inspect` has been run, e.g.
 * `wellPerformance: { performanceClass: 'perf_bucket' }`. Use `null` to force a
 * field to be treated as absent. Overrides are still checked against DESCRIBE.
 */
export const COLUMN_OVERRIDES: Partial<Record<TableKey, Partial<Record<LogicalField, string | null>>>> = {}

export interface ColumnInfo {
  name: string
  type: string
}
export interface TableSchema {
  key: TableKey
  table: string
  fqtn: string
  columns: ColumnInfo[]
  fields: Partial<Record<LogicalField, string>>
  unresolved: LogicalField[]
}

const NUMERIC = /^(TINYINT|SMALLINT|INT|INTEGER|BIGINT|LONG|SHORT|BYTE|FLOAT|DOUBLE|DECIMAL|REAL)/i
export const isNumericType = (t: string) => NUMERIC.test(t)

export const quoteIdent = (name: string) => `\`${name.replace(/`/g, '``')}\``

export class Catalog {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly cache: TtlCache,
    private readonly location: { catalog: string; schema: string },
    private readonly overrides = COLUMN_OVERRIDES,
  ) {}

  fqtn(key: TableKey) {
    return `${quoteIdent(this.location.catalog)}.${quoteIdent(this.location.schema)}.${quoteIdent(TABLES[key])}`
  }

  /** Columns + resolved fields for a table (DESCRIBE cached for 30 min). */
  async schema(key: TableKey): Promise<TableSchema> {
    const { value } = await this.cache.getOrLoad(`schema:${key}`, () => this.describe(key), 30 * 60_000)
    return value
  }

  /** Like `schema()` but returns null when the table is missing / not accessible. */
  async trySchema(key: TableKey): Promise<TableSchema | null> {
    try {
      return await this.schema(key)
    } catch (e) {
      if (e instanceof DatabricksError && (e.code === 'TABLE_NOT_FOUND' || e.code === 'FAILED')) return null
      throw e
    }
  }

  private async describe(key: TableKey): Promise<TableSchema> {
    const res = await this.sql.query<{ col_name: string; data_type: string }>(`DESCRIBE TABLE ${this.fqtn(key)}`, [], { label: `describe.${key}` })
    const columns: ColumnInfo[] = []
    for (const r of res.rows) {
      const name = (r.col_name ?? '').trim()
      if (!name || name.startsWith('#')) break // partition / metadata section
      columns.push({ name, type: String(r.data_type ?? '').toUpperCase() })
    }
    return resolveFields(key, this.fqtn(key), columns, this.overrides[key] ?? {})
  }
}

export function resolveFields(
  key: TableKey,
  fqtn: string,
  columns: ColumnInfo[],
  overrides: Partial<Record<LogicalField, string | null>> = {},
): TableSchema {
  const byLower = new Map(columns.map((c) => [c.name.toLowerCase(), c.name]))
  const fields: Partial<Record<LogicalField, string>> = {}
  const unresolved: LogicalField[] = []
  const used = new Set<string>()
  for (const field of TABLE_FIELDS[key]) {
    let match: string | undefined
    if (field in overrides) {
      const o = overrides[field]
      match = o ? byLower.get(o.toLowerCase()) : undefined
    } else {
      for (const c of FIELD_CANDIDATES[field]) {
        const hit = byLower.get(c.toLowerCase())
        if (hit && !used.has(hit)) {
          match = hit
          break
        }
      }
    }
    if (match) {
      fields[field] = match
      used.add(match)
    } else unresolved.push(field)
  }
  return { key, table: TABLES[key], fqtn, columns, fields, unresolved }
}

/** Throws a clear 'schema' error when a field the endpoint can't work without is missing. */
export function requireField(s: TableSchema, field: LogicalField): string {
  const col = s.fields[field]
  if (!col) {
    throw new AppError(502, 'SCHEMA_MISMATCH', `Could not find a column for "${field}" in ${s.table}. Run \`npm run inspect\` and pin it in COLUMN_OVERRIDES.`)
  }
  return col
}
