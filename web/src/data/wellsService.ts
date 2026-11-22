import { env } from '../config/env'
import type { Well, WellFeatureCollection } from '../types/well'

/**
 * Data-access layer for wells. Components never fetch directly — they go
 * through `useWells()`, which calls this service. Swap `env.wellsUrl` to a
 * backend endpoint (same GeoJSON shape) to move off the static file.
 */
export async function fetchWells(signal?: AbortSignal): Promise<{ wells: Well[]; collection: WellFeatureCollection }> {
  const res = await fetch(env.wellsUrl, { signal })
  if (!res.ok) throw new Error(`Failed to load wells (${res.status} ${res.statusText})`)
  const collection = (await res.json()) as WellFeatureCollection
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('Wells source did not return a GeoJSON FeatureCollection')
  }
  const wells: Well[] = collection.features.map((f) => ({
    ...f.properties,
    id: f.id,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
  }))
  return { wells, collection }
}
