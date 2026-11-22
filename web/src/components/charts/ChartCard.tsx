import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { Clock } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { LoadingState } from '../ui/States'

export type ChartStatus = 'awaiting' | 'loading' | 'ready'

interface ChartCardProps {
  title: string
  description?: string
  icon?: LucideIcon
  status: ChartStatus
  /** Data sources / fields this chart will use — shown while awaiting integration. */
  plannedSources?: string[]
  className?: string
  height?: number
  /** The rendered chart, shown only when status === 'ready'. */
  children?: ReactNode
  action?: ReactNode
}

/**
 * Reusable container for every analytics chart. Never renders fabricated
 * values: until real data is wired in, it shows an explicit
 * "awaiting data integration" state.
 */
export function ChartCard({ title, description, icon: Icon, status, plannedSources, className, height = 240, children, action }: ChartCardProps) {
  return (
    <Card className={clsx('flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#F3EFE8] text-muted">
              <Icon className="size-[18px]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        {action ?? (status === 'awaiting' && <Badge tone="amber"><Clock className="size-3" /> Awaiting data</Badge>)}
      </div>
      <div className="flex-1 p-5 pt-4" style={{ minHeight: height }}>
        {status === 'ready' && children}
        {status === 'loading' && <LoadingState label="Loading chart…" className="h-full" />}
        {status === 'awaiting' && <AwaitingData height={height} plannedSources={plannedSources} />}
      </div>
    </Card>
  )
}

function AwaitingData({ height, plannedSources }: { height: number; plannedSources?: string[] }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#DDD5C9] bg-[#FBFAF7] px-6 text-center" style={{ minHeight: height }}>
      {/* Empty axis frame — intentionally contains no data marks. */}
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((y) => (
          <line key={y} x1="6%" x2="96%" y1={`${y * 100}%`} y2={`${y * 100}%`} stroke="#EDE7DD" strokeDasharray="4 6" />
        ))}
        <line x1="6%" x2="6%" y1="10%" y2="88%" stroke="#E6E0D7" />
        <line x1="6%" x2="96%" y1="88%" y2="88%" stroke="#E6E0D7" />
      </svg>
      <div className="relative">
        <p className="text-[13px] font-semibold text-ink">Awaiting data integration</p>
        <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-muted">No values are shown until verified data is connected.</p>
        {plannedSources && plannedSources.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {plannedSources.map((s) => (
              <span key={s} className="rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted">{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
