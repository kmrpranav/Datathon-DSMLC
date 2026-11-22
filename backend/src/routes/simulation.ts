import { Router } from 'express'
import { z } from 'zod'
import type { Services } from '../services/container.js'
import { AppError } from '../lib/errors.js'
import { uwiSchema } from '../lib/validation.js'

const runBody = z.object({
  injectorUwi: uwiSchema,
  injectionRateM3d: z.number().positive().max(100_000).optional(),
  producerUwis: z.array(uwiSchema).max(50).optional(),
  horizonDays: z.number().int().min(1).max(3650).optional(),
})

/**
 * GET  /api/simulation/status  Whether live inference is connected.
 * POST /api/simulation/run     Live inference boundary — 501 until a Model Serving endpoint exists.
 */
export function simulationRouter(s: Services) {
  const r = Router()
  r.get('/status', (_req, res) => {
    res.json({ liveInference: s.modelServing.connected, message: s.modelServing.description })
  })
  r.post('/run', async (req, res) => {
    const body = runBody.parse(req.body)
    if (!s.modelServing.connected) {
      throw new AppError(501, 'INFERENCE_NOT_CONNECTED', s.modelServing.description)
    }
    res.json(await s.modelServing.predict(body))
  })
  return r
}
