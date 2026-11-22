import { Router } from 'express'
import type { Services } from '../services/container.js'

/** GET /api/overview  Summary KPIs for the Overview page. */
export function overviewRouter(s: Services) {
  const r = Router()
  r.get('/', async (_req, res) => {
    res.json(await s.analytics.overview())
  })
  return r
}
