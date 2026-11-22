import { BarChart3, Crosshair, SlidersHorizontal, Waves } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { icon: Crosshair, title: 'Select an injection well', body: 'Pick an injector on the map as the scenario anchor.' },
  { icon: Waves, title: 'Inspect nearby producers', body: 'See offset production wells that may respond to injection.' },
  { icon: SlidersHorizontal, title: 'Configure injection scenarios', body: 'Adjust injection rates and timing for each scenario.' },
  { icon: BarChart3, title: 'Compare forecasts', body: 'Contrast predicted production response across scenarios.' },
]

export function SimulationInfoPanel({ className }: { className?: string }) {
  return (
    <section aria-labelledby="sim-ws-title" className={clsx('rounded-2xl border border-line bg-surface/95 p-5 shadow-float backdrop-blur-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="sim-ws-title" className="text-[15px] font-semibold tracking-[-0.01em]">Simulation Workspace</h2>
        <span className="rounded-full bg-[#F3EFE8] px-2 py-0.5 text-[11px] font-medium text-muted">Preview</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">This workspace will let you build and compare waterflood scenarios. Planned workflow:</p>
      <ol className="mt-4 flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-3">
            <div className="relative grid size-8 shrink-0 place-items-center rounded-[10px] border border-line bg-[#FBFAF7] text-muted">
              <Icon className="size-4" />
              <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-surface text-[9px] font-semibold text-muted ring-1 ring-line">{i + 1}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">{title}</p>
              <p className="text-[12.5px] leading-snug text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
