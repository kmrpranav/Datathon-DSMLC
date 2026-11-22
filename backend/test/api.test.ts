import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createServices } from '../src/services/container.js'
import { loadConfig } from '../src/config/env.js'
import { FakeWarehouse } from './fakeWarehouse.js'

const TOKEN = 'dapi-test-secret-123'
const env = { NODE_ENV: 'test', DATABRICKS_HOST: 'https://example.cloud.databricks.com', DATABRICKS_WAREHOUSE_ID: 'abc123', DATABRICKS_TOKEN: TOKEN, FRONTEND_ORIGIN: 'http://localhost:5173' } as NodeJS.ProcessEnv

function setup(missing: string[] = []) {
  const sql = new FakeWarehouse(missing)
  const app = createApp(createServices(loadConfig(env), { sql }), { logRequests: false })
  return { app, sql }
}

describe('GET /api/health', () => {
  it('reports configuration without secrets', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/health').expect(200)
    expect(res.body).toMatchObject({ status: 'ok', databricks: { configured: true, missing: [] } })
    expect(JSON.stringify(res.body)).not.toContain(TOKEN)
    expect(JSON.stringify(res.body)).not.toContain('abc123')
  })

  it('flags missing / placeholder config and data routes return 503', async () => {
    const app = createApp(createServices(loadConfig({ NODE_ENV: 'test', DATABRICKS_TOKEN: 'YOUR_PRIVATE_TOKEN' } as NodeJS.ProcessEnv)), { logRequests: false })
    const h = await request(app).get('/api/health').expect(200)
    expect(h.body.status).toBe('degraded')
    expect(h.body.databricks.missing).toEqual(['DATABRICKS_HOST', 'DATABRICKS_WAREHOUSE_ID', 'DATABRICKS_TOKEN'])
    const w = await request(app).get('/api/wells').expect(503)
    expect(w.body.error.code).toBe('DATABRICKS_NOT_CONFIGURED')
  })
})

describe('GET /api/wells', () => {
  it('returns one GeoJSON feature per UWI with valid [lng, lat] coordinates', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/wells').expect(200)
    expect(res.body.type).toBe('FeatureCollection')
    const uwis = res.body.features.map((f: { properties: { uwi: string } }) => f.properties.uwi)
    expect(uwis).toEqual(['W1', 'W2', 'W4'])
    expect(new Set(uwis).size).toBe(uwis.length)
    expect(res.body.features[0].geometry.coordinates).toEqual([-113.5, 52.1])
    expect(res.body.metadata).toMatchObject({
      total: 3,
      excluded: { invalidCoordinates: 1 },
      duplicates: { masterWellsWithMultipleRows: 1, performanceWellsWithMultipleRows: 1 },
      performanceClasses: ['Good', 'Low'], // W3 (Moderate) is excluded for invalid coordinates
    })
  })

  it('preserves dual-role history and current status', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/wells').expect(200)
    const w2 = res.body.features.find((f: { properties: { uwi: string } }) => f.properties.uwi === 'W2').properties
    expect(w2).toMatchObject({ wellType: 'injection', performanceClass: 'Low', roles: { dualRole: true, hasProducedHistorically: true } })
    expect(w2.metrics).toMatchObject({ cum_oil_m3: 800, cum_injected_water_m3: 12000 })
    const w4 = res.body.features.find((f: { properties: { uwi: string } }) => f.properties.uwi === 'W4').properties
    expect(w4).toMatchObject({ wellType: 'unknown', performanceClass: null, performanceRecordCount: 0 })
  })

  it('filters on the backend', async () => {
    const { app } = setup()
    const by = async (q: string) => (await request(app).get(`/api/wells?${q}`).expect(200)).body.features.map((f: { properties: { uwi: string } }) => f.properties.uwi)
    expect(await by('type=dual')).toEqual(['W2'])
    expect(await by('type=production')).toEqual(['W1'])
    expect(await by('performance=good')).toEqual(['W1'])
    expect(await by('area=south')).toEqual(['W4'])
    expect(await by('search=bravo')).toEqual(['W2'])
  })

  it('caches the dataset (one warehouse query for repeated calls)', async () => {
    const { app, sql } = setup()
    await request(app).get('/api/wells').expect(200)
    await request(app).get('/api/wells?type=dual').expect(200)
    expect(sql.calls.filter((c) => c.label === 'wells.dataset')).toHaveLength(1)
  })

  it('validates query params', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/wells?type=bogus').expect(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })
})

describe('GET /api/wells/:uwi', () => {
  it('returns detail using a bound parameter', async () => {
    const { app, sql } = setup()
    const res = await request(app).get('/api/wells/W2').expect(200)
    expect(res.body.well).toMatchObject({ uwi: 'W2', wellType: 'injection' })
    expect(res.body.pairs.asInjector).toHaveLength(1)
    expect(res.body.pairs.notice).toMatch(/does not establish/)
    const q = sql.calls.find((c) => c.label === 'wells.detail.wellMaster')!
    expect(q.sql).toContain(':uwi')
    expect(q.sql).not.toContain("'W2'")
    expect(q.params).toEqual([{ name: 'uwi', value: 'W2', type: 'STRING' }])
  })

  it('404s for unknown wells and 400s for malformed UWIs', async () => {
    const { app } = setup()
    expect((await request(app).get('/api/wells/NOPE').expect(404)).body.error.code).toBe('NOT_FOUND')
    await request(app).get(`/api/wells/${encodeURIComponent("x' OR 1=1 --")}`).expect(400)
  })
})

describe('performance, pairs, ranking, economics, overview', () => {
  it('GET /api/performance returns existing class counts', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/performance?class=Good').expect(200)
    expect(res.body.summary.byClass.map((c: { class: string }) => c.class)).toEqual(['Good', 'Moderate', 'Low'])
    expect(res.body.summary.multipleRowsPerWell).toBe(true)
    expect(res.body.rows[0].performance_class).toBe('Good')
  })

  it('GET /api/conversion-ranking sorts by allowlisted columns only', async () => {
    const { app, sql } = setup()
    const ok = await request(app).get('/api/conversion-ranking?sort=conversion_score&dir=desc&limit=10').expect(200)
    expect(ok.body.page).toEqual({ limit: 10, offset: 0, total: 2 })
    expect(ok.body.notice).toMatch(/model-generated/i)
    expect(ok.body.rows[0]).not.toHaveProperty('__total')
    const q = sql.calls.find((c) => c.label === 'rows.conversionRanking')!
    expect(q.sql).toContain('ORDER BY `conversion_score` DESC NULLS LAST')
    const bad = await request(app).get('/api/conversion-ranking?sort=secret_col').expect(400)
    expect(bad.body.error.details.allowed).toContain('rank')
    await request(app).get('/api/conversion-ranking?sort=rank;drop').expect(400)
  })

  it('binds search terms as parameters', async () => {
    const { app, sql } = setup()
    await request(app).get(`/api/conversion-ranking?search=${encodeURIComponent("50%' --")}`).expect(200)
    const q = sql.calls.find((c) => c.label === 'rows.conversionRanking')!
    expect(q.sql).not.toContain("50%'")
    expect(q.params[0]).toMatchObject({ type: 'STRING', value: "%50\\%' --%" })
  })

  it('GET /api/conversion-economics includes scenarios and an estimate disclaimer', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/conversion-economics').expect(200)
    expect(res.body.scenarios).toEqual(['Base', 'High price'])
    expect(res.body.notice).toMatch(/not verified realized savings/)
  })

  it('GET /api/injector-producer-pairs', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/injector-producer-pairs?maxDistance=500').expect(200)
    expect(res.body.rows).toHaveLength(1)
    expect(res.body.notice).toMatch(/proximity/)
  })

  it('GET /api/overview aggregates every section', async () => {
    const { app } = setup()
    const res = await request(app).get('/api/overview').expect(200)
    expect(res.body.wells).toMatchObject({ totalUnique: 4, mapped: 3, dualRole: 1, byRole: { injection: 1, production: 1, unknown: 1 } })
    expect(res.body.pairs).toMatchObject({ pairs: 1, medianDistance: 410 })
    expect(res.body.conversion.candidates).toBe(2)
    expect(res.body.economics.scenarios).toEqual(['Base', 'High price'])
  })

  it('degrades gracefully when an optional table is missing', async () => {
    const { app } = setup(['bushra_well_performance'])
    const res = await request(app).get('/api/wells').expect(200)
    expect(res.body.metadata.warnings.join(' ')).toMatch(/not accessible/)
    expect(res.body.features[0].properties.performanceClass).toBeNull()
  })
})

describe('simulation boundary and misc', () => {
  it('reports live inference as not connected', async () => {
    const { app } = setup()
    expect((await request(app).get('/api/simulation/status').expect(200)).body.liveInference).toBe(false)
    const run = await request(app).post('/api/simulation/run').send({ injectorUwi: 'W2' }).expect(501)
    expect(run.body.error.code).toBe('INFERENCE_NOT_CONNECTED')
  })

  it('restricts CORS to the configured origin', async () => {
    const { app } = setup()
    const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    const bad = await request(app).get('/api/health').set('Origin', 'https://evil.example')
    expect(bad.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('returns JSON 404 for unknown routes', async () => {
    const { app } = setup()
    expect((await request(app).get('/api/nope').expect(404)).body.error.code).toBe('NOT_FOUND')
  })
})
