import { useEffect, useRef, useState, type ReactNode } from 'react'
import mapboxgl from 'mapbox-gl'
import clsx from 'clsx'
import { MapPinOff } from 'lucide-react'
import { env, hasMapboxToken } from '../../config/env'
import { mapStyle } from '../../config/theme'
import { LoadingState } from '../ui/States'

/** Alberta-centred default framing (used until data-driven bounds are applied). */
export const ALBERTA_BOUNDS: [[number, number], [number, number]] = [[-120.0, 49.0], [-110.0, 60.0]]
/** Loose pan limits around western Canada so users can explore every well without getting lost. */
const MAX_BOUNDS: [[number, number], [number, number]] = [[-140, 41], [-90, 66]]

export interface BaseMapProps {
  className?: string
  initialBounds?: [[number, number], [number, number]]
  onLoad?: (map: mapboxgl.Map) => void
  /** React overlays rendered on top of the canvas (legends, panels, toolbars). */
  children?: ReactNode
  ariaLabel?: string
}

/**
 * Thin, reusable Mapbox wrapper. Owns map lifecycle, controls and
 * loading/empty states. Feature layers are added by callers via `onLoad`.
 */
export function BaseMap({ className, initialBounds = ALBERTA_BOUNDS, onLoad, children, ariaLabel = 'Map' }: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onLoadRef = useRef(onLoad)
  onLoadRef.current = onLoad
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasMapboxToken || !containerRef.current) return
    mapboxgl.accessToken = env.mapboxToken
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle.url,
      bounds: initialBounds,
      fitBoundsOptions: { padding: 40 },
      maxBounds: MAX_BOUNDS,
      attributionControl: false,
      cooperativeGestures: false,
      projection: 'mercator',
    })
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-left')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      setLoaded(true)
      onLoadRef.current?.(map)
    })
    map.on('error', (e) => {
      const msg = (e.error as Error | undefined)?.message ?? ''
      if (/access token|401|403|Unauthorized|Forbidden/i.test(msg)) setError('Mapbox rejected the access token. Check VITE_MAPBOX_TOKEN.')
    })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(containerRef.current)
    return () => {
      ro.disconnect()
      map.remove()
      setLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={clsx('relative overflow-hidden bg-[#E9EEDF]', className)} role="region" aria-label={ariaLabel}>
      {hasMapboxToken ? (
        <>
          {/* Mapbox's unlayered CSS sets `.mapboxgl-map { position: relative }`, which beats
              Tailwind utilities — so position the wrapper, and size the map container by height. */}
          <div className="absolute inset-0">
            <div ref={containerRef} className="h-full w-full" />
          </div>
          {!loaded && !error && <LoadingState label="Loading map…" className="absolute inset-0 bg-[#E9EEDF]" />}
          {error && <MapNotice title="Map could not load" body={error} />}
          {loaded && children}
        </>
      ) : (
        <MapNotice
          title="Mapbox token required"
          body={
            <>
              Add a public token as <code className="rounded bg-[#F3EFE8] px-1 py-0.5 text-[12px] text-ink">VITE_MAPBOX_TOKEN</code> in{' '}
              <code className="rounded bg-[#F3EFE8] px-1 py-0.5 text-[12px] text-ink">web/.env.local</code>, then restart the dev server.
            </>
          }
        />
      )}
    </div>
  )
}

function MapNotice({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center p-6">
      <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(#C9DCB8_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="relative max-w-sm rounded-2xl border border-line bg-surface/95 p-6 text-center shadow-soft">
        <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-[#F3EFE8] text-muted">
          <MapPinOff className="size-5" />
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  )
}
