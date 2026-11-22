export const env = {
  mapboxToken: (import.meta.env.VITE_MAPBOX_TOKEN ?? '').trim(),
  wellsUrl: import.meta.env.VITE_WELLS_URL || '/data/wells.geojson',
}

export const hasMapboxToken = env.mapboxToken.startsWith('pk.')
