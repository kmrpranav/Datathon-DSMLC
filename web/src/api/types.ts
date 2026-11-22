/** Mirrors backend/src/types/api.ts. Column-shaped data keeps the real column names. */
export type Scalar = string | number | boolean | null
export type DataRow = Record<string, unknown>
export interface ColumnInfo { name: string; type: string }
export type FieldMap = Partial<Record<string, string>>

export interface HealthResponse {
  status: 'ok' | 'degraded'
  dataSource: { kind: 'csv' | 'databricks'; ok: boolean; tables?: Record<string, { available: boolean; source?: string; rows?: number; error?: string }> }
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
  source?: 'csv' | 'databricks'
  /** Catalog tables the active source doesn't have (shown as unavailable, never synthesized). */
  unavailable?: string[]
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
  source?: 'csv' | 'databricks'
  tables?: string[]
  unavailable?: string[]
  attributes: DataRow
  performance: { available: boolean; classColumn: string | null; latest: DataRow | null; records: DataRow[]; recordCount: number }
  pairs: { available: boolean; asInjector: DataRow[]; asProducer: DataRow[]; fields: FieldMap; notice: string }
  conversion: { ranking: DataRow[]; economics: DataRow[]; notice: string }
  producerFeatures: DataRow | null
  generatedAt: string
}

export interface SimulationStatus { liveInference: boolean; message: string }

/** GET /api/analytics — one well-level dataset the Analytics page filters client-side. */
export interface MetricInfo { column: string; file: string; label: string; unit: string; kind: string; note: string }
export type MetricKey =
  | 'totalOilM3' | 'totalInjM3' | 'oilRate13w' | 'waterCut4w' | 'uptime4w' | 'activeInjectorsNearby' | 'areaPercentile'
  | 'netOil4w' | 'extraOil4w' | 'ownOilLost4w' | 'water4w' | 'oilPerM3Water'
  | 'expectedProfitCad' | 'p10ProfitCad' | 'p90ProfitCad' | 'chanceOfProfit' | 'breakevenPriceBbl'

export interface AnalyticsWell {
  uwi: string
  wellName: string | null
  area: string | null
  hasCoordinates: boolean
  hasProduced: boolean | null
  hasInjected: boolean | null
  dualRole: boolean
  currentRole: 'injection' | 'production' | 'unknown'
  totalOilM3: number | null
  totalInjM3: number | null
  onProductionDate: string | null
  firstInjectionDate: string | null
  performance: null | {
    class: string | null
    week: string | null
    oilRate13w: number | null
    waterCut4w: number | null
    uptime4w: number | null
    activeInjectorsNearby: number | null
    areaPercentile: number | null
  }
  conversionRank: number | null
}

export interface AnalyticsCandidate {
  uwi: string
  rank: number | null
  neighbours: number | null
  extraOil4w: number | null
  water4w: number | null
  ownOilLost4w: number | null
  netOil4w: number | null
  oilPerM3Water: number | null
  economics: null | {
    rank: number | null
    expectedProfitCad: number | null
    p10ProfitCad: number | null
    p90ProfitCad: number | null
    chanceOfProfit: number | null
    breakevenPriceBbl: number | null
  }
}

export interface AnalyticsResponse {
  source: 'csv' | 'databricks'
  generatedAt: string
  files: string[]
  snapshotWeek: string | null
  metrics: Record<MetricKey, MetricInfo>
  wells: AnalyticsWell[]
  candidates: AnalyticsCandidate[]
  quality: {
    masterRows: number
    uniqueWells: number
    duplicateWells: number
    performanceDuplicateWells: number
    withoutCoordinates: number
    withoutPerformance: number
    candidatesNotInMaster: number
    candidatesWithEconomics: number
    missingColumns: string[]
  }
  unavailable: string[]
  notices: { model: string; economics: string; ranking: string; proximity: string }
}
