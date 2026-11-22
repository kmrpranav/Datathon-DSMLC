import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import mapboxgl from 'mapbox-gl'
import { BaseMap } from './BaseMap'
import { colors } from '../../config/theme'
import type { Well } from '../../types/well'
import { boundsOf, wellsToGeoJSON } from '../../lib/wellFilters'

const SRC = 'wells'
const L = {
  clusters: 'wells-clusters',
  clusterCount: 'wells-cluster-count',
  points: 'wells-points',
  hover: 'wells-hover',
  selectedHalo: 'wells-selected-halo',
  selected: 'wells-selected',
} as const
const NONE = ['==', ['get', 'id'], -1] as mapboxgl.FilterSpecification
const byId = (id: number) => ['==', ['get', 'id'], id] as mapboxgl.FilterSpecification

const typeColor: mapboxgl.ExpressionSpecification = [
  'match', ['get', 'wellType'],
  'injection', colors.injection,
  'production', colors.production,
  colors.unknown,
]

interface WellsMapProps {
  wells: Well[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  /** Change this value to re-fit the camera to the current `wells` (e.g. after filtering). */
  fitKey: string
  className?: string
  children?: ReactNode
}

function addWellLayers(map: mapboxgl.Map, data: GeoJSON.FeatureCollection) {
  map.addSource(SRC, {
    type: 'geojson',
    data,
    cluster: true,
    clusterMaxZoom: 10,
    clusterRadius: 42,
    clusterProperties: { inj: ['+', ['case', ['==', ['get', 'wellType'], 'injection'], 1, 0]] },
  })

  map.addLayer({
    id: L.clusters,
    type: 'circle',
    source: SRC,
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#FFFFFF',
      'circle-opacity': 0.94,
      'circle-radius': ['step', ['get', 'point_count'], 14, 25, 18, 100, 23, 400, 29],
      // Ring colour blends brown → light blue by share of injection wells in the cluster.
      'circle-stroke-color': ['interpolate', ['linear'], ['/', ['get', 'inj'], ['get', 'point_count']], 0, colors.production, 0.5, '#9DA9B0', 1, colors.injection],
      'circle-stroke-width': 3,
    },
  })
  map.addLayer({
    id: L.clusterCount,
    type: 'symbol',
    source: SRC,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': colors.ink },
  })
  map.addLayer({
    id: L.points,
    type: 'circle',
    source: SRC,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': typeColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 10, 5, 14, 7.5],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 1.6],
    },
  })
  map.addLayer({
    id: L.hover,
    type: 'circle',
    source: SRC,
    filter: NONE,
    paint: {
      'circle-color': typeColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 6, 14, 10.5],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2.5,
    },
  })
  map.addLayer({
    id: L.selectedHalo,
    type: 'circle',
    source: SRC,
    filter: NONE,
    paint: {
      'circle-color': colors.primary,
      'circle-opacity': 0.16,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 14, 14, 22],
      'circle-stroke-color': colors.primary,
      'circle-stroke-width': 1.5,
      'circle-stroke-opacity': 0.55,
    },
  })
  map.addLayer({
    id: L.selected,
    type: 'circle',
    source: SRC,
    filter: NONE,
    paint: {
      'circle-color': typeColor,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 7, 14, 11],
      'circle-stroke-color': colors.primary,
      'circle-stroke-width': 3,
    },
  })
}

/**
 * Well map using a clustered GeoJSON source + WebGL circle layers
 * (no DOM markers), so ~3,000 wells render smoothly.
 */
export function WellsMap({ wells, selectedId, onSelect, fitKey, className, children }: WellsMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [ready, setReady] = useState(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const wellsRef = useRef(wells)
  wellsRef.current = wells

  const handleLoad = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map
    addWellLayers(map, wellsToGeoJSON(wellsRef.current))

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: '260px' })
    let hoverId: number | null = null

    map.on('mousemove', L.points, (e) => {
      const f = e.features?.[0]
      if (!f) return
      const id = f.properties?.id as number
      map.getCanvas().style.cursor = 'pointer'
      if (id === hoverId) return
      hoverId = id
      map.setFilter(L.hover, byId(id))
      const name = (f.properties?.wellName as string) || (f.properties?.uwi as string)
      const type = f.properties?.wellType as string
      const el = document.createElement('div')
      el.className = 'text-[12px] leading-snug'
      const title = document.createElement('div')
      title.className = 'font-semibold text-[#292724]'
      title.textContent = name
      const sub = document.createElement('div')
      sub.className = 'text-[#817B73] capitalize'
      sub.textContent = type === 'unknown' ? 'Unclassified well' : `${type} well`
      el.append(title, sub)
      popup.setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).setDOMContent(el).addTo(map)
    })
    map.on('mouseleave', L.points, () => {
      hoverId = null
      map.getCanvas().style.cursor = ''
      map.setFilter(L.hover, NONE)
      popup.remove()
    })
    map.on('mouseenter', L.clusters, () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', L.clusters, () => (map.getCanvas().style.cursor = ''))

    map.on('click', L.clusters, (e) => {
      const f = e.features?.[0]
      if (!f) return
      const src = map.getSource(SRC) as mapboxgl.GeoJSONSource
      src.getClusterExpansionZoom(f.properties?.cluster_id, (err, zoom) => {
        if (err || zoom == null) return
        map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.3, duration: 600 })
      })
    })
    map.on('click', L.points, (e) => {
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'number') onSelectRef.current(id)
    })
    map.on('click', (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [L.points, L.clusters] })
      if (!hits.length) onSelectRef.current(null)
    })
    setReady(true)
  }, [])

  // Push filtered data to the source.
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const src = mapRef.current.getSource(SRC) as mapboxgl.GeoJSONSource | undefined
    src?.setData(wellsToGeoJSON(wells))
  }, [wells, ready])

  // Fit camera when filters change.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const b = boundsOf(wellsRef.current)
    if (!b) return
    const single = b[0][0] === b[1][0] && b[0][1] === b[1][1]
    if (single) map.flyTo({ center: b[0], zoom: 13, duration: 900 })
    else map.fitBounds(b, { padding: { top: 60, bottom: 60, left: 60, right: 60 }, maxZoom: 13, duration: 900 })
  }, [fitKey, ready])

  // Highlight + fly to selection.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const filter = selectedId == null ? NONE : byId(selectedId)
    map.setFilter(L.selected, filter)
    map.setFilter(L.selectedHalo, filter)
    if (selectedId == null) return
    const w = wellsRef.current.find((x) => x.id === selectedId)
    if (!w) return
    // Shift the target left on wide screens so the info panel doesn't cover the well.
    // Match the panel's breakpoint (md = viewport ≥ 768px docks it on the right, 340px wide).
    const docked = window.matchMedia('(min-width: 768px)').matches
    const offset: [number, number] = docked ? [-Math.min(176, map.getContainer().clientWidth / 2 - 40), 0] : [0, -80]
    map.flyTo({ center: [w.longitude, w.latitude], zoom: Math.max(map.getZoom(), 13), offset, duration: 1100, essential: true })
  }, [selectedId, ready])

  return (
    <BaseMap className={className} onLoad={handleLoad} ariaLabel="Well locations map">
      {children}
    </BaseMap>
  )
}

