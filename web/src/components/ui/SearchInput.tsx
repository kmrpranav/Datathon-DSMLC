import type { InputHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Search, X } from 'lucide-react'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (v: string) => void
  hideLabel?: boolean
}

export function SearchInput({ label, value, onChange, hideLabel, className, id, ...rest }: SearchInputProps) {
  const inputId = id ?? `search-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div className={clsx('flex flex-col gap-1 min-w-0', className)}>
      <label htmlFor={inputId} className={clsx('text-[11px] font-medium uppercase tracking-[0.06em] text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          id={inputId}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            'h-10 w-full rounded-[10px] border bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-[#ABA49A] transition-colors',
            'hover:border-[#D5CDC1] focus:outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 [&::-webkit-search-cancel-button]:hidden',
            value ? 'border-primary/50' : 'border-line',
          )}
          {...rest}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-black/5 hover:text-ink cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
