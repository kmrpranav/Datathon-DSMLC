import type { AppConfig } from '../config/env.js'
import { DatabricksClient, type SqlExecutor } from './databricks.js'
import { TtlCache } from './cache.js'
import { Catalog } from '../repositories/catalog.js'
import { WellsRepository } from '../repositories/wells.js'
import { TableReader } from '../repositories/tableQuery.js'
import { AnalyticsRepository } from '../repositories/analytics.js'
import { unconfiguredModelServing, type ModelServingClient } from './modelServing.js'
import { DatabricksError } from '../lib/errors.js'

/** Executor used when credentials are missing: every query fails with NOT_CONFIGURED. */
const notConfigured: SqlExecutor = {
  query: async () => {
    throw new DatabricksError('NOT_CONFIGURED', 'Databricks credentials are not configured')
  },
}

export interface Services {
  config: AppConfig
  sql: SqlExecutor
  cache: TtlCache
  catalog: Catalog
  wells: WellsRepository
  analytics: AnalyticsRepository
  modelServing: ModelServingClient
}

export function createServices(config: AppConfig, overrides: { sql?: SqlExecutor; modelServing?: ModelServingClient } = {}): Services {
  const sql = overrides.sql ?? (config.configured ? new DatabricksClient(config.databricks) : notConfigured)
  const cache = new TtlCache(config.cacheTtlMs)
  const catalog = new Catalog(sql, cache, { catalog: config.databricks.catalog, schema: config.databricks.schema })
  const wells = new WellsRepository(sql, catalog, cache)
  const reader = new TableReader(sql, catalog, cache)
  const analytics = new AnalyticsRepository(sql, catalog, cache, reader, wells)
  return { config, sql, cache, catalog, wells, analytics, modelServing: overrides.modelServing ?? unconfiguredModelServing }
}
