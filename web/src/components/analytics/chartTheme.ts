/** Recharts styling and number formats shared by the Analytics charts. */
import { colors } from '../../config/theme'

export const axisTick = { fill: colors.muted, fontSize: 11.5 }
export const axisLabel = { fill: colors.muted, fontSize: 11.5 }
export const gridProps = { stroke: colors.line, strokeDasharray: '3 4' }
export const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: `1px solid ${colors.line}`, fontSize: 12, boxShadow: '0 6px 20px rgb(41 39 36 / 0.08)', padding: '8px 10px' },
  labelStyle: { color: colors.ink, fontWeight: 600, marginBottom: 2 },
  itemStyle: { padding: 0 },
}

const nf = (d: number) => new Intl.NumberFormat('en-CA', { maximumFractionDigits: d })
export const fmt = {
  int: (v: number | null | undefined) => (v == null ? '—' : nf(0).format(v)),
  num: (v: number | null | undefined, d = 2) => (v == null ? '—' : nf(d).format(v)),
  pct: (v: number | null | undefined, d = 0) => (v == null ? '—' : `${nf(d).format(v * 100)}%`),
  cad: (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(v)),
  compact: (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(v)),
}
