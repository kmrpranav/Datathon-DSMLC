import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { mkdtempSync, readFileSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../src/app.js'
import { createServices } from '../src/services/container.js'
import { loadConfig } from '../src/config/env.js'
import { parseCsv, splitCsv } from '../src/data/csv/parse.js'

// Same columns as the real exports; values are fixtures.
const WELLS = `uwi,well_name,area,lat,lon,on_production_date,total_oil_m3,total_inj_m3,first_injection_date,is_injector,is_producer
P1,"Prod, One",North,52.1,-109.5,2016-09-01,7949.2,0.0,null,false,true
I1,Inj One,North,52.2,-109.6,null,0.0,5000.5,2021-01-01,true,false
D1,Dual One,South,52.3,-109.7,2012-03-25,1322.0,186258.0,2023-06-01,true,true
U1,Idle One,South,52.4,-109.8,null,0.0,0.0,null,false,false
X1,No coords,South,null,null,null,0.0,0.0,null,false,true
P1,Duplicate of P1,North,52.1,-109.5,2016-09-01,1.0,0.0,null,false,true
`
const PERF = `uwi,area,week,oil_rate_13w,water_cut_4w,uptime_4w,active_injectors_nearby,area_percentile,performance_class
P1,North,2026-10-19,0.5,0.9,1,0,0.1,Low
P1,North,2026-10-26,0.8,null,1,2,0.6,Moderate
D1,South,2026-10-26,3.1,0.2,0.5,1,0.9,Good
`
const RANKING = `candidate,neighbours,extra_oil_4w,water_4w,own_oil_lost_4w,net_oil_4w,oil_per_m3_water,rank
P1,10,20.5,1080,1.5,19.0,0.0176,2
D1,12,40.1,1080,2.0,38.1,0.0353,1
`
const ECON = `rank,candidate,neighbours,net_oil_4w,oil_per_m3_water,expected_profit_cad,p10_profit_cad,p90_profit_cad,chance_of_profit,breakeven_price_bbl
1,D1,12,38.1,0.04,466219.64,-1000.5,925541.21,0.97,44.05
`

let dir: string
let app: ReturnType<typeof createApp>

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'floodiq-csv-'))
  writeFileSync(path.join(dir, 'wells.csv'), WELLS)
  writeFileSync(path.join(dir, 'performance.csv'), PERF)
  writeFileSync(path.join(dir, 'conversion_ranking.csv'), RANKING)
  writeFileSync(path.join(dir, 'conversion_economics.csv'), ECON)
  const config = loadConfig({ NODE_ENV: 'test', DATA_SOURCE: 'csv', CSV_DATA_DIR: dir } as NodeJS.ProcessEnv)
  app = createApp(createServices(config), { logRequests: false })
})
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('CSV parsing', () => {
  it('handles quotes, escaped quotes, CRLF and embedded newlines', () => {
    expect(splitCsv('a,b\r\n"x, y","say ""hi""\nthere"\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']])
  })
  it('infers types and treats null tokens as missing', () => {
    const p = parseCsv('id,n,f,b,d,s\n007,1,1.5,true,2024-01-02,x\n010,null,,FALSE,null,NaN\n')
    expect(p.columns.map((c) => c.type)).toEqual(['STRING', 'BIGINT', 'DOUBLE', 'BOOLEAN', 'DATE', 'STRING'])
    expect(p.rows[0]).toEqual({ id: '007', n: 1, f: 1.5, b: true, d: '2024-01-02', s: 'x' })
    expect(p.rows[1]).toEqual({ id: '010', n: null, f: null, b: false, d: null, s: null })
  })
  it('skips malformed lines instead of shifting columns', () => {
    expect(parseCsv('a,b\n1,2\n3\n').malformedRows).toBe(1)
  })
})

describe('CSV data source', () => {
  it('health reports the CSV source and which tables are not exported', async () => {
    const res = await request(app).get('/api/health?deep=1').expect(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.dataSource.kind).toBe('csv')
    expect(res.body.dataSource.tables.bushra_well_master).toMatchObject({ available: true, source: 'wells.csv', rows: 6 })
    expect(res.body.dataSource.tables.bushra_injector_producer_pairs.available).toBe(false)
    expect(JSON.stringify(res.body)).not.toContain(dir) // no filesystem paths
  })

  it('GET /api/wells: one feature per UWI, typed values, roles from history flags', async () => {
    const res = await request(app).get('/api/wells').expect(200)
    const m = res.body.metadata
    expect(m).toMatchObject({ source: 'csv', total: 4, excluded: { invalidCoordinates: 1 }, duplicates: { masterWellsWithMultipleRows: 1, performanceWellsWithMultipleRows: 1 } })
    const byUwi = Object.fromEntries(res.body.features.map((f: { properties: { uwi: string } }) => [f.properties.uwi, f]))
    expect(Object.keys(byUwi).sort()).toEqual(['D1', 'I1', 'P1', 'U1'])
    expect(byUwi.P1.geometry.coordinates).toEqual([-109.5, 52.1])
    expect(byUwi.P1.properties).toMatchObject({ wellName: 'Prod, One', wellType: 'production', performanceClass: 'Moderate', performanceRecordCount: 2 })
    expect(byUwi.P1.properties.metrics).toMatchObject({ oil_rate_13w: 0.8, water_cut_4w: null, week: '2026-10-26' })
    expect(byUwi.I1.properties.wellType).toBe('injection')
    expect(byUwi.U1.properties.wellType).toBe('unknown')
    // Injection started after production → currently injection, flagged dual-role.
    expect(byUwi.D1.properties.roles).toMatchObject({ currentRole: 'injection', currentRoleSource: 'latestRoleStart', dualRole: true })
  })

  it('filters wells', async () => {
    const n = async (q: string) => (await request(app).get(`/api/wells?${q}`).expect(200)).body.metadata.returned
    expect(await n('type=dual')).toBe(1)
    expect(await n('type=production')).toBe(1)
    expect(await n('area=south')).toBe(2)
    expect(await n('performance=good')).toBe(1)
    expect(await n('search=prod,')).toBe(1)
  })

  it('GET /api/wells/:uwi returns the rows that exist and 404 otherwise', async () => {
    const res = await request(app).get('/api/wells/D1').expect(200)
    expect(res.body.attributes).toMatchObject({ uwi: 'D1', is_injector: true, total_inj_m3: 186258 })
    expect(res.body.performance.latest.performance_class).toBe('Good')
    expect(res.body.conversion.economics).toHaveLength(1)
    expect(res.body.pairs.available).toBe(false)
    expect(res.body.producerFeatures).toBeNull()
    await request(app).get('/api/wells/NOPE').expect(404)
  })

  it('GET /api/performance: summary counts and server-side paging/sorting', async () => {
    const res = await request(app).get('/api/performance?sort=water_cut_4w&dir=desc&limit=2').expect(200)
    expect(res.body.summary).toMatchObject({ totalRows: 3, totalWells: 2, multipleRowsPerWell: true })
    expect(res.body.summary.byClass.map((c: { class: string }) => c.class)).toEqual(['Good', 'Moderate', 'Low'])
    expect(res.body.rows.map((r: { water_cut_4w: number }) => r.water_cut_4w)).toEqual([0.9, 0.2]) // nulls last
    expect(res.body.page).toEqual({ limit: 2, offset: 0, total: 3 })
    await request(app).get('/api/performance?sort=drop_table').expect(400)
  })

  it('GET /api/conversion-ranking keeps the saved order and values', async () => {
    const res = await request(app).get('/api/conversion-ranking').expect(200)
    expect(res.body.fields).toMatchObject({ uwi: 'candidate', rank: 'rank' })
    expect(res.body.rows.map((r: { candidate: string }) => r.candidate)).toEqual(['D1', 'P1'])
    expect(res.body.notice).toMatch(/model-generated estimates/)
    expect((await request(app).get('/api/conversion-ranking?search=p1').expect(200)).body.page.total).toBe(1)
  })

  it('GET /api/conversion-economics passes values through, with no invented scenarios', async () => {
    const res = await request(app).get('/api/conversion-economics').expect(200)
    expect(res.body.rows[0]).toMatchObject({ candidate: 'D1', p10_profit_cad: -1000.5, chance_of_profit: 0.97 })
    expect(res.body.scenarios).toEqual([])
  })

  it('tables that were not exported are reported, not synthesized', async () => {
    const res = await request(app).get('/api/injector-producer-pairs').expect(404)
    expect(res.body.error.code).toBe('DATASET_NOT_AVAILABLE')
    const o = await request(app).get('/api/overview').expect(200)
    expect(o.body).toMatchObject({ source: 'csv', pairs: null, wells: { totalUnique: 5, mapped: 4, dualRole: 1 } })
    expect(o.body.unavailable).toContain('bushra_injector_producer_pairs')
  })

  it('reloads a file when it changes and reports a missing file as 503', async () => {
    const f = path.join(dir, 'conversion_economics.csv')
    writeFileSync(f, `${ECON}2,P1,10,19.0,0.02,1000,500,2000,0.6,60\n`)
    utimesSync(f, new Date(), new Date(Date.now() + 5000))
    expect((await request(app).get('/api/conversion-economics').expect(200)).body.page.total).toBe(2)
    unlinkSync(f)
    const res = await request(app).get('/api/conversion-economics').expect(503)
    expect(res.body.error.code).toBe('DATA_FILE_MISSING')
    writeFileSync(f, ECON)
  })

  it('GET /api/analytics: every unique well once, roles not double-counted, candidates joined to economics', async () => {
    const res = await request(app).get('/api/analytics').expect(200)
    const d = res.body
    expect(d.wells.map((w: { uwi: string }) => w.uwi)).toEqual(['D1', 'I1', 'P1', 'U1', 'X1']) // includes the well without coordinates
    expect(d.quality).toMatchObject({ masterRows: 6, uniqueWells: 5, duplicateWells: 1, withoutCoordinates: 1, candidatesWithEconomics: 1, missingColumns: [] })
    const by = Object.fromEntries(d.wells.map((w: { uwi: string }) => [w.uwi, w]))
    expect(by.D1).toMatchObject({ hasProduced: true, hasInjected: true, dualRole: true, totalInjM3: 186258, performance: { class: 'Good', oilRate13w: 3.1 }, conversionRank: 1 })
    expect(by.P1.performance).toMatchObject({ class: 'Moderate', week: '2026-10-26', waterCut4w: null })
    expect(by.X1).toMatchObject({ hasCoordinates: false, performance: null })
    expect(d.candidates.map((c: { uwi: string }) => c.uwi)).toEqual(['D1', 'P1'])
    expect(d.candidates[0].economics).toMatchObject({ expectedProfitCad: 466219.64, p10ProfitCad: -1000.5 })
    expect(d.candidates[1].economics).toBeNull()
    expect(d.metrics.oilRate13w.unit).toBe('m³/d')
    expect(d.notices.economics).toMatch(/not guaranteed/)
  })

  it('never writes to the CSV files', async () => {
    const before = readFileSync(path.join(dir, 'wells.csv'), 'utf8')
    await request(app).get('/api/wells').expect(200)
    await request(app).get('/api/overview').expect(200)
    expect(readFileSync(path.join(dir, 'wells.csv'), 'utf8')).toBe(before)
  })
})
