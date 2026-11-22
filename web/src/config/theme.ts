/** Design tokens shared by JS consumers (Mapbox paint, Recharts). Mirrors index.css @theme. */
export const colors = {
  canvas: '#F7F4EE',
  sidebar: '#F0EBE3',
  surface: '#FFFFFF',
  ink: '#292724',
  muted: '#817B73',
  line: '#E6E0D7',
  primary: '#3778C2',
  primaryHover: '#285F9D',
  injection: '#79BCE8',
  production: '#9B7055',
  unknown: '#B8B1A7',
} as const

/** Mapbox Standard basemap (its own green land / blue water palette). */
export const mapStyle = {
  url: 'mapbox://styles/mapbox/standard',
}
