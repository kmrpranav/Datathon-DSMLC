/**
 * Well-level dataset for the Analytics page, built from the CSV exports.
 *
 * Column names below were read from the actual files (wells.csv,
 * performance.csv, conversion_ranking.csv, conversion_economics.csv). Units
 * were checked against daily_production.parquet:
 * - total_oil_m3 / total_inj_m3 equal the summed daily oil / injection volume
 *   for most wells over the export period (Jan 2021 – Oct 2026) → cumulative m³.
 * - oil_rate_13w ≈ the mean daily oil volume over the 13 weeks to `week` → m³/d.
 * A column missing from a file comes back as `null` and is listed in
 * `missingColumns`; nothing is filled in.
 */
import type { CsvRow, CsvValue } from './parse.js'

export const ANALYTICS_COLUMNS = {
  wells: ['uwi', 'well_name', 'area', 'lat', 'lon', 'on_production_date', 'total_oil_m3', 'total_inj_m3', 'first_injection_date', 'is_injector', 'is_producer'],
  performance: ['uwi', 'area', 'week', 'oil_rate_13w', 'water_cut_4w', 'uptime_4w', 'active_injectors_nearby', 'area_percentile', 'performance_class'],
  ranking: ['candidate', 'neighbours', 'extra_oil_4w', 'water_4w', 'own_oil_lost_4w', 'net_oil_4w', 'oil_per_m3_water', 'rank'],
  economics: ['rank', 'candidate', 'neighbours', 'net_oil_4w', 'oil_per_m3_water', 'expected_profit_cad', 'p10_profit_cad', 'p90_profit_cad', 'chance_of_profit', 'breakeven_price_bbl'],
} as const

/** Labels, units and meaning for every metric the page charts. */
export const METRICS = {
  totalOilM3: { column: 'total_oil_m3', file: 'wells.csv', label: 'Cumulative oil produced', unit: 'm³', kind: 'historical total', note: 'Total over the export period (Jan 2021 – Oct 2026), as exported.' },
  totalInjM3: { column: 'total_inj_m3', file: 'wells.csv', label: 'Cumulative injection volume', unit: 'm³', kind: 'historical total', note: 'Total over the export period (Jan 2021 – Oct 2026), as exported.' },
  oilRate13w: { column: 'oil_rate_13w', file: 'performance.csv', label: 'Average oil rate, last 13 weeks', unit: 'm³/d', kind: '13-week average daily rate', note: 'Average daily oil over the 13 weeks to the snapshot week.' },
  waterCut4w: { column: 'water_cut_4w', file: 'performance.csv', label: 'Water cut, last 4 weeks', unit: 'fraction', kind: '4-week ratio', note: 'Share of produced liquid that is water (0–1).' },
  uptime4w: { column: 'uptime_4w', file: 'performance.csv', label: 'Uptime, last 4 weeks', unit: 'fraction', kind: '4-week ratio', note: 'Share of time on production (0–1).' },
  activeInjectorsNearby: { column: 'active_injectors_nearby', file: 'performance.csv', label: 'Active injectors nearby', unit: 'wells', kind: 'count at snapshot', note: 'Count of nearby active injectors in the saved table. Proximity only — not confirmed hydraulic connectivity.' },
  areaPercentile: { column: 'area_percentile', file: 'performance.csv', label: 'Percentile within area', unit: 'fraction', kind: 'rank within operating area', note: 'Position of the well within its operating area (0–1).' },
  netOil4w: { column: 'net_oil_4w', file: 'conversion_ranking.csv', label: 'Modelled net oil gain, 4 weeks', unit: 'm³', kind: 'model estimate', note: 'Extra oil at neighbours minus the candidate’s own lost oil, over 4 weeks. Model output, not observed.' },
  extraOil4w: { column: 'extra_oil_4w', file: 'conversion_ranking.csv', label: 'Modelled extra oil at neighbours, 4 weeks', unit: 'm³', kind: 'model estimate', note: 'Model output, not observed.' },
  ownOilLost4w: { column: 'own_oil_lost_4w', file: 'conversion_ranking.csv', label: 'Candidate’s own oil given up, 4 weeks', unit: 'm³', kind: 'model estimate', note: 'Model output, not observed.' },
  water4w: { column: 'water_4w', file: 'conversion_ranking.csv', label: 'Assumed injected water, 4 weeks', unit: 'm³', kind: 'model assumption', note: 'Injection volume assumed by the model.' },
  oilPerM3Water: { column: 'oil_per_m3_water', file: 'conversion_ranking.csv', label: 'Modelled net oil per m³ injected water', unit: 'm³/m³', kind: 'model estimate (ranking metric)', note: 'Net oil gain ÷ assumed water. The saved rank follows this value, highest first.' },
  expectedProfitCad: { column: 'expected_profit_cad', file: 'conversion_economics.csv', label: 'Expected profit', unit: 'CAD', kind: 'hypothetical projection', note: 'Model projection, not a guaranteed or realized benefit.' },
  p10ProfitCad: { column: 'p10_profit_cad', file: 'conversion_economics.csv', label: 'P10 profit (low case)', unit: 'CAD', kind: 'hypothetical projection', note: '10th-percentile outcome of the saved model.' },
  p90ProfitCad: { column: 'p90_profit_cad', file: 'conversion_economics.csv', label: 'P90 profit (high case)', unit: 'CAD', kind: 'hypothetical projection', note: '90th-percentile outcome of the saved model.' },
  chanceOfProfit: { column: 'chance_of_profit', file: 'conversion_economics.csv', label: 'Chance of profit', unit: 'probability', kind: 'model estimate', note: 'Model-estimated probability that the conversion is profitable.' },
  breakevenPriceBbl: { column: 'breakeven_price_bbl', file: 'conversion_economics.csv', label: 'Breakeven oil price', unit: 'per bbl', kind: 'model estimate', note: 'Oil price at which the projected conversion breaks even (currency as exported).' },
} as const

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
  /** Present only for candidates that have a row in conversion_economics.csv. */
  economics: null | {
    rank: number | null
    expectedProfitCad: number | null
    p10ProfitCad: number | null
    p90ProfitCad: number | null
    chanceOfProfit: number | null
    breakevenPriceBbl: number | null
  }
}

export const n = (v: CsvValue | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const s = (v: CsvValue | undefined): string | null => (v === null || v === undefined || v === '' ? null : String(v))
export const b = (v: CsvValue | undefined): boolean | null => (typeof v === 'boolean' ? v : null)

export function candidateFrom(r: CsvRow, e: CsvRow | undefined): AnalyticsCandidate {
  return {
    uwi: String(r.candidate),
    rank: n(r.rank),
    neighbours: n(r.neighbours),
    extraOil4w: n(r.extra_oil_4w),
    water4w: n(r.water_4w),
    ownOilLost4w: n(r.own_oil_lost_4w),
    netOil4w: n(r.net_oil_4w),
    oilPerM3Water: n(r.oil_per_m3_water),
    economics: e
      ? {
          rank: n(e.rank),
          expectedProfitCad: n(e.expected_profit_cad),
          p10ProfitCad: n(e.p10_profit_cad),
          p90ProfitCad: n(e.p90_profit_cad),
          chanceOfProfit: n(e.chance_of_profit),
          breakevenPriceBbl: n(e.breakeven_price_bbl),
        }
      : null,
  }
}
