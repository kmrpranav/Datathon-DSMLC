import { Router } from 'express'
import { z } from 'zod'
import type { Services } from '../services/container.js'
import { optNumber, optText, pageSchema, uwiSchema } from '../lib/validation.js'

const rankingQuery = z.object({ area: optText(), search: optText(80), minScore: optNumber, ...pageSchema })
const economicsQuery = z.object({ scenario: optText(80), uwi: uwiSchema.optional(), search: optText(80), ...pageSchema })

/**
 * GET /api/conversion-ranking    Saved ML candidate ranking (passed through, never regenerated).
 *   ?area=&search=&minScore=&limit&offset&sort=<column>&dir=asc|desc
 * GET /api/conversion-economics  Saved scenario-based estimates + distinct `scenarios`.
 *   ?scenario=&uwi=&search=&limit&offset&sort&dir
 */
export function conversionsRouter(s: Services) {
  const r = Router()
  r.get('/conversion-ranking', async (req, res) => {
    res.json(await s.data.conversionRanking(rankingQuery.parse(req.query)))
  })
  r.get('/conversion-economics', async (req, res) => {
    res.json(await s.data.conversionEconomics(economicsQuery.parse(req.query)))
  })
  return r
}
