import { useId, useState } from 'react'
import clsx from 'clsx'
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react'
import type { ResearchEntry } from '../../content/research'
import { Badge } from '../ui/Badge'
import { formatDate } from '../../lib/format'

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</dt>
      <dd className={clsx('mt-0.5 text-[13px]', value ? 'text-ink' : 'italic text-[#ABA49A]')}>{value ?? 'To be added'}</dd>
    </div>
  )
}

export function ResearchCard({ entry }: { entry: ResearchEntry }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const placeholder = !entry.title

  return (
    <div className={clsx('rounded-2xl border bg-surface transition-shadow', open ? 'border-[#D9D1C5] shadow-soft' : 'border-line hover:shadow-soft')}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-4 p-5 text-left cursor-pointer"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3EFE8] text-muted">
          <BookOpen className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{entry.title ?? entry.topic}</h3>
            {placeholder && <Badge tone="amber">Placeholder</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {entry.author ?? 'Author / organization to be added'}
            {entry.publishedDate && <> · {formatDate(entry.publishedDate)}</>}
          </p>
        </div>
        <ChevronDown className={clsx('mt-2 size-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="px-5 pb-5 animate-fade-in">
        <div className="rounded-xl border border-line bg-[#FBFAF7] p-4">
          <p className={clsx('text-[13.5px] leading-relaxed', entry.summary ? 'text-ink' : 'italic text-[#ABA49A]')}>
            {entry.summary ?? 'Summary not yet supplied. Add a reviewed source in src/content/research.ts.'}
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Organization / author" value={entry.author} />
            <Field label="Published" value={formatDate(entry.publishedDate)} />
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Source</dt>
              <dd className="mt-0.5 text-[13px]">
                {entry.url ? (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-hover hover:underline">
                    Open source <ExternalLink className="size-3.5" />
                  </a>
                ) : (
                  <span className="italic text-[#ABA49A]">To be added</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
