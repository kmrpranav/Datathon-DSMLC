import type { Well, WellFilters } from '../types/well'

export function filterWells(wells: Well[], f: WellFilters): Well[] {
  const q = f.search.trim().toLowerCase()
  return wells.filter((w) => {
    if (f.province !== 'all' && w.province !== f.province) return false
    if (f.operatingArea !== 'all' && w.operatingArea !== f.operatingArea) return false
    if (f.wellType === 'dual' ? !w.roles.dualRole : f.wellType !== 'all' && w.wellType !== f.wellType) return false
    if (f.performance !== 'all' && w.performanceClass !== f.performance) return false
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
      properties: { id: w.id, uwi: w.uwi, wellName: w.wellName, wellType: w.wellType, dual: w.roles.dualRole, performance: w.performanceClass },
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

const CLASS_RANK: Record<string, number> = { good: 0, high: 0, moderate: 1, medium: 1, low: 2, poor: 2 }
/** Distinct performance classes present in the data, Good → Moderate → Low first. */
export function performanceClassesFor(wells: Well[]): string[] {
  const set = new Set<string>()
  for (const w of wells) if (w.performanceClass) set.add(w.performanceClass)
  return [...set].sort((a, b) => (CLASS_RANK[a.toLowerCase()] ?? 9) - (CLASS_RANK[b.toLowerCase()] ?? 9) || a.localeCompare(b))
}
