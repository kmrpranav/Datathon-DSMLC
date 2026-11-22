import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchWells } from '../data/wellsService'
import type { Well, WellFeatureCollection } from '../types/well'

type WellsState =
  | { status: 'loading'; wells: Well[]; collection: null; error: null }
  | { status: 'ready'; wells: Well[]; collection: WellFeatureCollection; error: null }
  | { status: 'error'; wells: Well[]; collection: null; error: string }

const WellsContext = createContext<(WellsState & { reload: () => void }) | null>(null)

/** Loads wells once and shares them across pages (Explorer, Analytics, Simulation). */
export function WellsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WellsState>({ status: 'loading', wells: [], collection: null, error: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading', wells: [], collection: null, error: null })
    fetchWells(ctrl.signal)
      .then(({ wells, collection }) => setState({ status: 'ready', wells, collection, error: null }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ status: 'error', wells: [], collection: null, error: e instanceof Error ? e.message : String(e) })
      })
    return () => ctrl.abort()
  }, [nonce])

  return <WellsContext.Provider value={{ ...state, reload: () => setNonce((n) => n + 1) }}>{children}</WellsContext.Provider>
}

export function useWells() {
  const ctx = useContext(WellsContext)
  if (!ctx) throw new Error('useWells must be used inside <WellsProvider>')
  return ctx
}
