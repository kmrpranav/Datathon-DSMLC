import { Router } from 'express'
import { z } from 'zod'
import type { Services } from '../services/container.js'
import { optNumber, optText, pageSchema, uwiSchema } from '../lib/validation.js'

const query = z.object({
  uwi: uwiSchema.optional(),
  injector: uwiSchema.optional(),
  producer: uwiSchema.optional(),
  area: optText(),
  maxDistance: optNumber,
  ...pageSchema,
})

/**
 * GET /api/injector-producer-pairs  Saved spatial pairings (not confirmed connectivity).
 *   ?uwi= (either side) &injector=&producer=&area=&maxDistance=&limit&offset&sort&dir
 */
export function pairsRouter(s: Services) {
  const r = Router()
  r.get('/', async (req, res) => {
    res.json(await s.data.pairs(query.parse(req.query)))
  })
  return r
}
