import { Router } from 'express'
import { publicConfigStatus } from '../config/env.js'
import type { Services } from '../services/container.js'
import type { HealthResponse } from '../types/api.js'

const started = Date.now()
const VERSION = '0.2.0'

/**
 * GET /api/health          → active data source + config presence (cheap)
 * GET /api/health?deep=1   → also reads every table (Databricks: `SELECT 1` + DESCRIBE; CSV: parses each file)
 */
export function healthRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    const deep = req.query.deep === '1'
    const data = await s.data.health(deep)
    const databricks: HealthResponse['databricks'] = publicConfigStatus(s.config)
    if (data.kind === 'databricks') {
      if (data.connection) databricks.connection = data.connection
      if (data.tables) databricks.tables = Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, { available: v.available }]))
    }
    const body: HealthResponse = {
      status: data.ok ? 'ok' : 'degraded',
      service: 'floodiq-api',
      version: VERSION,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      time: new Date().toISOString(),
      dataSource: data,
      databricks,
      cache: s.cache.stats(),
    }
    res.json(body)
  })
  return r
}
