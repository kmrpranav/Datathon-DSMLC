/** Shared layout pieces for the Analytics page (section headers, panels, empty state, legend). */
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { BarChart3 } from 'lucide-react'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/States'

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ title, description, icon: Icon, action, children, className, footer }: {
  title: string
  description?: ReactNode
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
  footer?: ReactNode
}) {
  return (
    <Card className={clsx('flex min-w-0 flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#F3EFE8] text-muted">
              <Icon className="size-[18px]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
            {description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="flex-1 p-5 pt-4">{children}</div>
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </Card>
  )
}

/** Shown when the current filters leave nothing to plot. */
export function ChartEmpty({ title = 'No data for these filters', description = 'Adjust or reset the filters to see this chart.', height = 220 }: { title?: string; description?: string; height?: number }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-[#DDD5C9] bg-[#FBFAF7]" style={{ minHeight: height }}>
      <EmptyState className="p-6" icon={<BarChart3 className="size-5" />} title={title} description={description} />
    </div>
  )
}

/** Small "colour swatch + label + value" legend row. */
export function LegendItem({ color, label, value, ring }: { color: string; label: string; value?: ReactNode; ring?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: ring ? `0 0 0 1.5px ${ring}` : undefined }} />
      {label}
      {value !== undefined && <span className="tabular-nums text-ink">{value}</span>}
    </span>
  )
}

/** Two-or-more-option segmented control used for chart view switches. */
export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 rounded-[10px] border border-line bg-[#FBFAF7] p-0.5 text-[12px]">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx('rounded-lg px-2.5 py-1 font-medium cursor-pointer', value === o.value ? 'bg-surface text-primary shadow-soft' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
