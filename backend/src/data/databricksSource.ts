/** `DataSource` backed by the existing Databricks repositories (unchanged behaviour). */
import type { AppConfig } from '../config/env.js'
import type { SqlExecutor } from '../services/databricks.js'
import { TABLES, type Catalog, type TableKey } from '../repositories/catalog.js'
import type { WellsRepository } from '../repositories/wells.js'
import type { AnalyticsRepository } from '../repositories/analytics.js'
import type { DataSource, DataSourceHealth } from './source.js'
import { AppError } from '../lib/errors.js'

export class DatabricksDataSource implements DataSource {
  readonly kind = 'databricks' as const

  constructor(
    private readonly config: AppConfig,
    private readonly sql: SqlExecutor,
    private readonly catalog: Catalog,
    private readonly wellsRepo: WellsRepository,
    private readonly analyticsRepo: AnalyticsRepository,
  ) {}

  async health(deep: boolean): Promise<DataSourceHealth> {
    const out: DataSourceHealth = { kind: this.kind, ok: this.config.configured }
    if (!deep || !this.config.configured) return out
    const t0 = Date.now()
    try {
      await this.sql.query('SELECT 1 AS ok', [], { label: 'health.ping', timeoutMs: 60_000 })
      out.connection = { ok: true, latencyMs: Date.now() - t0 }
      const tables: NonNullable<DataSourceHealth['tables']> = {}
      await Promise.all(
        (Object.keys(TABLES) as TableKey[]).map(async (k) => {
          tables[TABLES[k]] = { available: Boolean(await this.catalog.trySchema(k).catch(() => null)) }
        }),
      )
      out.tables = tables
    } catch (e) {
      out.ok = false
      out.connection = { ok: false, error: (e as { code?: string }).code ?? 'ERROR' }
    }
    return out
  }

  async schemaReport() {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(TABLES) as TableKey[]) {
      const schema = await this.catalog.trySchema(k)
      out[TABLES[k]] = schema
        ? { available: true, columns: schema.columns, fields: schema.fields, unresolved: schema.unresolved }
        : { available: false }
    }
    return { source: this.kind, catalog: this.config.databricks.catalog, schema: this.config.databricks.schema, tables: out }
  }

  wells: DataSource['wells'] = (f) => this.wellsRepo.list(f)
  well: DataSource['well'] = (uwi) => this.wellsRepo.detail(uwi)
  performanceSummary: DataSource['performanceSummary'] = () => this.analyticsRepo.performanceSummary()
  performanceRows: DataSource['performanceRows'] = (q) => this.analyticsRepo.performanceRows(q)
  pairs: DataSource['pairs'] = (q) => this.analyticsRepo.pairs(q)
  conversionRanking: DataSource['conversionRanking'] = (q) => this.analyticsRepo.conversionRanking(q)
  conversionEconomics: DataSource['conversionEconomics'] = (q) => this.analyticsRepo.conversionEconomics(q)
  overview: DataSource['overview'] = () => this.analyticsRepo.overview()
  analytics: DataSource['analytics'] = async () => {
    throw new AppError(501, 'NOT_IMPLEMENTED_FOR_SOURCE', 'The Analytics dataset is currently built from the CSV export only. Set DATA_SOURCE=csv.')
  }
}
