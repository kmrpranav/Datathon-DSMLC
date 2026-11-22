import clsx from 'clsx'

interface LegendItem {
  label: string
  color: string
  count?: number
}

export function MapLegend({ items, className, title = 'Well type' }: { items: LegendItem[]; className?: string; title?: string }) {
  return (
    <div className={clsx('rounded-xl border border-line bg-surface/95 px-3.5 py-3 shadow-soft backdrop-blur-sm', className)}>
      <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-2.5 text-[12.5px] text-ink">
            <span className="size-3 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgb(0_0_0/0.1)]" style={{ background: i.color }} />
            <span>{i.label}</span>
            {i.count !== undefined && <span className="ml-auto pl-3 tabular-nums text-muted">{i.count.toLocaleString()}</span>}
          </li>
        ))}
        <li className="mt-1 flex items-center gap-2.5 border-t border-line pt-2 text-[12px] text-muted">
          <span className="grid size-4 place-items-center rounded-full border-2 border-[#B79D8A] bg-white text-[7px] font-semibold text-ink">n</span>
          Cluster (zoom in)
        </li>
      </ul>
    </div>
  )
}
