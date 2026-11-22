/**
 * Performance classes, injector–producer pairs, conversion ranking and
 * economics. All read-only; ML outputs are passed through, never regenerated.
 */
import type { SqlExecutor } from '../services/databricks.js'
import type { TtlCache } from '../services/cache.js'
import { Catalog, quoteIdent as q, requireField, type TableKey } from './catalog.js'
import type { TableReader } from './tableQuery.js'
import { economicsSpec, pairsSpec, performanceSpec, rankingSpec } from '../data/querySpecs.js'
import type { EconomicsQuery, PairsQuery, PerformanceQuery, RankingQuery } from '../data/source.js'
import { DatabricksError } from '../lib/errors.js'
import { classOrder, MODEL_NOTICE, PAIRS_NOTICE, summarizeWells, type WellsRepository } from './wells.js'

export interface PageInput {
  limit: number
  offset: number
  sort?: string
  dir?: 'asc' | 'desc'
}

export class AnalyticsRepository {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly catalog: Catalog,
    private readonly cache: TtlCache,
    private readonly reader: TableReader,
    private readonly wells: WellsRepository,
  ) {}

  /** Existing Good / Moderate / Low labels — counts via SQL GROUP BY. */
  async performanceSummary() {
    const { value, cached } = await this.cache.getOrLoad('performance:summary', async () => {
      const s = await this.catalog.schema('wellPerformance')
      const cls = requireField(s, 'performanceClass')
      const uwi = s.fields.uwi
      const res = await this.sql.query<{ cls: string | null; wells: number; rows: number }>(
        `SELECT CAST(${q(cls)} AS STRING) AS cls, ${uwi ? `COUNT(DISTINCT ${q(uwi)})` : 'COUNT(*)'} AS wells, COUNT(*) AS rows
         FROM ${s.fqtn} GROUP BY 1`,
        [],
        { label: 'performance.summary' },
      )
      const totals = await this.sql.query<{ rows: number; wells: number }>(
        `SELECT COUNT(*) AS rows, ${uwi ? `COUNT(DISTINCT ${q(uwi)})` : 'COUNT(*)'} AS wells FROM ${s.fqtn}`,
        [],
        { label: 'performance.totals' },
      )
      const byClass = res.rows
        .map((r) => ({ class: r.cls ?? 'Not classified', wells: Number(r.wells), rows: Number(r.rows) }))
        .sort((a, b) => classOrder(a.class, b.class))
      const t = totals.rows[0] ?? { rows: 0, wells: 0 }
      return {
        table: s.table,
        classColumn: cls,
        totalRows: Number(t.rows),
        totalWells: Number(t.wells),
        multipleRowsPerWell: Number(t.rows) > Number(t.wells),
        byClass,
        generatedAt: new Date().toISOString(),
      }
    })
    return { ...value, cached }
  }

  performanceRows(f: PerformanceQuery) {
    return this.reader.read('wellPerformance', performanceSpec(f))
  }

  pairs(f: PairsQuery) {
    return this.reader.read('pairs', pairsSpec(f), PAIRS_NOTICE)
  }

  conversionRanking(f: RankingQuery) {
    return this.reader.read('conversionRanking', rankingSpec(f), MODEL_NOTICE)
  }

  async conversionEconomics(f: EconomicsQuery) {
    const rows = await this.reader.read('conversionEconomics', economicsSpec(f), `${MODEL_NOTICE} Scenario assumptions are shown exactly as saved in the table.`)
    const scenarios = await this.distinct('conversionEconomics', 'scenario')
    return { ...rows, scenarios }
  }

  /** Distinct values of a resolved field (for filter dropdowns). */
  private async distinct(key: TableKey, field: 'scenario' | 'operatingArea') {
    const s = await this.catalog.schema(key)
    const col = s.fields[field]
    if (!col) return []
    const { value } = await this.cache.getOrLoad(`distinct:${key}:${field}`, () =>
      this.sql.query<{ v: string }>(`SELECT DISTINCT CAST(${q(col)} AS STRING) AS v FROM ${s.fqtn} WHERE ${q(col)} IS NOT NULL ORDER BY 1 LIMIT 200`, [], { label: `distinct.${key}` }),
    )
    return value.rows.map((r) => r.v)
  }

  /** Overview KPIs. Table-level numbers are SQL aggregates; role counts reuse the cached de-duplicated well set so they match the map. */
  async overview() {
    const { value, cached } = await this.cache.getOrLoad('overview', async () => {
      const warnings: string[] = []
      const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
        try {
          return await fn()
        } catch (e) {
          // Connection-level failures should fail the request, not hide as empty sections.
          if (e instanceof DatabricksError && ['AUTH', 'NETWORK', 'NOT_CONFIGURED', 'TIMEOUT'].includes(e.code)) throw e
          warnings.push(`${label}: ${e instanceof Error ? e.message : 'unavailable'}`)
          return null
        }
      }
      const count = async (key: TableKey) => {
        const s = await this.catalog.schema(key)
        const uwi = s.fields.uwi
        const r = await this.sql.query<{ rows: number; wells: number | null }>(
          `SELECT COUNT(*) AS rows, ${uwi ? `COUNT(DISTINCT ${q(uwi)})` : 'NULL'} AS wells FROM ${s.fqtn}`,
          [],
          { label: `overview.count.${key}` },
        )
        return { table: s.table, rows: Number(r.rows[0]?.rows ?? 0), distinctWells: r.rows[0]?.wells == null ? null : Number(r.rows[0].wells) }
      }

      const [wellsData, master, performance, pairs, ranking, economics, scenarios] = await Promise.all([
        safe('wells', () => this.wells.dataset()),
        safe('bushra_well_master', () => count('wellMaster')),
        safe('bushra_well_performance', () => this.performanceSummary()),
        safe('bushra_injector_producer_pairs', async () => {
          const s = await this.catalog.schema('pairs')
          const inj = s.fields.injectorUwi
          const prod = s.fields.producerUwi
          const dist = s.fields.distance
          const r = await this.sql.query<Record<string, number | null>>(
            `SELECT COUNT(*) AS pairs,
              ${inj ? `COUNT(DISTINCT ${q(inj)})` : 'NULL'} AS injectors,
              ${prod ? `COUNT(DISTINCT ${q(prod)})` : 'NULL'} AS producers,
              ${dist ? `percentile_approx(${q(dist)}, 0.5)` : 'NULL'} AS median_distance
             FROM ${s.fqtn}`,
            [],
            { label: 'overview.pairs' },
          )
          const row = r.rows[0] ?? {}
          return { table: s.table, pairs: Number(row.pairs ?? 0), injectors: row.injectors, producers: row.producers, medianDistance: row.median_distance, distanceColumn: dist ?? null, notice: PAIRS_NOTICE }
        }),
        safe('bushra_conversion_ranking', () => count('conversionRanking')),
        safe('bushra_conversion_economics', () => count('conversionEconomics')),
        safe('economics scenarios', () => this.distinct('conversionEconomics', 'scenario')),
      ])

      const wells = wellsData ? summarizeWells(wellsData.data) : null

      return {
        source: 'databricks' as const,
        generatedAt: new Date().toISOString(),
        wells: wells && master ? { totalUnique: master.distinctWells ?? wells.mapped, masterRows: master.rows, ...wells } : wells,
        performance,
        pairs,
        conversion: ranking ? { table: ranking.table, candidates: ranking.rows, distinctWells: ranking.distinctWells, notice: MODEL_NOTICE } : null,
        economics: economics ? { table: economics.table, rows: economics.rows, distinctWells: economics.distinctWells, scenarios: scenarios ?? [], notice: MODEL_NOTICE } : null,
        warnings,
      }
    })
    return { ...value, cached }
  }
}
