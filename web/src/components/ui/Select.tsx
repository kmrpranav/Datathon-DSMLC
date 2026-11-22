import type { SelectHTMLAttributes } from 'react'
import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: Array<{ value: string; label: string }>
  hideLabel?: boolean
}

export function Select({ label, options, hideLabel, className, id, ...rest }: SelectProps) {
  const selectId = id ?? `sel-${label.replace(/\s+/g, '-').toLowerCase()}`
  const active = rest.value !== undefined && rest.value !== 'all'
  return (
    <div className={clsx('flex flex-col gap-1 min-w-0', className)}>
      <label htmlFor={selectId} className={clsx('text-[11px] font-medium uppercase tracking-[0.06em] text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={clsx(
            'h-10 w-full appearance-none rounded-[10px] border bg-surface pl-3 pr-9 text-sm text-ink transition-colors cursor-pointer',
            'hover:border-[#D5CDC1] focus:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15',
            active ? 'border-primary/50 bg-primary-soft/40' : 'border-line',
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  )
}
