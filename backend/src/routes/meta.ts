import { Router } from 'express'
import type { Services } from '../services/container.js'

/**
 * GET /api/meta/schema  Columns + logical-field resolution for every table.
 * Column names only — no data. Used to verify mappings.
 */
export function metaRouter(s: Services) {
  const r = Router()
  r.get('/schema', async (_req, res) => {
    res.json(await s.data.schemaReport())
  })
  return r
}
