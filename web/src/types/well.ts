/**
 * Data contract for well features consumed by the frontend.
 *
 * Produced by `scripts/build_wells_geojson.py` (one feature per UWI from
 * daily_production.parquet). A future backend endpoint should return the same
 * GeoJSON FeatureCollection shape so components need no changes.
 */
export type WellType = 'injection' | 'production' | 'unknown'
export type ProvinceCode = 'AB' | 'SK' | 'BC'

export interface WellProperties {
  uwi: string
  formattedUwi: string | null
  wellName: string | null
  province: ProvinceCode | null
  operatingArea: string | null
  /** Derived from latest `flow_direction`, falling back to latest `well_daily_status`. */
  wellType: WellType
  flowDirection: 'injection' | 'production' | null
  /** Latest recorded `well_daily_status`. */
  status: string | null
  statusDate: string | null
  latestOilM3: number | null
  latestOilDate: string | null
  latestWaterProducedM3: number | null
  latestWaterProducedDate: string | null
  latestGasE3m3: number | null
  latestGasDate: string | null
  latestInjectedWaterM3: number | null
  latestInjectedWaterDate: string | null
  firstRecordDate: string | null
  lastRecordDate: string | null
  recordCount: number
}

export interface Well extends WellProperties {
  id: number
  longitude: number
  latitude: number
}

export interface WellFeatureCollection {
  type: 'FeatureCollection'
  metadata?: { source?: string; featureCount?: number; skippedNoCoordinates?: number }
  features: Array<{
    type: 'Feature'
    id: number
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: WellProperties
  }>
}

export interface WellFilters {
  province: 'all' | ProvinceCode
  operatingArea: 'all' | string
  wellType: 'all' | WellType
  search: string
}

export const DEFAULT_WELL_FILTERS: WellFilters = {
  province: 'all',
  operatingArea: 'all',
  wellType: 'all',
  search: '',
}
