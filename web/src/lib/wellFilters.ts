import type { Well, WellFilters } from '../types/well'

export function filterWells(wells: Well[], f: WellFilters): Well[] {
  const q = f.search.trim().toLowerCase()
  return wells.filter((w) => {
    if (f.province !== 'all' && w.province !== f.province) return false
    if (f.operatingArea !== 'all' && w.operatingArea !== f.operatingArea) return false
    if (f.wellType !== 'all' && w.wellType !== f.wellType) return false
    if (q) {
      const hay = `${w.uwi} ${w.formattedUwi ?? ''} ${w.wellName ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export function operatingAreasFor(wells: Well[], province: WellFilters['province']): string[] {
  const set = new Set<string>()
  for (const w of wells) {
    if (province !== 'all' && w.province !== province) continue
    if (w.operatingArea) set.add(w.operatingArea)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

export function wellsToGeoJSON(wells: Well[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: wells.map((w) => ({
      type: 'Feature',
      id: w.id,
      geometry: { type: 'Point', coordinates: [w.longitude, w.latitude] },
      properties: { id: w.id, uwi: w.uwi, wellName: w.wellName, wellType: w.wellType },
    })),
  }
}

export function boundsOf(wells: Well[]): [[number, number], [number, number]] | null {
  if (!wells.length) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const w of wells) {
    if (w.longitude < minX) minX = w.longitude
    if (w.longitude > maxX) maxX = w.longitude
    if (w.latitude < minY) minY = w.latitude
    if (w.latitude > maxY) maxY = w.latitude
  }
  return [[minX, minY], [maxX, maxY]]
}
