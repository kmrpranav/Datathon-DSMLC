/**
 * `DataSource` backed by the CSV files exported from Databricks.
 *
 * - Files are read lazily, parsed once, and re-parsed only when their
 *   modification time changes. The originals are only ever read.
 * - Column types are inferred from the data (see parse.ts); logical fields are
 *   resolved with the same candidate lists as the Databricks tables.
 * - Tables without an exported file (injector–producer pairs, producer
 *   features) are reported as unavailable, never synthesized.
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { resolveFields, requireField, TABLES, type TableKey, type TableSchema } from '../../repositories/catalog.js'
import { buildWellsDataset, classOrder, filterFeatures, summarizeWells, PAIRS_NOTICE, type JoinedWellRow, type WellsDataset } from '../../repositories/wells.js'
import { AppError, notFound } from '../../lib/errors.js'
import type { TableQuery } from '../../repositories/tableQuery.js'
import type { TableRowsResponse, WellsResponse } from '../../types/api.js'
import { parseCsv, type CsvRow } from './parse.js'
import { queryRows } from './memoryQuery.js'
import { economicsSpec, pairsSpec, performanceSpec, rankingSpec } from '../querySpecs.js'
import type { DataSource, DataSourceHealth } from '../source.js'
import { classifyWell } from '../../lib/classify.js'
import { ANALYTICS_COLUMNS, METRICS, b, candidateFrom, n, s as str, type AnalyticsWell } from './analyticsDataset.js'
import { validCoordinate } from '../../repositories/wells.js'

/** Exported file for each Catalog table. Tables not listed here were not exported. */
export const CSV_FILES: Partial<Record<TableKey, string>> = {
  wellMaster: 'wells.csv',
  wellPerformance: 'performance.csv',
  conversionRanking: 'conversion_ranking.csv',
  conversionEconomics: 'conversion_economics.csv',
}

export const CSV_MODEL_NOTICE =
  "Rankings and economics are model-generated estimates exported from the team's Databricks tables. They are not live inference and not verified realized savings or profits."

interface LoadedTable {
  schema: TableSchema
  rows: CsvRow[]
  malformedRows: number
  mtimeMs: number
}

export class CsvDataSource implements DataSource {
  readonly kind = 'csv' as const
  private readonly tables = new Map<TableKey, LoadedTable>()
  private readonly inflight = new Map<TableKey, Promise<LoadedTable>>()
  private datasetCache: { key: string; data: WellsDataset } | null = null

  constructor(private readonly dir: string) {}

  // ---------- loading ----------

  private unavailable(key: TableKey): never {
    throw new AppError(
      404,
      'DATASET_NOT_AVAILABLE',
      `${TABLES[key]} is not included in the local CSV export, so this data isn't available. Nothing is generated in its place.`,
      { table: TABLES[key] },
    )
  }

  /** Parsed table, re-read only when the file changes. */
  private async table(key: TableKey): Promise<LoadedTable> {
    const file = CSV_FILES[key]
    if (!file) this.unavailable(key)
    const full = path.join(this.dir, file)
    let mtimeMs: number
    try {
      mtimeMs = (await stat(full)).mtimeMs
    } catch {
      throw new AppError(503, 'DATA_FILE_MISSING', `${file} was not found in the CSV data folder. Check CSV_DATA_DIR in backend/.env.`, { file })
    }
    const cached = this.tables.get(key)
    if (cached && cached.mtimeMs === mtimeMs) return cached
    const pending = this.inflight.get(key)
    if (pending) return pending
    const load = (async () => {
      const parsed = parseCsv(await readFile(full, 'utf8'))
      const schema = { ...resolveFields(key, file, parsed.columns), table: file }
      const t: LoadedTable = { schema, rows: parsed.rows, malformedRows: parsed.malformedRows, mtimeMs }
      this.tables.set(key, t)
      return t
    })().finally(() => this.inflight.delete(key))
    this.inflight.set(key, load)
    return load
  }

  private async tryTable(key: TableKey) {
    try {
      return await this.table(key)
    } catch (e) {
      if (e instanceof AppError && (e.code === 'DATASET_NOT_AVAILABLE' || e.code === 'DATA_FILE_MISSING')) return null
      throw e
    }
  }

  /** One row per UWI: latest by record-date column when present, else the first occurrence. Returns kept rows + per-UWI counts. */
  private dedupe(t: LoadedTable) {
    const uwi = requireField(t.schema, 'uwi')
    const date = t.schema.fields.recordDate
    const kept = new Map<string, CsvRow>()
    const counts = new Map<string, number>()
    for (const r of t.rows) {
      if (r[uwi] === null) continue
      const id = String(r[uwi])
      counts.set(id, (counts.get(id) ?? 0) + 1)
      const prev = kept.get(id)
      if (!prev || (date && r[date] !== null && (prev[date] === null || String(r[date]) > String(prev[date])))) kept.set(id, r)
    }
    return { kept, counts, order: date ? `${date} desc (latest row kept)` : 'first row in file kept' }
  }

  private async dataset(): Promise<{ data: WellsDataset; cached: boolean }> {
    const master = await this.table('wellMaster')
    const perf = await this.tryTable('wellPerformance')
    const cacheKey = `${master.mtimeMs}:${perf?.mtimeMs ?? 'none'}`
    if (this.datasetCache?.key === cacheKey) return { data: this.datasetCache.data, cached: true }

    requireField(master.schema, 'latitude')
    requireField(master.schema, 'longitude')
    const warnings: string[] = []
    const m = this.dedupe(master)
    let p: ReturnType<CsvDataSource['dedupe']> | null = null
    if (!perf) warnings.push(`${CSV_FILES.wellPerformance} was not found; performance classes are unavailable.`)
    else if (!perf.schema.fields.uwi) warnings.push(`No UWI column in ${perf.schema.table}; it was not joined.`)
    else p = this.dedupe(perf)
    for (const t of [master, perf]) if (t?.malformedRows) warnings.push(`${t.malformedRows} malformed line(s) skipped in ${t.schema.table}.`)

    const rows: JoinedWellRow[] = [...m.kept].map(([id, row]) => {
      const pr = p?.kept.get(id) ?? null
      return { m: row, p: pr, masterRows: m.counts.get(id) ?? 1, perfRows: pr ? (p!.counts.get(id) ?? 1) : 0 }
    })
    const data = buildWellsDataset({
      source: 'csv',
      tables: [master.schema.table, ...(p ? [perf!.schema.table] : [])],
      master: master.schema,
      perf: p ? perf!.schema : null,
      rows,
      dedupeOrder: { master: m.order, performance: p?.order ?? 'not joined' },
      warnings,
    })
    this.datasetCache = { key: cacheKey, data }
    return { data, cached: false }
  }

  private async read(key: TableKey, spec: TableQuery, notice?: string): Promise<TableRowsResponse> {
    const t = await this.table(key)
    const { rows, total, sort } = queryRows(t.schema, t.rows, spec)
    return {
      table: t.schema.table,
      columns: t.schema.columns,
      fields: t.schema.fields,
      rows,
      page: { limit: spec.limit, offset: spec.offset, total },
      sort,
      cached: true,
      generatedAt: new Date(t.mtimeMs).toISOString(),
      ...(notice ? { notice } : {}),
    }
  }

  // ---------- DataSource ----------

  async health(deep: boolean): Promise<DataSourceHealth> {
    const tables: NonNullable<DataSourceHealth['tables']> = {}
    for (const key of Object.keys(TABLES) as TableKey[]) {
      const file = CSV_FILES[key]
      if (!file) {
        tables[TABLES[key]] = { available: false, error: 'not included in the CSV export' }
        continue
      }
      try {
        if (deep) tables[TABLES[key]] = { available: true, source: file, rows: (await this.table(key)).rows.length }
        else {
          await stat(path.join(this.dir, file))
          tables[TABLES[key]] = { available: true, source: file }
        }
      } catch (e) {
        tables[TABLES[key]] = { available: false, source: file, error: e instanceof AppError ? e.code : 'UNREADABLE' }
      }
    }
    const ok = Object.values(CSV_FILES).every((f) => Object.values(tables).some((t) => t.source === f && t.available))
    return { kind: this.kind, ok, tables }
  }

  async schemaReport() {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(TABLES) as TableKey[]) {
      const t = await this.tryTable(key)
      out[TABLES[key]] = t
        ? { available: true, source: t.schema.table, rows: t.rows.length, columns: t.schema.columns, fields: t.schema.fields, unresolved: t.schema.unresolved }
        : { available: false, source: CSV_FILES[key] ?? null }
    }
    return { source: this.kind, tables: out }
  }

  async wells(filters: Parameters<DataSource['wells']>[0]): Promise<WellsResponse> {
    const { data, cached } = await this.dataset()
    const features = filterFeatures(data.features, filters)
    const applied = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>
    return { type: 'FeatureCollection', metadata: { ...data.metadata, cached, returned: features.length, filters: applied }, features }
  }

  async well(uwi: string) {
    const master = await this.table('wellMaster')
    const mUwi = requireField(master.schema, 'uwi')
    const attrs = master.rows.filter((r) => String(r[mUwi]) === uwi)
    if (!attrs.length) throw notFound(`Well ${uwi}`)

    const byUwi = async (key: TableKey) => {
      const t = await this.tryTable(key)
      const col = t?.schema.fields.uwi
      if (!t || !col) return null
      const rows = t.rows.filter((r) => String(r[col]) === uwi)
      const order = t.schema.fields.recordDate ?? t.schema.fields.rank
      if (order) rows.sort((a, b) => (t.schema.fields.recordDate ? String(b[order]).localeCompare(String(a[order])) : Number(a[order]) - Number(b[order])))
      return { schema: t.schema, rows }
    }
    const [perf, ranking, economics] = await Promise.all([byUwi('wellPerformance'), byUwi('conversionRanking'), byUwi('conversionEconomics')])
    const { data } = await this.dataset()
    const feature = data.features.find((f) => f.properties.uwi === uwi) ?? null

    return {
      uwi,
      source: this.kind,
      tables: [master.schema.table, perf?.schema.table, ranking?.schema.table, economics?.schema.table].filter(Boolean),
      well: feature?.properties ?? null,
      location: feature ? { longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] } : null,
      attributes: attrs[0],
      masterRowCount: attrs.length,
      performance: {
        available: Boolean(perf),
        classColumn: perf?.schema.fields.performanceClass ?? null,
        latest: perf?.rows[0] ?? null,
        records: perf?.rows ?? [],
        recordCount: perf?.rows.length ?? 0,
      },
      pairs: { available: false, asInjector: [], asProducer: [], fields: {}, notice: PAIRS_NOTICE },
      conversion: { ranking: ranking?.rows ?? [], economics: economics?.rows ?? [], notice: CSV_MODEL_NOTICE },
      producerFeatures: null,
      unavailable: [TABLES.pairs, TABLES.producerFeatures],
      generatedAt: new Date().toISOString(),
    }
  }

  /** Every well (including those without coordinates) joined with its performance and conversion rows. */
  async analytics() {
    const master = await this.table('wellMaster')
    const [perf, ranking, economics] = await Promise.all([this.tryTable('wellPerformance'), this.tryTable('conversionRanking'), this.tryTable('conversionEconomics')])
    const missingColumns: string[] = []
    const check = (t: LoadedTable | null, cols: readonly string[]) => {
      if (!t) return
      const have = new Set(t.schema.columns.map((c) => c.name))
      for (const c of cols) if (!have.has(c)) missingColumns.push(`${t.schema.table}:${c}`)
    }
    check(master, ANALYTICS_COLUMNS.wells)
    check(perf, ANALYTICS_COLUMNS.performance)
    check(ranking, ANALYTICS_COLUMNS.ranking)
    check(economics, ANALYTICS_COLUMNS.economics)

    const m = this.dedupe(master)
    const p = perf?.schema.fields.uwi ? this.dedupe(perf) : null
    const rankBy = new Map<string, CsvRow>()
    for (const r of ranking?.rows ?? []) if (r.candidate !== null && r.candidate !== undefined) rankBy.set(String(r.candidate), rankBy.get(String(r.candidate)) ?? r)
    const econBy = new Map<string, CsvRow>()
    for (const r of economics?.rows ?? []) if (r.candidate !== null && r.candidate !== undefined) econBy.set(String(r.candidate), econBy.get(String(r.candidate)) ?? r)

    const wells: AnalyticsWell[] = [...m.kept].map(([uwi, r]) => {
      const roles = classifyWell({
        everProduced: r.is_producer, everInjected: r.is_injector, oilTotal: r.total_oil_m3, injectionTotal: r.total_inj_m3,
        productionStart: r.on_production_date, injectionStart: r.first_injection_date,
      })
      const pr = p?.kept.get(uwi)
      return {
        uwi,
        wellName: str(r.well_name),
        area: str(r.area),
        hasCoordinates: validCoordinate(n(r.lat), n(r.lon)),
        hasProduced: b(r.is_producer) ?? roles.hasProducedHistorically,
        hasInjected: b(r.is_injector) ?? roles.hasInjectedHistorically,
        dualRole: roles.dualRole,
        currentRole: roles.currentRole,
        totalOilM3: n(r.total_oil_m3),
        totalInjM3: n(r.total_inj_m3),
        onProductionDate: str(r.on_production_date),
        firstInjectionDate: str(r.first_injection_date),
        performance: pr
          ? {
              class: str(pr.performance_class),
              week: str(pr.week),
              oilRate13w: n(pr.oil_rate_13w),
              waterCut4w: n(pr.water_cut_4w),
              uptime4w: n(pr.uptime_4w),
              activeInjectorsNearby: n(pr.active_injectors_nearby),
              areaPercentile: n(pr.area_percentile),
            }
          : null,
        conversionRank: n(rankBy.get(uwi)?.rank),
      }
    })
    wells.sort((a, c) => a.uwi.localeCompare(c.uwi))
    const candidates = [...rankBy.values()].map((r) => candidateFrom(r, econBy.get(String(r.candidate)))).sort((a, c) => (a.rank ?? Infinity) - (c.rank ?? Infinity))
    const known = new Set(m.kept.keys())

    return {
      source: this.kind,
      generatedAt: new Date().toISOString(),
      files: [master, perf, ranking, economics].filter(Boolean).map((t) => t!.schema.table),
      snapshotWeek: wells.find((w) => w.performance?.week)?.performance?.week ?? null,
      metrics: METRICS,
      wells,
      candidates,
      quality: {
        masterRows: master.rows.length,
        uniqueWells: wells.length,
        duplicateWells: [...m.counts.values()].filter((c) => c > 1).length,
        performanceDuplicateWells: p ? [...p.counts.values()].filter((c) => c > 1).length : 0,
        withoutCoordinates: wells.filter((w) => !w.hasCoordinates).length,
        withoutPerformance: wells.filter((w) => !w.performance).length,
        candidatesNotInMaster: candidates.filter((c) => !known.has(c.uwi)).length,
        candidatesWithEconomics: candidates.filter((c) => c.economics).length,
        missingColumns,
      },
      unavailable: [TABLES.pairs, TABLES.producerFeatures],
      notices: {
        model: CSV_MODEL_NOTICE,
        economics: 'Economic values are hypothetical projections from the saved model (expected, P10 and P90 outcomes). They are not guaranteed or realized financial benefits.',
        ranking: 'The ranking orders wells by a modelled metric. It is a screening aid, not a proven optimal decision.',
        proximity: PAIRS_NOTICE,
      },
    }
  }

  async performanceSummary() {
    const t = await this.table('wellPerformance')
    const cls = requireField(t.schema, 'performanceClass')
    const uwi = t.schema.fields.uwi
    const groups = new Map<string, { rows: number; wells: Set<string> }>()
    const allWells = new Set<string>()
    for (const r of t.rows) {
      const k = r[cls] === null ? 'Not classified' : String(r[cls])
      const g = groups.get(k) ?? { rows: 0, wells: new Set<string>() }
      g.rows++
      const id = uwi ? String(r[uwi]) : String(g.rows)
      g.wells.add(id)
      allWells.add(id)
      groups.set(k, g)
    }
    return {
      table: t.schema.table,
      classColumn: cls,
      totalRows: t.rows.length,
      totalWells: uwi ? allWells.size : t.rows.length,
      multipleRowsPerWell: uwi ? t.rows.length > allWells.size : false,
      byClass: [...groups].map(([c, g]) => ({ class: c, wells: g.wells.size, rows: g.rows })).sort((a, b) => classOrder(a.class, b.class)),
      generatedAt: new Date(t.mtimeMs).toISOString(),
      cached: true,
    }
  }

  performanceRows: DataSource['performanceRows'] = (q) => this.read('wellPerformance', performanceSpec(q))
  pairs: DataSource['pairs'] = async (q) => this.read('pairs', pairsSpec(q), PAIRS_NOTICE) // throws DATASET_NOT_AVAILABLE
  conversionRanking: DataSource['conversionRanking'] = (q) => this.read('conversionRanking', rankingSpec(q), CSV_MODEL_NOTICE)

  conversionEconomics: DataSource['conversionEconomics'] = async (q) => {
    const rows = await this.read('conversionEconomics', economicsSpec(q), `${CSV_MODEL_NOTICE} Values are shown exactly as exported.`)
    const t = await this.table('conversionEconomics')
    const sc = t.schema.fields.scenario
    const scenarios = sc ? [...new Set(t.rows.map((r) => r[sc]).filter((v) => v !== null).map(String))].sort() : []
    return { ...rows, scenarios }
  }

  async overview() {
    const warnings: string[] = []
    const count = async (key: TableKey) => {
      const t = await this.tryTable(key)
      if (!t) {
        warnings.push(`${CSV_FILES[key]} was not found.`)
        return null
      }
      const uwi = t.schema.fields.uwi
      return { table: t.schema.table, rows: t.rows.length, distinctWells: uwi ? new Set(t.rows.map((r) => String(r[uwi]))).size : null }
    }
    const { data } = await this.dataset()
    const [master, ranking, economics] = await Promise.all([count('wellMaster'), count('conversionRanking'), count('conversionEconomics')])
    const performance = await this.performanceSummary().catch((e) => {
      warnings.push(`Performance: ${e instanceof Error ? e.message : 'unavailable'}`)
      return null
    })
    const econ = economics ? await this.conversionEconomics({ limit: 1, offset: 0 }) : null
    return {
      source: this.kind,
      generatedAt: new Date().toISOString(),
      cached: true,
      wells: { totalUnique: master?.distinctWells ?? data.features.length, masterRows: master?.rows, ...summarizeWells(data) },
      performance,
      pairs: null,
      conversion: ranking ? { table: ranking.table, candidates: ranking.rows, distinctWells: ranking.distinctWells, notice: CSV_MODEL_NOTICE } : null,
      economics: economics ? { table: economics.table, rows: economics.rows, distinctWells: economics.distinctWells, scenarios: econ?.scenarios ?? [], notice: CSV_MODEL_NOTICE } : null,
      unavailable: [TABLES.pairs, TABLES.producerFeatures],
      warnings,
    }
  }
}
