import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { WellType } from '../../types/well'
import { WELL_TYPE_LABELS } from '../../lib/format'

type Tone = 'neutral' | 'blue' | 'amber' | 'green'
const tones: Record<Tone, string> = {
  neutral: 'bg-[#F3EFE8] text-[#5F5A53] border-line',
  blue: 'bg-primary-soft text-primary-hover border-[#D3E2F3]',
  amber: 'bg-[#FBF3E6] text-[#8A5A1E] border-[#F0E0C4]',
  green: 'bg-[#EEF5EE] text-[#3B6B42] border-[#D6E7D7]',
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  )
}

const dot: Record<WellType, string> = { injection: 'bg-injection', production: 'bg-production', unknown: 'bg-unknown' }

export function WellTypeBadge({ type }: { type: WellType }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink whitespace-nowrap">
      <span className={clsx('size-2.5 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]', dot[type])} />
      {WELL_TYPE_LABELS[type]}
    </span>
  )
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-[13px] text-muted">Not recorded</span>
  const tone: Tone = status === 'Producing' ? 'green' : status === 'Injecting' ? 'blue' : status === 'Suspended' ? 'amber' : 'neutral'
  return <Badge tone={tone}>{status}</Badge>
}
