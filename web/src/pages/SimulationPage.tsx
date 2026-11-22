import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl'
import { FlaskConical, Layers, Play } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { BaseMap } from '../components/map/BaseMap'
import { SimulationInfoPanel } from '../components/simulation/SimulationInfoPanel'
import { SavedResultsPanel } from '../components/simulation/SavedResultsPanel'
import { simulationEngine, type SimulationOverlay } from '../components/simulation/types'
import { useApi } from '../hooks/useApi'
import { useWells } from '../hooks/useWells'
import { floodiqApi } from '../api/floodiq'
import { colors } from '../config/theme'

/** Overlays to attach once the engine exists (3D wells, flow animation, forecast heatmaps…). */
const OVERLAYS: SimulationOverlay[] = []
const RANK_SRC = 'saved-ranking'
const RANK_LIMIT = 25

export default function SimulationPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [showRanking, setShowRanking] = useState(false)
  const [selectedUwi, setSelectedUwi] = useState<string | null>(null)
  const [map, setMap] = useState<MapboxMap | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const { wells } = useWells()

  const ranking = useApi((s) => floodiqApi.conversionRanking({ limit: RANK_LIMIT }, s), 'sim-ranking')
  const economics = useApi((s) => floodiqApi.conversionEconomics({ limit: 1 }, s), 'sim-economics')
  const status = useApi((s) => floodiqApi.simulationStatus(s), 'sim-status')
  const liveInference = status.status === 'ready' && status.data.liveInference

  const handleLoad = useCallback((m: MapboxMap) => {
    mapRef.current = m
    setMap(m)
    OVERLAYS.forEach((o) => o.attach(m, { selectedInjector: null, nearbyProducers: [] }))
  }, [])

  // Saved ranking → map points (coordinates joined from the shared wells set by UWI).
  const rankingGeo = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    const empty: GeoJSON.FeatureCollection<GeoJSON.Point> = { type: 'FeatureCollection', features: [] }
    if (ranking.status !== 'ready') return empty
    const { rows, fields } = ranking.data
    const uwiCol = fields.uwi
    if (!uwiCol) return empty
    const byUwi = new Map(wells.map((w) => [w.uwi, w]))
    return {
      type: 'FeatureCollection',
      features: rows.flatMap((r, i) => {
        const w = byUwi.get(String(r[uwiCol]))
        if (!w) return []
        const rank = fields.rank && typeof r[fields.rank] === 'number' ? (r[fields.rank] as number) : i + 1
        return [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [w.longitude, w.latitude] }, properties: { uwi: w.uwi, rank, label: String(rank) } }]
      }),
    }
  }, [ranking, wells])

  useEffect(() => {
    if (!map) return
    const src = map.getSource(RANK_SRC) as GeoJSONSource | undefined
    if (!src) {
      map.addSource(RANK_SRC, { type: 'geojson', data: rankingGeo })
      map.addLayer({ id: 'saved-ranking-halo', type: 'circle', source: RANK_SRC, paint: { 'circle-radius': 15, 'circle-color': colors.primary, 'circle-opacity': 0.14 } })
      map.addLayer({ id: 'saved-ranking-dot', type: 'circle', source: RANK_SRC, paint: { 'circle-radius': 10, 'circle-color': '#FFFFFF', 'circle-stroke-color': colors.production, 'circle-stroke-width': 2.5 } })
      map.addLayer({
        id: 'saved-ranking-label', type: 'symbol', source: RANK_SRC,
        layout: { 'text-field': ['get', 'label'], 'text-size': 10.5, 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'], 'text-allow-overlap': true },
        paint: { 'text-color': colors.ink },
      })
    } else src.setData(rankingGeo)
    const vis = showRanking ? 'visible' : 'none'
    for (const id of ['saved-ranking-halo', 'saved-ranking-dot', 'saved-ranking-label']) map.setLayoutProperty(id, 'visibility', vis)
    if (showRanking && rankingGeo.features.length) {
      const xs = rankingGeo.features.map((f) => f.geometry.coordinates[0])
      const ys = rankingGeo.features.map((f) => f.geometry.coordinates[1])
      map.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 60, bottom: 60, left: 60, right: 380 }, maxZoom: 12, duration: 900 })
    }
  }, [map, rankingGeo, showRanking])

  const selectUwi = (uwi: string) => {
    setSelectedUwi(uwi)
    setShowRanking(true)
    const f = rankingGeo.features.find((x) => x.properties?.uwi === uwi)
    if (f && mapRef.current) mapRef.current.flyTo({ center: f.geometry.coordinates as [number, number], zoom: 13, offset: [-170, 0], duration: 900 })
  }

  const run = () => {
    if (!simulationEngine || !liveInference) setModalOpen(true)
  }
  const rankingAvailable = ranking.status === 'ready' && rankingGeo.features.length > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Model"
        title="Waterflood Simulation"
        subtitle="Explore potential injection and production scenarios. Saved conversion results can be shown on the map; live model inference is not connected yet."
        actions={<Button size="lg" icon={<Play className="size-4 fill-current" />} onClick={run}>Run Simulation</Button>}
      />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-soft">
        <BaseMap className="h-[calc(100dvh-230px)] min-h-[560px]" onLoad={handleLoad} ariaLabel="Simulation workspace map">
          <div className="absolute right-3 top-3 bottom-3 z-10 hidden w-[340px] flex-col gap-3 overflow-y-auto lg:flex">
            <SavedResultsPanel
              ranking={ranking}
              economics={economics}
              showOnMap={showRanking}
              onToggleMap={() => setShowRanking((v) => !v)}
              onSelectUwi={selectUwi}
              selectedUwi={selectedUwi}
            />
            <SimulationInfoPanel />
          </div>
          <div className="absolute bottom-10 left-3 z-10 flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[12px] text-muted shadow-soft">
            <Layers className="size-3.5" />
            {showRanking && rankingAvailable ? `Saved ranking: top ${rankingGeo.features.length} candidates` : 'No scenario layers loaded'}
          </div>
        </BaseMap>
      </div>
      <div className="flex flex-col gap-4 lg:hidden">
        <SavedResultsPanel ranking={ranking} economics={economics} showOnMap={showRanking} onToggleMap={() => setShowRanking((v) => !v)} onSelectUwi={selectUwi} selectedUwi={selectedUwi} />
        <SimulationInfoPanel />
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Live inference not connected"
        icon={<FlaskConical className="size-5" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Close</Button>
            {rankingAvailable && (
              <Button onClick={() => { setShowRanking(true); setModalOpen(false) }}>Load saved ranking</Button>
            )}
          </>
        }
      >
        No simulation was run and no new predictions were generated. The forecasting model isn't deployed to a serving endpoint yet. You can load the
        team's <span className="font-medium text-ink">saved conversion ranking</span> onto the map instead. Those results are model-generated
        estimates, not live inference.
      </Modal>
    </div>
  )
}
