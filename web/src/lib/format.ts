import type { ProvinceCode, WellType } from '../types/well'

export const PROVINCE_NAMES: Record<ProvinceCode, string> = {
  AB: 'Alberta',
  SK: 'Saskatchewan',
  BC: 'British Columbia',
}

export const WELL_TYPE_LABELS: Record<WellType, string> = {
  injection: 'Injection',
  production: 'Production',
  unknown: 'Unclassified',
}

export function provinceName(code: string | null | undefined) {
  if (!code) return 'Not recorded'
  return PROVINCE_NAMES[code as ProvinceCode] ?? code
}

const numFmt = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 2 })
export function formatNumber(v: number | null | undefined, unit?: string) {
  if (v === null || v === undefined || Number.isNaN(v)) return null
  return unit ? `${numFmt.format(v)} ${unit}` : numFmt.format(v)
}

export function formatCompact(v: number) {
  return new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 2 }).format(v)
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  const d = new Date(`${iso}T00:00:00`)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatCoord(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`
}

/** "cum_oil_m3" → "Cum oil (m³)". Keeps the real column recognisable. */
export function prettyColumn(name: string) {
  const units: Array<[RegExp, string]> = [[/_m3d$/i, ' (m³/d)'], [/_m3$/i, ' (m³)'], [/_e3m3$/i, ' (e³m³)'], [/_pct$/i, ' (%)'], [/_kpa$/i, ' (kPa)'], [/_km$/i, ' (km)'], [/_m$/i, ' (m)'], [/_cad$/i, ' (CAD)'], [/_usd$/i, ' (USD)']]
  let unit = ''
  let base = name
  for (const [re, u] of units) {
    if (re.test(base)) {
      unit = u
      base = base.replace(re, '')
      break
    }
  }
  const words = base.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase()
  return (words.charAt(0).toUpperCase() + words.slice(1) + unit).replace(/\buwi\b/gi, 'UWI').replace(/\bnpv\b/gi, 'NPV').replace(/\bid\b/gi, 'ID')
}

/** Display any API cell value without inventing anything: null → null (caller shows "—"). */
export function formatCell(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? (Math.abs(v) >= 1e6 ? formatCompact(v) : numFmt.format(v)) : null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v)
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return formatDate(v.slice(0, 10))
    return v
  }
  return JSON.stringify(v)
}
