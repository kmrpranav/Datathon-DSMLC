/**
 * Filtering and aggregation for the Analytics page. Pure functions over the
 * GET /api/analytics dataset, so every chart and table reads the same
 * filtered rows. Nothing here fills in missing values.
 */
import type { AnalyticsCandidate, AnalyticsWell } from '../api/types'

export type RoleFilter = 'all' | 'injected' | 'produced' | 'dual' | 'neither'
export type ClassFilter = 'all' | 'none' | string

export interface AnalyticsFilters {
  area: string
  role: RoleFilter
  perf: ClassFilter
  search: string
}
export const DEFAULT_FILTERS: AnalyticsFilters = { area: 'all', role: 'all', perf: 'all', search: '' }

export const ROLE_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All wells' },
  { value: 'injected', label: 'Has injected' },
  { value: 'produced', label: 'Has produced' },
  { value: 'dual', label: 'Both (dual-role)' },
  { value: 'neither', label: 'Neither recorded' },
]

/** Canonical class order; any other labels in the data follow alphabetically. */
const CLASS_ORDER = ['good', 'moderate', 'low']
export const classSort = (a: string, b: string) => {
  const ia = CLASS_ORDER.indexOf(a.toLowerCase())
  const ib = CLASS_ORDER.indexOf(b.toLowerCase())
  return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) || a.localeCompare(b)
}

export const NOT_CLASSIFIED = 'Not classified'
export const classOf = (w: AnalyticsWell) => w.performance?.class ?? null

export function matchesRole(w: AnalyticsWell, role: RoleFilter) {
  switch (role) {
    case 'injected': return w.hasInjected === true
    case 'produced': return w.hasProduced === true
    case 'dual': return w.dualRole
    case 'neither': return w.hasInjected !== true && w.hasProduced !== true
    default: return true
  }
}

export function filterWells(wells: AnalyticsWell[], f: AnalyticsFilters) {
  const q = f.search.trim().toLowerCase()
  return wells.filter((w) => {
    if (f.area !== 'all' && w.area !== f.area) return false
    if (!matchesRole(w, f.role)) return false
    if (f.perf === 'none' ? classOf(w) !== null : f.perf !== 'all' && classOf(w) !== f.perf) return false
    if (q && !w.uwi.toLowerCase().includes(q) && !(w.wellName ?? '').toLowerCase().includes(q)) return false
    return true
  })
}

/** Candidates whose well passes the same filters (joined by UWI). */
export function filterCandidates(candidates: AnalyticsCandidate[], filteredWells: AnalyticsWell[]) {
  const keep = new Set(filteredWells.map((w) => w.uwi))
  return candidates.filter((c) => keep.has(c.uwi))
}

export function kpis(wells: AnalyticsWell[]) {
  let injected = 0
  let produced = 0
  let dual = 0
  let classified = 0
  let low = 0
  for (const w of wells) {
    if (w.hasInjected) injected++
    if (w.hasProduced) produced++
    if (w.dualRole) dual++
    const c = classOf(w)
    if (c) {
      classified++
      if (c.toLowerCase() === 'low') low++
    }
  }
  // `wells` is already one row per UWI, so dual-role wells count once here.
  return { total: wells.length, injected, produced, dual, classified, low }
}

export function classCounts(wells: AnalyticsWell[]) {
  const m = new Map<string, number>()
  for (const w of wells) {
    const c = classOf(w)
    if (c) m.set(c, (m.get(c) ?? 0) + 1)
  }
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => classSort(a.name, b.name))
}

/** Per-area class counts (only wells with a performance row). */
export function classByArea(wells: AnalyticsWell[]) {
  const rows = new Map<string, Record<string, number>>()
  const classes = new Set<string>()
  for (const w of wells) {
    const c = classOf(w)
    if (!c) continue
    classes.add(c)
    const area = w.area ?? 'Area not recorded'
    const r = rows.get(area) ?? {}
    r[c] = (r[c] ?? 0) + 1
    rows.set(area, r)
  }
  const cls = [...classes].sort(classSort)
  const data = [...rows].map(([area, counts]) => {
    const total = cls.reduce((s, c) => s + (counts[c] ?? 0), 0)
    return { area, total, ...Object.fromEntries(cls.map((c) => [c, counts[c] ?? 0])) } as { area: string; total: number } & Record<string, number>
  })
  data.sort((a, b) => b.total - a.total || a.area.localeCompare(b.area))
  return { classes: cls, data }
}

/** Historical role mix per area. Each well counts in exactly one bucket. */
export function rolesByArea(wells: AnalyticsWell[]) {
  const rows = new Map<string, { area: string; producedOnly: number; injectedOnly: number; dual: number; neither: number; total: number }>()
  for (const w of wells) {
    const area = w.area ?? 'Area not recorded'
    const r = rows.get(area) ?? { area, producedOnly: 0, injectedOnly: 0, dual: 0, neither: 0, total: 0 }
    if (w.dualRole) r.dual++
    else if (w.hasProduced) r.producedOnly++
    else if (w.hasInjected) r.injectedOnly++
    else r.neither++
    r.total++
    rows.set(area, r)
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.area.localeCompare(b.area))
}

/** Per-area cumulative totals (wells with a null total are skipped and counted). */
export function areaTotals(wells: AnalyticsWell[]) {
  const rows = new Map<string, { area: string; oil: number; inj: number; wells: number; injectors: number; producers: number; missing: number }>()
  for (const w of wells) {
    const area = w.area ?? 'Area not recorded'
    const r = rows.get(area) ?? { area, oil: 0, inj: 0, wells: 0, injectors: 0, producers: 0, missing: 0 }
    r.wells++
    if (w.hasInjected) r.injectors++
    if (w.hasProduced) r.producers++
    if (w.totalOilM3 === null || w.totalInjM3 === null) r.missing++
    r.oil += w.totalOilM3 ?? 0
    r.inj += w.totalInjM3 ?? 0
    rows.set(area, r)
  }
  return [...rows.values()]
}

export type SortDir = 'asc' | 'desc'
/** Sort with nulls last in both directions. */
export function sortBy<T>(rows: T[], get: (r: T) => string | number | null | undefined, dir: SortDir) {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return sign * (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true }))
  })
}

const quantile = (sorted: number[], q: number) => {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/** Median and quartiles of the 13-week oil rate per area (wells with a value only). */
export function oilRateByArea(wells: AnalyticsWell[]) {
  const m = new Map<string, number[]>()
  for (const w of wells) {
    const v = w.performance?.oilRate13w
    if (v == null) continue
    const area = w.area ?? 'Area not recorded'
    m.set(area, [...(m.get(area) ?? []), v])
  }
  return [...m]
    .map(([area, xs]) => {
      const s = [...xs].sort((a, b) => a - b)
      return { area, n: s.length, median: quantile(s, 0.5), q1: quantile(s, 0.25), q3: quantile(s, 0.75) }
    })
    .sort((a, b) => b.median - a.median)
}
