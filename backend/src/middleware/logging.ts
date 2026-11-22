import type { RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'

/** One line per request: id, method, path (no query string), status, duration. */
export function requestLogger(enabled = true): RequestHandler {
  return (req, res, next) => {
    const id = randomUUID().slice(0, 8)
    res.locals.requestId = id
    res.setHeader('X-Request-Id', id)
    const start = process.hrtime.bigint()
    res.on('finish', () => {
      if (!enabled) return
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      console.log(`[http] ${id} ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`)
    })
    next()
  }
}
