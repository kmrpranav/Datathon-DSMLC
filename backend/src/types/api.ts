/**
 * Response contracts for the FloodIQ API. Mirrored in `web/src/api/types.ts`.
 * Column-shaped payloads (`metrics`, `rows`) use the real Databricks column
 * names, so nothing is renamed into fields the tables don't have.
 */
import type { RoleClassification, WellRole } from '../lib/classify.js'
import type { ColumnInfo, LogicalField } from '../repositories/catalog.js'

export type DataSourceKind = 'databricks' | 'csv'
export type Scalar = string | number | boolean | null
export type DataRow = Record<string, unknown>

export interface ErrorResponse {
  error: { code: string; message: string; details?: unknown; requestId?: string }
}

export interface HealthResponse {
  status: 'ok' | 'degraded'
  service: 'floodiq-api'
  version: string
  uptimeSeconds: number
  time: string
  /** The active source (`DATA_SOURCE`). */
  dataSource: import('../data/source.js').DataSourceHealth
  databricks: {
    configured: boolean
    missing: string[]
    catalog: string
    schema: string
    /** Present only for `?deep=1`. */
    connection?: { ok: boolean; latencyMs?: number; error?: string }
    tables?: Record<string, { available: boolean }>
  }
  cache: { entries: number; inflight: number }
}

export interface WellProperties {
  uwi: string
  formattedUwi: string | null
  wellName: string | null
  province: string | null
  operatingArea: string | null
  /** Current classification (see `roles.currentRoleSource`). */
  wellType: WellRole
  status: string | null
  flowDirection: string | null
  roles: RoleClassification
  /** Existing Good / Moderate / Low label from bushra_well_performance (not recomputed). */
  performanceClass: string | null
  /** Remaining columns from the latest performance row, keyed by real column name. */
  metrics: Record<string, Scalar>
  performanceRecordCount: number
}

export interface WellFeature {
  type: 'Feature'
  id: number
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: WellProperties
}

export interface WellsMetadata {
  source: DataSourceKind
  tables: string[]
  generatedAt: string
  cached: boolean
  total: number
  returned: number
  excluded: { invalidCoordinates: number }
  duplicates: {
    masterWellsWithMultipleRows: number
    performanceWellsWithMultipleRows: number
    /** How one row per UWI was chosen when duplicates exist. */
    dedupeOrder: { master: string; performance: string }
  }
  fields: { master: Partial<Record<LogicalField, string>>; performance: Partial<Record<LogicalField, string>> | null }
  metricColumns: ColumnInfo[]
  performanceClasses: string[]
  operatingAreas: string[]
  filters: Record<string, string>
  warnings: string[]
}

export interface WellsResponse {
  type: 'FeatureCollection'
  metadata: WellsMetadata
  features: WellFeature[]
}

export interface Page {
  limit: number
  offset: number
  total: number
}

export interface TableRowsResponse {
  table: string
  columns: ColumnInfo[]
  fields: Partial<Record<LogicalField, string>>
  rows: DataRow[]
  page: Page
  sort: { column: string | null; dir: 'asc' | 'desc' }
  cached: boolean
  generatedAt: string
  notice?: string
}
