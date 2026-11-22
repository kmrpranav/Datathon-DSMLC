import { Router } from 'express'
import { publicConfigStatus } from '../config/env.js'
import { TABLES, type TableKey } from '../repositories/catalog.js'
import type { Services } from '../services/container.js'
import type { HealthResponse } from '../types/api.js'

const started = Date.now()
const VERSION = '0.1.0'

/**
 * GET /api/health          → config presence only (no Databricks call)
 * GET /api/health?deep=1   → also runs `SELECT 1` and checks each table is readable
 */
export function healthRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    const body: HealthResponse = {
      status: s.config.configured ? 'ok' : 'degraded',
      service: 'floodiq-api',
      version: VERSION,
      uptimeSeconds: Math.round((Date.now() - started) / 1000),
      time: new Date().toISOString(),
      databricks: publicConfigStatus(s.config),
      cache: s.cache.stats(),
    }
    if (req.query.deep === '1' && s.config.configured) {
      const t0 = Date.now()
      try {
        await s.sql.query('SELECT 1 AS ok', [], { label: 'health.ping', timeoutMs: 60_000 })
        body.databricks.connection = { ok: true, latencyMs: Date.now() - t0 }
        const tables: Record<string, { available: boolean }> = {}
        await Promise.all(
          (Object.keys(TABLES) as TableKey[]).map(async (k) => {
            tables[TABLES[k]] = { available: Boolean(await s.catalog.trySchema(k).catch(() => null)) }
          }),
        )
        body.databricks.tables = tables
      } catch (e) {
        body.status = 'degraded'
        body.databricks.connection = { ok: false, error: (e as { code?: string }).code ?? 'ERROR' }
      }
    }
    res.json(body)
  })
  return r
}
