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
