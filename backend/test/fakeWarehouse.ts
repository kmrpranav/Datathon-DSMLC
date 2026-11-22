/** In-memory stand-in for Databricks: answers by query label with canned rows. */
import type { QueryOptions, QueryResult, Row, SqlExecutor, SqlParam } from '../src/services/databricks.js'
import { DatabricksError } from '../src/lib/errors.js'

export const MASTER_COLS = [
  ['uwi', 'STRING'], ['well_name', 'STRING'], ['field_operating_area', 'STRING'], ['province', 'STRING'],
  ['surface_latitude', 'DOUBLE'], ['surface_longitude', 'DOUBLE'], ['well_status', 'STRING'],
] as const
export const PERF_COLS = [['uwi', 'STRING'], ['performance_class', 'STRING'], ['cum_oil_m3', 'DOUBLE'], ['cum_injected_water_m3', 'DOUBLE'], ['as_of_date', 'DATE']] as const
const RANK_COLS = [['uwi', 'STRING'], ['rank', 'INT'], ['conversion_score', 'DOUBLE']] as const
const ECON_COLS = [['uwi', 'STRING'], ['scenario', 'STRING'], ['npv_cad', 'DOUBLE'], ['oil_price_usd', 'DOUBLE']] as const
const PAIR_COLS = [['injector_uwi', 'STRING'], ['producer_uwi', 'STRING'], ['distance_m', 'DOUBLE']] as const

const describeRows = (cols: readonly (readonly [string, string])[]) => cols.map(([col_name, data_type]) => ({ col_name, data_type: data_type.toLowerCase(), comment: null }))

// master: [uwi, name, area, prov, lat, lon, status] + perf: [uwi, class, oil, inj, date] + counts
const WELLS: unknown[][] = [
  ['W1', 'Alpha 1', 'North', 'AB', 52.1, -113.5, 'Producing', 'W1', 'Good', 5000, 0, '2024-06-01', 1, 1],
  ['W2', 'Bravo 2', 'North', 'AB', 52.2, -113.6, 'Injecting', 'W2', 'Low', 800, 12000, '2024-06-01', 1, 3],
  ['W3', 'Bad coords', 'South', 'SK', 0, 0, 'Producing', 'W3', 'Moderate', 10, 0, '2024-06-01', 1, 1],
  ['W4', null, 'South', 'SK', 50.5, -108.1, null, null, null, null, null, null, 2, null],
]

export class FakeWarehouse implements SqlExecutor {
  calls: Array<{ sql: string; params: SqlParam[]; label?: string }> = []
  constructor(private readonly missing: string[] = []) {}

  async query<T extends Row = Row>(sql: string, params: SqlParam[] = [], opts: QueryOptions = {}): Promise<QueryResult<T>> {
    this.calls.push({ sql, params, label: opts.label })
    const rows = this.answer(sql, params, opts.label ?? '')
    return { statementId: 'fake', columns: [], rows: rows as T[], rowCount: rows.length, truncated: false }
  }

  private answer(sql: string, params: SqlParam[], label: string): Row[] {
    const d = /^DESCRIBE TABLE .*`(\w+)`$/.exec(sql)
    if (d) {
      const t = d[1]
      if (this.missing.includes(t)) throw new DatabricksError('TABLE_NOT_FOUND', 'Statement failed')
      const cols = { bushra_well_master: MASTER_COLS, bushra_well_performance: PERF_COLS, bushra_conversion_ranking: RANK_COLS, bushra_conversion_economics: ECON_COLS, bushra_injector_producer_pairs: PAIR_COLS }[t]
      if (!cols) throw new DatabricksError('TABLE_NOT_FOUND', 'Statement failed')
      return [...describeRows(cols), { col_name: '', data_type: '', comment: null }, { col_name: '# Partition Information', data_type: '', comment: null }]
    }
    const uwi = params.find((p) => p.name === 'uwi')?.value
    switch (label) {
      case 'wells.dataset':
        return WELLS.map((w) => {
          const r: Row = {}
          MASTER_COLS.forEach((_, i) => (r[`m_${i}`] = w[i]))
          PERF_COLS.forEach((_, i) => (r[`p_${i}`] = w[7 + i]))
          r.__mn = w[12]
          r.__pn = w[13]
          return r
        })
      case 'wells.detail.wellMaster':
        return WELLS.filter((w) => w[0] === uwi).map((w) => Object.fromEntries(MASTER_COLS.map(([c], i) => [c, w[i]])))
      case 'wells.detail.wellPerformance':
        return WELLS.filter((w) => w[7] === uwi).map((w) => Object.fromEntries(PERF_COLS.map(([c], i) => [c, w[7 + i]])))
      case 'wells.detail.pairs':
        return [{ injector_uwi: 'W2', producer_uwi: 'W1', distance_m: 410 }].filter((p) => p.injector_uwi === uwi || p.producer_uwi === uwi)
      case 'performance.summary':
        return [{ cls: 'Low', wells: 1, rows: 3 }, { cls: 'Good', wells: 1, rows: 1 }, { cls: 'Moderate', wells: 1, rows: 1 }]
      case 'performance.totals':
        return [{ rows: 5, wells: 3 }]
      case 'rows.conversionRanking':
        return [{ uwi: 'W1', rank: 1, conversion_score: 0.91, __total: 2 }, { uwi: 'W3', rank: 2, conversion_score: 0.55, __total: 2 }]
      case 'rows.conversionEconomics':
        return [{ uwi: 'W1', scenario: 'Base', npv_cad: 125000, oil_price_usd: 75, __total: 1 }]
      case 'distinct.conversionEconomics':
        return [{ v: 'Base' }, { v: 'High price' }]
      case 'rows.pairs':
        return [{ injector_uwi: 'W2', producer_uwi: 'W1', distance_m: 410, __total: 1 }]
      case 'rows.wellPerformance':
        return [{ uwi: 'W1', performance_class: 'Good', cum_oil_m3: 5000, cum_injected_water_m3: 0, as_of_date: '2024-06-01', __total: 1 }]
      case 'overview.count.wellMaster':
        return [{ rows: 5, wells: 4 }]
      case 'overview.count.conversionRanking':
        return [{ rows: 2, wells: 2 }]
      case 'overview.count.conversionEconomics':
        return [{ rows: 1, wells: 1 }]
      case 'overview.pairs':
        return [{ pairs: 1, injectors: 1, producers: 1, median_distance: 410 }]
      default:
        return []
    }
  }
}
