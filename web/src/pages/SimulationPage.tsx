import { useCallback, useRef, useState } from 'react'
import type { Map as MapboxMap } from 'mapbox-gl'
import { FlaskConical, Layers, Play } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { BaseMap } from '../components/map/BaseMap'
import { SimulationInfoPanel } from '../components/simulation/SimulationInfoPanel'
import { simulationEngine, type SimulationOverlay } from '../components/simulation/types'

/** Overlays to attach once the engine exists (3D wells, flow animation, forecast heatmaps…). */
const OVERLAYS: SimulationOverlay[] = []

export default function SimulationPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const mapRef = useRef<MapboxMap | null>(null)

  const handleLoad = useCallback((map: MapboxMap) => {
    mapRef.current = map
    OVERLAYS.forEach((o) => o.attach(map, { selectedInjector: null, nearbyProducers: [] }))
  }, [])

  const run = () => {
    if (!simulationEngine) setModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Model"
        title="Waterflood Simulation"
        subtitle="Explore potential injection and production scenarios."
        actions={<Button size="lg" icon={<Play className="size-4 fill-current" />} onClick={run}>Run Simulation</Button>}
      />

      <div className="relative overflow-hidden rounded-2xl border border-line shadow-soft">
        <BaseMap className="h-[calc(100dvh-230px)] min-h-[480px]" onLoad={handleLoad} ariaLabel="Simulation workspace map">
          <SimulationInfoPanel className="absolute right-3 top-3 z-10 hidden w-[320px] lg:block" />
          <div className="absolute bottom-10 left-3 z-10 flex items-center gap-2 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[12px] text-muted shadow-soft">
            <Layers className="size-3.5" /> No scenario layers loaded
          </div>
        </BaseMap>
      </div>
      <SimulationInfoPanel className="lg:hidden" />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Simulation coming soon"
        icon={<FlaskConical className="size-5" />}
        footer={<Button onClick={() => setModalOpen(false)}>Got it</Button>}
      >
        The waterflood simulation engine hasn't been connected yet, so no results were generated. Once it's integrated you'll be able to select an
        injection well, configure scenarios, and compare forecasted production response here.
      </Modal>
    </div>
  )
}
