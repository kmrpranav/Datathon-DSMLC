import { env } from '../config/env'
import { floodiqApi } from '../api/floodiq'
import { ApiError } from '../api/client'
import type { Well, WellFeatureCollection, WellRoles, WellsMetadata, WellSource } from '../types/well'

export interface WellsLoadResult {
  wells: Well[]
  collection: WellFeatureCollection
  source: WellSource
  metadata: WellsMetadata
  /** Why the local snapshot is shown instead of Databricks data. */
  fallbackReason: string | null
}

/**
 * Data-access layer for wells. Components never fetch directly — they go
 * through `useWells()`. Loads from the FloodIQ API (Databricks); if the backend
 * is down or not configured, falls back to the local parquet snapshot and says so.
 */
export async function fetchWells(signal?: AbortSignal): Promise<WellsLoadResult> {
  try {
    const collection = await floodiqApi.wells(signal)
    return { ...toWells(collection), collection, source: 'databricks', metadata: collection.metadata ?? {}, fallbackReason: null }
  } catch (e) {
    if (signal?.aborted) throw e
    // Only fall back when the backend is unavailable; real API errors (bad schema, auth) surface as errors.
    if (!(e instanceof ApiError) || !e.unavailable) throw e
    const res = await fetch(env.wellsUrl, { signal })
    if (!res.ok) throw new Error(`Failed to load wells (${res.status} ${res.statusText})`)
    const collection = (await res.json()) as WellFeatureCollection
    return { ...toWells(collection), collection, source: 'static', metadata: collection.metadata ?? {}, fallbackReason: e.message }
  }
}

function toWells(collection: WellFeatureCollection): { wells: Well[] } {
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('Wells source did not return a GeoJSON FeatureCollection')
  }
  const wells: Well[] = collection.features.map((f) => {
    const p = f.properties
    const roles: WellRoles = p.roles ?? {
      currentRole: p.wellType,
      currentRoleSource: null,
      hasProducedHistorically: p.wellType === 'production' ? true : null,
      hasInjectedHistorically: p.wellType === 'injection' ? true : null,
      dualRole: false,
    }
    return {
      ...p,
      formattedUwi: p.formattedUwi ?? null,
      wellName: p.wellName ?? null,
      province: p.province ?? null,
      operatingArea: p.operatingArea ?? null,
      flowDirection: p.flowDirection ?? null,
      status: p.status ?? null,
      performanceClass: p.performanceClass ?? null,
      metrics: p.metrics ?? {},
      roles,
      id: f.id,
      longitude: f.geometry.coordinates[0],
      latitude: f.geometry.coordinates[1],
    }
  })
  return { wells }
}
