import { Router } from 'express'
import { z } from 'zod'
import type { Services } from '../services/container.js'
import { optText, uwiSchema } from '../lib/validation.js'

const listQuery = z.object({
  area: optText(),
  province: optText(10),
  type: z.enum(['injection', 'production', 'unknown', 'dual']).optional(),
  performance: optText(40),
  search: optText(80),
})

/**
 * GET /api/wells       GeoJSON FeatureCollection, one feature per UWI.
 *   ?area=&province=&type=injection|production|unknown|dual&performance=Good&search=
 * GET /api/wells/:uwi  Detail for one well (404 if absent from bushra_well_master).
 */
export function wellsRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    const filters = listQuery.parse(req.query)
    res.json(await s.wells.list(filters))
  })
  r.get('/:uwi', async (req, res) => {
    const uwi = uwiSchema.parse(decodeURIComponent(req.params.uwi))
    res.json(await s.wells.detail(uwi))
  })
  return r
}
