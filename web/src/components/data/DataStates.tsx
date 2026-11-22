import type { ReactNode } from 'react'
import clsx from 'clsx'
import { AlertCircle, CloudOff, Database, Info, RefreshCw } from 'lucide-react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/States'
import type { ApiError } from '../../api/client'

/** Error state for an API-backed section, with retry. Distinguishes "backend not connected" from real failures. */
export function ApiErrorState({ error, onRetry, className, compact }: { error: ApiError; onRetry: () => void; className?: string; compact?: boolean }) {
  const offline = error.unavailable
  return (
    <EmptyState
      className={clsx(compact && 'p-6', className)}
      icon={offline ? <CloudOff className="size-5" /> : <AlertCircle className="size-5" />}
      title={offline ? 'Databricks data not connected' : "Couldn't load this data"}
      description={
        offline ? (
          error.code === 'DATABRICKS_NOT_CONFIGURED' ? (
            <>
              The backend is running but has no Databricks credentials. Fill in <code className="font-mono text-[12px]">backend/.env</code> and restart it.
            </>
          ) : (
            <>
              {error.message} Start it with <code className="font-mono text-[12px]">npm --prefix backend run dev</code>.
            </>
          )
        ) : (
          <>
            {error.message}
            {error.code && <span className="mt-1 block font-mono text-[11px] text-[#A39C92]">{error.code}</span>}
          </>
        )
      }
      action={<Button variant="secondary" size="sm" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>Try again</Button>}
    />
  )
}

/** Small provenance line: which table/source a section's numbers come from. */
export function SourceTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 font-mono text-[11px] text-[#A39C92]', className)}>
      <Database className="size-3" />
      {children}
    </span>
  )
}

/** Disclaimer for model outputs and proximity-based pairings. */
export function Notice({ children, tone = 'amber', className }: { children: ReactNode; tone?: 'amber' | 'neutral'; className?: string }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] leading-relaxed',
        tone === 'amber' ? 'border-[#F0E0C4] bg-[#FBF3E6] text-[#7A5220]' : 'border-line bg-[#FBFAF7] text-muted',
        className,
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
