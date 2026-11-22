import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchWells, type WellsLoadResult } from '../data/wellsService'
import type { Well } from '../types/well'

type WellsState =
  | ({ status: 'loading'; error: null } & Empty)
  | ({ status: 'ready'; error: null } & WellsLoadResult)
  | ({ status: 'error'; error: string } & Empty)

type Empty = { wells: Well[]; collection: null; source: null; metadata: null; fallbackReason: null }
const EMPTY: Empty = { wells: [], collection: null, source: null, metadata: null, fallbackReason: null }

const WellsContext = createContext<(WellsState & { reload: () => void }) | null>(null)

/** Loads wells once and shares them across pages (Explorer, Analytics, Simulation). */
export function WellsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WellsState>({ status: 'loading', error: null, ...EMPTY })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading', error: null, ...EMPTY })
    fetchWells(ctrl.signal)
      .then((r) => setState({ status: 'ready', error: null, ...r }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ status: 'error', error: e instanceof Error ? e.message : String(e), ...EMPTY })
      })
    return () => ctrl.abort()
  }, [nonce])

  return <WellsContext.Provider value={{ ...state, reload: () => setNonce((n) => n + 1) }}>{children}</WellsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWells() {
  const ctx = useContext(WellsContext)
  if (!ctx) throw new Error('useWells must be used inside <WellsProvider>')
  return ctx
}
