export const env = {
  mapboxToken: (import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim(),
  /** FloodIQ backend origin. Empty = same origin (`/api` is proxied to the backend by Vite in dev). */
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
  /** Local parquet-derived snapshot used only when the backend is unavailable. */
  wellsUrl: import.meta.env.VITE_WELLS_URL || '/data/wells.geojson',
}

export const hasMapboxToken = env.mapboxToken.startsWith('pk.')
