/**
 * Filter / search / default-sort rules per endpoint, expressed on logical
 * fields. Shared by the SQL reader (Databricks) and the in-memory reader (CSV)
 * so both sources answer the same query the same way.
 */
import type { TableQuery } from '../repositories/tableQuery.js'
import type { EconomicsQuery, PairsQuery, PerformanceQuery, RankingQuery } from './source.js'

export const performanceSpec = (f: PerformanceQuery): TableQuery => ({
  filters: [
    { field: 'performanceClass', value: f.class, ci: true },
    { field: 'operatingArea', value: f.area, ci: true },
  ],
  search: { value: f.search, fields: ['uwi', 'wellName'] },
  sort: f.sort,
  dir: f.dir,
  defaultSort: [{ field: 'uwi', dir: 'asc' }],
  limit: f.limit,
  offset: f.offset,
})

export const pairsSpec = (f: PairsQuery): TableQuery => ({
  filters: [
    { field: 'injectorUwi', value: f.injector },
    { field: 'producerUwi', value: f.producer },
    { field: 'operatingArea', value: f.area, ci: true },
    { field: 'distance', value: f.maxDistance, op: 'lte' },
  ],
  search: f.uwi ? { value: f.uwi, fields: ['injectorUwi', 'producerUwi'] } : undefined,
  sort: f.sort,
  dir: f.dir,
  defaultSort: [{ field: 'distance', dir: 'asc' }, { field: 'injectorUwi', dir: 'asc' }],
  limit: f.limit,
  offset: f.offset,
})

export const rankingSpec = (f: RankingQuery): TableQuery => ({
  filters: [
    { field: 'operatingArea', value: f.area, ci: true },
    { field: 'score', value: f.minScore, op: 'gte' },
  ],
  search: { value: f.search, fields: ['uwi', 'wellName'] },
  sort: f.sort,
  dir: f.dir,
  defaultSort: [{ field: 'rank', dir: 'asc' }, { field: 'score', dir: 'desc' }],
  limit: f.limit,
  offset: f.offset,
})

export const economicsSpec = (f: EconomicsQuery): TableQuery => ({
  filters: [
    { field: 'scenario', value: f.scenario, ci: true },
    { field: 'uwi', value: f.uwi },
  ],
  search: { value: f.search, fields: ['uwi', 'wellName'] },
  sort: f.sort,
  dir: f.dir,
  defaultSort: [{ field: 'rank', dir: 'asc' }, { field: 'score', dir: 'desc' }, { field: 'uwi', dir: 'asc' }],
  limit: f.limit,
  offset: f.offset,
})
