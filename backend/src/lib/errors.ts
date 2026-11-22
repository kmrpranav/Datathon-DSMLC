/** Error with an HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra, non-sensitive context returned to clients. */
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type DatabricksErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH'
  | 'HTTP'
  | 'NETWORK'
  | 'FAILED'
  | 'CANCELED'
  | 'CLOSED'
  | 'TIMEOUT'
  | 'TABLE_NOT_FOUND'
  | 'BAD_RESPONSE'

/**
 * Failure while talking to Databricks. `message` is safe to log (it never
 * contains the token); `providerMessage` is Databricks' own error text, which
 * is only returned to clients outside production.
 */
export class DatabricksError extends Error {
  constructor(
    public readonly code: DatabricksErrorCode,
    message: string,
    public readonly opts: { httpStatus?: number; statementId?: string; providerCode?: string; providerMessage?: string } = {},
  ) {
    super(message)
    this.name = 'DatabricksError'
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`)
export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details)
