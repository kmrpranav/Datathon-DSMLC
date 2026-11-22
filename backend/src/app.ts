import express from 'express'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import type { Services } from './services/container.js'
import { requestLogger } from './middleware/logging.js'
import { errorHandler, notFoundHandler } from './middleware/errors.js'
import { healthRouter } from './routes/health.js'
import { wellsRouter } from './routes/wells.js'
import { performanceRouter } from './routes/performance.js'
import { pairsRouter } from './routes/pairs.js'
import { conversionsRouter } from './routes/conversions.js'
import { overviewRouter } from './routes/overview.js'
import { metaRouter } from './routes/meta.js'
import { simulationRouter } from './routes/simulation.js'
import { analyticsRouter } from './routes/analytics.js'

export function createApp(s: Services, opts: { logRequests?: boolean; rateLimitPerMinute?: number } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')

  app.use(requestLogger(opts.logRequests ?? true))
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || s.config.frontendOrigins.includes(origin)),
      methods: ['GET', 'POST'],
      maxAge: 600,
    }),
  )
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '32kb' }))
  app.use(
    '/api',
    rateLimit({ windowMs: 60_000, limit: opts.rateLimitPerMinute ?? 300, standardHeaders: 'draft-8', legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down.' } } }),
  )

  app.use('/api/health', healthRouter(s))
  app.use('/api/wells', wellsRouter(s))
  app.use('/api/performance', performanceRouter(s))
  app.use('/api/injector-producer-pairs', pairsRouter(s))
  app.use('/api', conversionsRouter(s))
  app.use('/api/overview', overviewRouter(s))
  app.use('/api/analytics', analyticsRouter(s))
  app.use('/api/meta', metaRouter(s))
  app.use('/api/simulation', simulationRouter(s))

  app.use(notFoundHandler)
  app.use(errorHandler(s.config.nodeEnv !== 'production'))
  return app
}
