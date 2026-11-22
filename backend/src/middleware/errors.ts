import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import { AppError, DatabricksError } from '../lib/errors.js'
import type { ErrorResponse } from '../types/api.js'

const DATABRICKS_STATUS: Record<DatabricksError['code'], { status: number; message: string }> = {
  NOT_CONFIGURED: { status: 503, message: 'Databricks is not configured on the server. Set the DATABRICKS_* variables in backend/.env.' },
  AUTH: { status: 502, message: 'Databricks rejected the server credentials.' },
  HTTP: { status: 502, message: 'Databricks API request failed.' },
  NETWORK: { status: 504, message: 'Could not reach Databricks.' },
  FAILED: { status: 502, message: 'The Databricks query failed.' },
  CANCELED: { status: 502, message: 'The Databricks query was canceled.' },
  CLOSED: { status: 502, message: 'The Databricks query result is no longer available.' },
  TIMEOUT: { status: 504, message: 'The Databricks query timed out.' },
  TABLE_NOT_FOUND: { status: 502, message: 'A required Databricks table was not found or is not accessible.' },
  BAD_RESPONSE: { status: 502, message: 'Unexpected response from Databricks.' },
}

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ErrorResponse = { error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } }
  res.status(404).json(body)
}

export function errorHandler(exposeProviderDetails: boolean): ErrorRequestHandler {
  return (err, req, res, _next) => {
    const requestId = res.locals.requestId as string | undefined
    let status = 500
    let body: ErrorResponse['error'] = { code: 'INTERNAL', message: 'Internal server error', requestId }

    if (err instanceof ZodError) {
      status = 400
      body = {
        code: 'BAD_REQUEST',
        message: 'Invalid request parameters',
        details: err.issues.map((i) => ({ param: i.path.join('.'), message: i.message })),
        requestId,
      }
    } else if (err instanceof AppError) {
      status = err.status
      body = { code: err.code, message: err.message, details: err.details, requestId }
    } else if (err instanceof DatabricksError) {
      const m = DATABRICKS_STATUS[err.code]
      status = m.status
      body = {
        code: `DATABRICKS_${err.code}`,
        message: m.message,
        // Databricks' own error text can help debugging locally; hidden in production.
        details: exposeProviderDetails && (err.opts.providerMessage || err.opts.providerCode)
          ? { providerCode: err.opts.providerCode, providerMessage: err.opts.providerMessage?.slice(0, 600) }
          : undefined,
        requestId,
      }
    }

    // Log without query strings, headers or bodies (no secrets, no user input).
    const tag = err instanceof DatabricksError ? `${err.code}${err.opts.statementId ? ` ${err.opts.statementId}` : ''}` : (err as Error)?.name
    console.error(`[error] ${requestId ?? '-'} ${req.method} ${req.path} → ${status} ${body.code} (${tag}): ${(err as Error)?.message ?? err}`)
    if (status >= 500 && !(err instanceof DatabricksError) && !(err instanceof AppError)) console.error((err as Error)?.stack)

    res.status(status).json({ error: body } satisfies ErrorResponse)
  }
}
