import { Router } from 'express'
import { z } from 'zod'
import type { Services } from '../services/container.js'
import { optText, pageSchema } from '../lib/validation.js'

const query = z.object({
  class: optText(40),
  area: optText(),
  search: optText(80),
  ...pageSchema,
})

/**
 * GET /api/performance  Existing Good / Moderate / Low classes (not recomputed).
 *   Returns `summary` (SQL GROUP BY counts) and a page of `rows`.
 *   ?class=&area=&search=&limit=50&offset=0&sort=<column>&dir=asc|desc
 */
export function performanceRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    const q = query.parse(req.query)
    const [summary, rows] = await Promise.all([s.data.performanceSummary(), s.data.performanceRows(q)])
    res.json({ summary, ...rows })
  })
  return r
}
