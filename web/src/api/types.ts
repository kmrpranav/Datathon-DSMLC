/** Mirrors backend/src/types/api.ts. Column-shaped data keeps real Databricks column names. */
export type Scalar = string | number | boolean | null
export type DataRow = Record<string, unknown>
export interface ColumnInfo { name: string; type: string }
export type FieldMap = Partial<Record<string, string>>

export interface HealthResponse {
  status: 'ok' | 'degraded'
  databricks: { configured: boolean; missing: string[]; catalog: string; schema: string }
}

export interface TableRowsResponse {
  table: string
  columns: ColumnInfo[]
  fields: FieldMap
  rows: DataRow[]
  page: { limit: number; offset: number; total: number }
  sort: { column: string | null; dir: 'asc' | 'desc' }
  cached: boolean
  generatedAt: string
  notice?: string
}

export interface PerformanceSummary {
  table: string
  classColumn: string
  totalRows: number
  totalWells: number
  multipleRowsPerWell: boolean
  byClass: Array<{ class: string; wells: number; rows: number }>
  generatedAt: string
}
export type PerformanceResponse = TableRowsResponse & { summary: PerformanceSummary }
export type EconomicsResponse = TableRowsResponse & { scenarios: string[] }

export interface OverviewResponse {
  generatedAt: string
  cached: boolean
  wells: null | {
    totalUnique?: number
    masterRows?: number
    mapped: number
    excludedInvalidCoordinates: number
    byRole: { injection: number; production: number; unknown: number }
    dualRole: number
    byOperatingArea: Array<{ name: string; wells: number }>
    byProvince: Array<{ name: string; wells: number }>
  }
  performance: PerformanceSummary | null
  pairs: null | { table: string; pairs: number; injectors: number | null; producers: number | null; medianDistance: number | null; distanceColumn: string | null; notice: string }
  conversion: null | { table: string; candidates: number; distinctWells: number | null; notice: string }
  economics: null | { table: string; rows: number; distinctWells: number | null; scenarios: string[]; notice: string }
  warnings: string[]
}

export interface WellDetailResponse {
  uwi: string
  attributes: DataRow
  performance: { available: boolean; classColumn: string | null; latest: DataRow | null; records: DataRow[]; recordCount: number }
  pairs: { available: boolean; asInjector: DataRow[]; asProducer: DataRow[]; fields: FieldMap; notice: string }
  conversion: { ranking: DataRow[]; economics: DataRow[]; notice: string }
  producerFeatures: DataRow | null
  generatedAt: string
}

export interface SimulationStatus { liveInference: boolean; message: string }
