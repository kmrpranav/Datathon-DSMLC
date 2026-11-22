import { Router } from 'express'
import { gzipSync } from 'node:zlib'
import type { Services } from '../services/container.js'

/**
 * GET /api/analytics  Well-level dataset for the Analytics page: every unique well
 * with its roles, totals and latest performance row, plus the saved conversion
 * candidates (with economics where they exist) and metric labels / units.
 * The page filters this one dataset so all charts stay consistent.
 * (~1.3 MB of JSON, so it is gzipped when the client accepts it.)
 */
export function analyticsRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    const body = JSON.stringify(await s.data.analytics())
    res.type('application/json')
    res.vary('Accept-Encoding')
    if (/\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      res.setHeader('Content-Encoding', 'gzip')
      res.send(gzipSync(body))
    } else res.send(body)
  })
  return r
}
