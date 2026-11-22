import { env } from '../config/env'

/** Error returned by the FloodIQ API (`{ error: { code, message } }`) or the network. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
  /** Backend unreachable, a data file missing, or Databricks not configured — callers may fall back. */
  get unavailable() {
    return this.status === 0 || this.status === 503 || this.code === 'DATABRICKS_NOT_CONFIGURED'
  }
}

type Params = Record<string, string | number | undefined | null>

/** GET helper. All data access goes through the backend — no credentials in the browser. */
export async function apiGet<T>(path: string, params: Params = {}, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const url = `${env.apiUrl}${path}${qs.size ? `?${qs}` : ''}`
  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if (signal?.aborted) throw e
    throw new ApiError(0, 'NETWORK', 'Could not reach the FloodIQ API. Is the backend running?')
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    // The Vite proxy answers 502/504 with no JSON when the backend is down.
    if (!body?.error) throw new ApiError(res.status >= 500 ? 0 : res.status, 'UNAVAILABLE', 'The FloodIQ API is not responding. Is the backend running?')
    throw new ApiError(res.status, body.error.code ?? 'ERROR', body.error.message ?? `Request failed (${res.status})`, body.error.details)
  }
  return body as T
}
