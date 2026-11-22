import { BarChart3, Compass, LayoutDashboard, Waves, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, description: 'Project & research' },
  { to: '/wells', label: 'Well Explorer', icon: Compass, description: 'Map & well table' },
  { to: '/simulation', label: 'Simulation', icon: Waves, description: 'Waterflood scenarios' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Trends & models' },
]
