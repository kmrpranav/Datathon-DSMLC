import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('size-5 animate-spin text-primary', className)} aria-hidden />
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={clsx('flex flex-col items-center justify-center gap-3 p-10 text-sm text-muted', className)}>
      <Spinner />
      {label}
    </div>
  )
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-2 p-10 text-center', className)}>
      {icon && <div className="mb-1 grid size-11 place-items-center rounded-xl bg-[#F3EFE8] text-muted">{icon}</div>}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
