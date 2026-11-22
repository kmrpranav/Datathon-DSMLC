/**
 * Boundary for a future Databricks Model Serving endpoint
 * (POST {host}/serving-endpoints/{name}/invocations).
 *
 * Nothing is deployed in this phase, so the default client reports
 * "not connected" and the API answers 501 instead of fabricating output.
 */
export interface SimulationRequest {
  injectorUwi: string
  /** Proposed injection rate, m³/d. */
  injectionRateM3d?: number
  producerUwis?: string[]
  horizonDays?: number
}

export interface SimulationPrediction {
  modelName: string
  modelVersion: string
  generatedAt: string
  predictions: Array<{ producerUwi: string; date: string; oilM3: number }>
}

export interface ModelServingClient {
  readonly connected: boolean
  readonly description: string
  predict(req: SimulationRequest): Promise<SimulationPrediction>
}

export const unconfiguredModelServing: ModelServingClient = {
  connected: false,
  description: 'Live model inference is not connected. Saved ranking and economics tables are available instead.',
  async predict() {
    throw new Error('Model Serving endpoint not configured')
  },
}
