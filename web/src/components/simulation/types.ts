/**
 * Extension points for the future simulation engine. The page renders these
 * when present, so 3D well models, animations and ML predictions can be added
 * without restructuring the workspace.
 */
import type { Map as MapboxMap } from 'mapbox-gl'
import type { Well } from '../../types/well'

export interface SimulationScenario {
  id: string
  name: string
  injectorUwi: string
  /** Injection rate schedule; units m³/d. */
  injectionRateM3d: number
  startDate: string
  endDate: string
}

export interface SimulationResult {
  scenarioId: string
  /** Forecast series per producer UWI. Populated by the engine/ML service. */
  forecasts: Record<string, Array<{ date: string; oilM3: number }>>
}

/** A map overlay plugin: adds/removes its own sources & layers on the map. */
export interface SimulationOverlay {
  id: string
  attach: (map: MapboxMap, ctx: { selectedInjector: Well | null; nearbyProducers: Well[] }) => void
  detach: (map: MapboxMap) => void
}

/** Engine contract — implement when the simulation backend is ready. */
export interface SimulationEngine {
  run: (scenario: SimulationScenario) => Promise<SimulationResult>
}

/**
 * No engine yet: callers must handle `null`. When a Databricks Model Serving
 * endpoint exists, implement this by calling the backend's
 * `POST /api/simulation/run` (backend/src/services/modelServing.ts), which
 * currently answers 501 INFERENCE_NOT_CONNECTED. The browser never calls
 * Databricks directly.
 */
export const simulationEngine: SimulationEngine | null = null
