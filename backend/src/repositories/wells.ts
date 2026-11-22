/**
 * Wells: bushra_well_master (location / identity) joined to
 * bushra_well_performance (Good / Moderate / Low class + metrics).
 *
 * Both tables are de-duplicated to one row per UWI *before* the join
 * (ROW_NUMBER over UWI, latest record date first when a date column exists),
 * so a well with several performance rows can't be duplicated on the map.
 */
import type { SqlExecutor, Row } from '../services/databricks.js'
import type { TtlCache } from '../services/cache.js'
import { Catalog, quoteIdent as q, requireField, type TableSchema, type TableKey } from './catalog.js'
import { classifyWell } from '../lib/classify.js'
import { notFound } from '../lib/errors.js'
import type { DataRow, Scalar, WellFeature, WellsMetadata, WellsResponse } from '../types/api.js'

export interface WellsDataset {
  features: WellFeature[]
  metadata: Omit<WellsMetadata, 'cached' | 'returned' | 'filters'>
}

export interface WellFilterInput {
  area?: string
  province?: string
  type?: 'injection' | 'production' | 'unknown' | 'dual'
  performance?: string
  search?: string
}

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
const scalar = (v: unknown): Scalar =>
  v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' ? v : JSON.stringify(v)

export function validCoordinate(lat: number | null, lon: number | null): lat is number {
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 && !(lat === 0 && lon === 0)
}

function dedupeCte(name: string, s: TableSchema, uwiCol: string) {
  const date = s.fields.recordDate
  const order = date ? `${q(date)} DESC NULLS LAST` : q(uwiCol)
  const sql = `${name} AS (
    SELECT *,
      ROW_NUMBER() OVER (PARTITION BY CAST(${q(uwiCol)} AS STRING) ORDER BY ${order}) AS __rn,
      COUNT(*) OVER (PARTITION BY CAST(${q(uwiCol)} AS STRING)) AS __n
    FROM ${s.fqtn}
    WHERE ${q(uwiCol)} IS NOT NULL
  )`
  return { sql, orderLabel: date ? `${date} desc (latest row kept)` : 'none — no date column; one row kept arbitrarily' }
}

export class WellsRepository {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly catalog: Catalog,
    private readonly cache: TtlCache,
  ) {}

  /** Full de-duplicated well set; cached because it's stable dashboard data. */
  async dataset(): Promise<{ data: WellsDataset; cached: boolean }> {
    const { value, cached } = await this.cache.getOrLoad('wells:dataset', () => this.loadDataset())
    return { data: value, cached }
  }

  async list(filters: WellFilterInput): Promise<WellsResponse> {
    const { data, cached } = await this.dataset()
    const features = filterFeatures(data.features, filters)
    const applied = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>
    return { type: 'FeatureCollection', metadata: { ...data.metadata, cached, returned: features.length, filters: applied }, features }
  }

  private async loadDataset(): Promise<WellsDataset> {
    const master = await this.catalog.schema('wellMaster')
    const perf = await this.catalog.trySchema('wellPerformance')
    const mUwi = requireField(master, 'uwi')
    requireField(master, 'latitude')
    requireField(master, 'longitude')
    const pUwi = perf?.fields.uwi
    const warnings: string[] = []
    if (!perf) warnings.push('bushra_well_performance is not accessible; performance classes are unavailable.')
    else if (!pUwi) warnings.push('No UWI column found in bushra_well_performance; it was not joined.')
    const joinPerf = Boolean(perf && pUwi)

    const mCte = dedupeCte('m', master, mUwi)
    const pCte = joinPerf ? dedupeCte('p', perf!, pUwi!) : null
    const mSel = master.columns.map((c, i) => `m.${q(c.name)} AS m_${i}`)
    const pSel = joinPerf ? perf!.columns.map((c, i) => `p.${q(c.name)} AS p_${i}`) : []
    const sql = `WITH ${[mCte.sql, pCte?.sql].filter(Boolean).join(',\n')}
SELECT ${[...mSel, ...pSel, 'm.__n AS __mn', joinPerf ? 'p.__n AS __pn' : 'NULL AS __pn'].join(', ')}
FROM m
${joinPerf ? `LEFT JOIN p ON CAST(m.${q(mUwi)} AS STRING) = CAST(p.${q(pUwi!)} AS STRING) AND p.__rn = 1` : ''}
WHERE m.__rn = 1`

    const res = await this.sql.query(sql, [], { label: 'wells.dataset' })

    const mf = master.fields
    const pf = perf?.fields ?? {}
    // Columns surfaced as `metrics`: performance columns that aren't identity fields.
    const identity = new Set([pf.uwi, pf.wellName, pf.operatingArea, pf.performanceClass].filter(Boolean) as string[])
    const metricColumns = joinPerf ? perf!.columns.filter((c) => !identity.has(c.name)) : []

    let invalid = 0
    let mDup = 0
    let pDup = 0
    const classes = new Set<string>()
    const areas = new Set<string>()
    const features: WellFeature[] = []

    for (const r of res.rows) {
      const m: DataRow = {}
      master.columns.forEach((c, i) => (m[c.name] = r[`m_${i}`]))
      const p: DataRow | null = joinPerf ? {} : null
      if (p) perf!.columns.forEach((c, i) => (p[c.name] = r[`p_${i}`]))
      const hasPerf = Boolean(p && p[pUwi!] !== null && p[pUwi!] !== undefined)
      if (num(r.__mn)! > 1) mDup++
      if (hasPerf && num(r.__pn)! > 1) pDup++

      const lat = num(m[mf.latitude!])
      const lon = num(m[mf.longitude!])
      if (!validCoordinate(lat, lon)) {
        invalid++
        continue
      }
      const pick = (field: keyof typeof mf) => {
        const mc = mf[field]
        const mv = mc ? m[mc] : null
        if (mv !== null && mv !== undefined && mv !== '') return mv
        const pc = hasPerf ? pf[field] : undefined
        return pc ? p![pc] : null
      }
      const roles = classifyWell({
        flowDirection: pick('flowDirection'),
        status: pick('status'),
        wellType: pick('wellType'),
        everProduced: pick('everProduced'),
        everInjected: pick('everInjected'),
        oilTotal: pick('oilTotal'),
        injectionTotal: pick('injectionTotal'),
      })
      const performanceClass = hasPerf && pf.performanceClass ? str(p![pf.performanceClass]) : null
      const operatingArea = str(pick('operatingArea'))
      if (performanceClass) classes.add(performanceClass)
      if (operatingArea) areas.add(operatingArea)
      const metrics: Record<string, Scalar> = {}
      if (hasPerf) for (const c of metricColumns) metrics[c.name] = scalar(p![c.name])

      features.push({
        type: 'Feature',
        id: 0,
        geometry: { type: 'Point', coordinates: [lon!, lat] }, // GeoJSON order: [lng, lat]
        properties: {
          uwi: String(m[mUwi]),
          formattedUwi: str(mf.formattedUwi ? m[mf.formattedUwi] : null),
          wellName: str(pick('wellName')),
          province: str(mf.province ? m[mf.province] : null),
          operatingArea,
          wellType: roles.currentRole,
          status: str(pick('status')),
          flowDirection: str(pick('flowDirection')),
          roles,
          performanceClass,
          metrics,
          performanceRecordCount: hasPerf ? (num(r.__pn) ?? 1) : 0,
        },
      })
    }
    features.sort((a, b) => a.properties.uwi.localeCompare(b.properties.uwi))
    features.forEach((f, i) => (f.id = i + 1))

    if (!mf.status && !mf.flowDirection && !mf.wellType && !pf.status && !pf.flowDirection) {
      warnings.push('No status / flow-direction / well-type column found; wells are shown as unclassified.')
    }
    if (!mf.everInjected && !mf.injectionTotal && !pf.everInjected && !pf.injectionTotal) {
      warnings.push('No historical injection evidence column found; dual-role history is based on current role only.')
    }
    if (invalid) warnings.push(`${invalid} well${invalid === 1 ? '' : 's'} excluded from the map for missing or invalid coordinates.`)

    return {
      features,
      metadata: {
        source: 'databricks',
        tables: [master.table, ...(joinPerf ? [perf!.table] : [])],
        generatedAt: new Date().toISOString(),
        total: features.length,
        excluded: { invalidCoordinates: invalid },
        duplicates: {
          masterWellsWithMultipleRows: mDup,
          performanceWellsWithMultipleRows: pDup,
          dedupeOrder: { master: mCte.orderLabel, performance: pCte?.orderLabel ?? 'not joined' },
        },
        fields: { master: mf, performance: joinPerf ? pf : null },
        metricColumns,
        performanceClasses: [...classes].sort(classOrder),
        operatingAreas: [...areas].sort(),
        warnings,
      },
    }
  }

  /** Everything known about one well, via parameterized queries. */
  async detail(uwi: string) {
    const { value, cached } = await this.cache.getOrLoad(`wells:detail:${uwi}`, () => this.loadDetail(uwi), 5 * 60_000)
    return { ...value, cached }
  }

  private async loadDetail(uwi: string) {
    const param = [{ name: 'uwi', value: uwi, type: 'STRING' as const }]
    const byUwi = async (key: TableKey, limit: number): Promise<{ schema: TableSchema; rows: Row[] } | null> => {
      const s = await this.catalog.trySchema(key)
      if (!s?.fields.uwi) return null
      const order = s.fields.recordDate ? ` ORDER BY ${q(s.fields.recordDate)} DESC NULLS LAST` : s.fields.rank ? ` ORDER BY ${q(s.fields.rank)} ASC NULLS LAST` : ''
      const res = await this.sql.query(`SELECT * FROM ${s.fqtn} WHERE CAST(${q(s.fields.uwi)} AS STRING) = :uwi${order} LIMIT ${limit}`, param, { label: `wells.detail.${key}` })
      return { schema: s, rows: res.rows }
    }
    const pairsQuery = async () => {
      const s = await this.catalog.trySchema('pairs')
      const inj = s?.fields.injectorUwi
      const prod = s?.fields.producerUwi
      if (!s || !inj || !prod) return null
      const order = s.fields.distance ? ` ORDER BY ${q(s.fields.distance)} ASC NULLS LAST` : ''
      const res = await this.sql.query(
        `SELECT * FROM ${s.fqtn} WHERE CAST(${q(inj)} AS STRING) = :uwi OR CAST(${q(prod)} AS STRING) = :uwi${order} LIMIT 500`,
        param,
        { label: 'wells.detail.pairs' },
      )
      return {
        asInjector: res.rows.filter((r) => String(r[inj]) === uwi),
        asProducer: res.rows.filter((r) => String(r[prod]) === uwi),
        fields: s.fields,
      }
    }

    const master = await byUwi('wellMaster', 20)
    if (!master || master.rows.length === 0) throw notFound(`Well ${uwi}`)
    const [perf, pairs, ranking, economics, features] = await Promise.all([
      byUwi('wellPerformance', 500),
      pairsQuery(),
      byUwi('conversionRanking', 20),
      byUwi('conversionEconomics', 200),
      byUwi('producerFeatures', 5),
    ])

    // Reuse the de-duplicated map record for a consistent classification.
    const { data } = await this.dataset()
    const feature = data.features.find((f) => f.properties.uwi === uwi) ?? null
    const latest = perf?.rows[0] ?? null

    return {
      uwi,
      well: feature?.properties ?? null,
      location: feature ? { longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] } : null,
      attributes: master.rows[0],
      masterRowCount: master.rows.length,
      performance: {
        available: Boolean(perf),
        classColumn: perf?.schema.fields.performanceClass ?? null,
        latest,
        records: perf?.rows ?? [],
        recordCount: perf?.rows.length ?? 0,
      },
      pairs: pairs
        ? { available: true, ...pairs, notice: PAIRS_NOTICE }
        : { available: false, asInjector: [], asProducer: [], fields: {}, notice: PAIRS_NOTICE },
      conversion: {
        ranking: ranking?.rows ?? [],
        economics: economics?.rows ?? [],
        notice: MODEL_NOTICE,
      },
      producerFeatures: features?.rows[0] ?? null,
      generatedAt: new Date().toISOString(),
    }
  }
}

export const PAIRS_NOTICE =
  'Injector–producer pairs are based on spatial proximity in the saved pairing table. Proximity does not establish confirmed hydraulic connectivity.'
export const MODEL_NOTICE =
  'Rankings and economics are model-generated estimates saved in Databricks. They are not live inference and not verified realized savings or profits.'

const CLASS_RANK: Record<string, number> = { good: 0, high: 0, moderate: 1, medium: 1, low: 2, poor: 2 }
export function classOrder(a: string, b: string) {
  return (CLASS_RANK[a.toLowerCase()] ?? 9) - (CLASS_RANK[b.toLowerCase()] ?? 9) || a.localeCompare(b)
}

export function filterFeatures(features: WellFeature[], f: WellFilterInput): WellFeature[] {
  const area = f.area?.toLowerCase()
  const province = f.province?.toLowerCase()
  const perf = f.performance?.toLowerCase()
  const search = f.search?.trim().toLowerCase()
  return features.filter(({ properties: p }) => {
    if (area && p.operatingArea?.toLowerCase() !== area) return false
    if (province && p.province?.toLowerCase() !== province) return false
    if (perf && p.performanceClass?.toLowerCase() !== perf) return false
    if (f.type === 'dual' ? !p.roles.dualRole : f.type && p.wellType !== f.type) return false
    if (search) {
      const hay = `${p.uwi} ${p.formattedUwi ?? ''} ${p.wellName ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
}
