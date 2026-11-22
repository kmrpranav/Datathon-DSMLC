/**
 * Data contract for well features consumed by the frontend.
 *
 * Primary source: `GET /api/wells` (backend → Databricks bushra_well_master +
 * bushra_well_performance). Fallback: `public/data/wells.geojson`, built from
 * daily_production.parquet by `scripts/build_wells_geojson.py`.
 */
export type WellType = 'injection' | 'production' | 'unknown'
export type ProvinceCode = 'AB' | 'SK' | 'BC'
export type WellSource = 'databricks' | 'static'
export type Scalar = string | number | boolean | null

export interface WellRoles {
  currentRole: WellType
  currentRoleSource: 'flowDirection' | 'status' | 'wellType' | null
  /** `null` = the source has no evidence either way. */
  hasProducedHistorically: boolean | null
  hasInjectedHistorically: boolean | null
  /** Evidence of both producing and injecting at some point. */
  dualRole: boolean
}

export interface WellProperties {
  uwi: string
  formattedUwi: string | null
  wellName: string | null
  province: string | null
  operatingArea: string | null
  /** Current classification (latest flow direction / status). */
  wellType: WellType
  flowDirection: string | null
  /** Latest recorded status. */
  status: string | null
  roles: WellRoles
  /** Existing Good / Moderate / Low label from bushra_well_performance (API only). */
  performanceClass: string | null
  /** Latest performance-table columns, keyed by real column name (API only). */
  metrics: Record<string, Scalar>
  performanceRecordCount?: number

  // Local snapshot only (daily_production.parquet); undefined when served by the API.
  statusDate?: string | null
  latestOilM3?: number | null
  latestOilDate?: string | null
  latestWaterProducedM3?: number | null
  latestWaterProducedDate?: string | null
  latestGasE3m3?: number | null
  latestGasDate?: string | null
  latestInjectedWaterM3?: number | null
  latestInjectedWaterDate?: string | null
  firstRecordDate?: string | null
  lastRecordDate?: string | null
  recordCount?: number
}

export interface Well extends WellProperties {
  id: number
  longitude: number
  latitude: number
}

export interface WellsMetadata {
  source?: string
  tables?: string[]
  generatedAt?: string
  total?: number
  excluded?: { invalidCoordinates: number }
  duplicates?: { masterWellsWithMultipleRows: number; performanceWellsWithMultipleRows: number; dedupeOrder: { master: string; performance: string } }
  metricColumns?: Array<{ name: string; type: string }>
  performanceClasses?: string[]
  warnings?: string[]
  featureCount?: number
  skippedNoCoordinates?: number
}

export interface WellFeatureCollection {
  type: 'FeatureCollection'
  metadata?: WellsMetadata
  features: Array<{
    type: 'Feature'
    id: number
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: Partial<WellProperties> & Pick<WellProperties, 'uwi' | 'wellType'>
  }>
}

export interface WellFilters {
  province: 'all' | string
  operatingArea: 'all' | string
  wellType: 'all' | WellType | 'dual'
  performance: 'all' | string
  search: string
}

export const DEFAULT_WELL_FILTERS: WellFilters = {
  province: 'all',
  operatingArea: 'all',
  wellType: 'all',
  performance: 'all',
  search: '',
}
