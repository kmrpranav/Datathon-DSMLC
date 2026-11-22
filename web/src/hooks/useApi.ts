import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

export type ApiState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ready'; data: T; error: null }
  | { status: 'error'; data: null; error: ApiError }

/**
 * Fetch-on-mount hook with abort + retry. `key` re-runs the request when it
 * changes (e.g. serialized filters). Pass `enabled=false` to skip.
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>, key: string, enabled = true) {
  const [state, setState] = useState<ApiState<T>>({ status: 'loading', data: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    setState({ status: 'loading', data: null, error: null })
    fetcher(ctrl.signal)
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        const err = e instanceof ApiError ? e : new ApiError(0, 'ERROR', e instanceof Error ? e.message : String(e))
        setState({ status: 'error', data: null, error: err })
      })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, enabled])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, retry }
}
