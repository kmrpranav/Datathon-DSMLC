/**
 * The boundary between the HTTP routes and where data comes from.
 *
 * Routes only talk to a `DataSource`. Two implementations exist:
 * - `CsvDataSource`: the exported CSV files in the project root (default).
 * - `DatabricksDataSource`: the Unity Catalog tables via the SQL Statement API.
 * Switch with `DATA_SOURCE=csv|databricks` in backend/.env. Both return the
 * same response shapes, so the frontend doesn't change.
 */
import type { PageInput } from '../repositories/analytics.js'
import type { WellFilterInput } from '../repositories/wells.js'
import type { DataSourceKind, TableRowsResponse, WellsResponse } from '../types/api.js'

export interface PerformanceQuery extends PageInput { class?: string; area?: string; search?: string }
export interface PairsQuery extends PageInput { uwi?: string; injector?: string; producer?: string; area?: string; maxDistance?: number }
export interface RankingQuery extends PageInput { area?: string; search?: string; minScore?: number }
export interface EconomicsQuery extends PageInput { scenario?: string; uwi?: string; search?: string }

export interface DataSourceHealth {
  kind: DataSourceKind
  ok: boolean
  /** Per-table availability (no paths, no credentials). */
  tables?: Record<string, { available: boolean; source?: string; rows?: number; error?: string }>
  connection?: { ok: boolean; latencyMs?: number; error?: string }
}

export interface DataSource {
  readonly kind: DataSourceKind
  /** Cheap by default; `deep` actually reads every table. */
  health(deep: boolean): Promise<DataSourceHealth>
  /** Columns + logical-field resolution per table (no data). */
  schemaReport(): Promise<Record<string, unknown>>
  wells(filters: WellFilterInput): Promise<WellsResponse>
  well(uwi: string): Promise<unknown>
  performanceSummary(): Promise<unknown>
  performanceRows(q: PerformanceQuery): Promise<TableRowsResponse>
  pairs(q: PairsQuery): Promise<TableRowsResponse>
  conversionRanking(q: RankingQuery): Promise<TableRowsResponse>
  conversionEconomics(q: EconomicsQuery): Promise<TableRowsResponse & { scenarios: string[] }>
  overview(): Promise<unknown>
  /** Well-level dataset for the Analytics page (CSV source only for now). */
  analytics(): Promise<unknown>
}
