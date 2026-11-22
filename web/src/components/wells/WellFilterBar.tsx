import { RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { SearchInput } from '../ui/SearchInput'
import { PROVINCE_NAMES } from '../../lib/format'
import { DEFAULT_WELL_FILTERS, type WellFilters } from '../../types/well'

interface WellFilterBarProps {
  filters: WellFilters
  onChange: (f: WellFilters) => void
  operatingAreas: string[]
}

export function WellFilterBar({ filters, onChange, operatingAreas }: WellFilterBarProps) {
  const set = <K extends keyof WellFilters>(k: K, v: WellFilters[K]) => onChange({ ...filters, [k]: v })
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_WELL_FILTERS)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(130px,1fr)_minmax(150px,1.2fr)_minmax(120px,1fr)_minmax(180px,1.6fr)_auto] xl:items-end">
      <Select
        label="Province"
        value={filters.province}
        onChange={(e) => onChange({ ...filters, province: e.target.value as WellFilters['province'], operatingArea: 'all' })}
        options={[{ value: 'all', label: 'All provinces' }, ...Object.entries(PROVINCE_NAMES).map(([value, label]) => ({ value, label }))]}
      />
      <Select
        label="Operating area"
        value={filters.operatingArea}
        onChange={(e) => set('operatingArea', e.target.value)}
        options={[{ value: 'all', label: 'All areas' }, ...operatingAreas.map((a) => ({ value: a, label: a }))]}
      />
      <Select
        label="Well type"
        value={filters.wellType}
        onChange={(e) => set('wellType', e.target.value as WellFilters['wellType'])}
        options={[
          { value: 'all', label: 'All types' },
          { value: 'injection', label: 'Injection' },
          { value: 'production', label: 'Production' },
          { value: 'unknown', label: 'Unclassified' },
        ]}
      />
      <SearchInput label="Search" placeholder="Search UWI or well name" value={filters.search} onChange={(v) => set('search', v)} className="sm:col-span-2 xl:col-span-1" />
      <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => onChange(DEFAULT_WELL_FILTERS)} disabled={!dirty} className="sm:col-span-2 lg:col-span-1">
        Reset
      </Button>
    </div>
  )
}
