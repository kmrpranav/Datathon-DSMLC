import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Droplets, Gauge, LineChart, Map, TrendingDown, Wrench, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ResearchCard } from '../components/overview/ResearchCard'
import { LiveSummary } from '../components/overview/LiveSummary'
import { RESEARCH_ENTRIES } from '../content/research'
import { datasetMeta } from '../data/datasetMeta'
import { formatDate } from '../lib/format'

const CONCEPTS: Array<{ icon: LucideIcon; title: string; body: string; accent: string }> = [
  {
    icon: Gauge,
    title: 'Optimizing mature fields',
    body: 'As reservoirs age, natural pressure declines and output falls. Mature assets have to squeeze more value from existing wells, where small operational changes compound across thousands of wells.',
    accent: 'bg-[#F5EEE9] text-production',
  },
  {
    icon: Droplets,
    title: 'Water injection for recovery',
    body: 'Waterflooding injects water into the reservoir to maintain pressure and push oil toward nearby producers. Its effectiveness depends on where water goes and which producers respond.',
    accent: 'bg-[#EAF5FC] text-[#3C8CC4]',
  },
  {
    icon: TrendingDown,
    title: 'Finding underperformers',
    body: 'Wells that underperform relative to their neighbours or history signal opportunities — poor injection support, mechanical issues, or candidates for intervention.',
    accent: 'bg-[#FBF3E6] text-[#8A5A1E]',
  },
  {
    icon: LineChart,
    title: 'Data-driven forecasting',
    body: 'Combining daily production, injection, maintenance and failure history can support forecasts that help engineers compare scenarios before committing field resources.',
    accent: 'bg-primary-soft text-primary',
  },
]

const DATASETS: Array<{ icon: LucideIcon; value: string; label: string; file: string }> = [
  { icon: Map, value: datasetMeta.wells.toLocaleString(), label: 'Unique wells', file: 'daily_production.parquet' },
  { icon: Database, value: '≈ 5.08M', label: 'Daily production records', file: 'daily_production.parquet' },
  { icon: Wrench, value: datasetMeta.wellJobRecords.toLocaleString(), label: 'Maintenance job records', file: 'well_jobs.parquet' },
]

export default function OverviewPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-14 pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] lg:block xl:w-[44%]">
          <HeroGraphic />
        </div>
        <div className="relative max-w-2xl px-6 py-12 lg:max-w-[56%] sm:px-10 sm:py-16 lg:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-[#FBFAF7] px-3 py-1 text-[12px] font-medium text-muted">
            <span className="size-1.5 rounded-full bg-primary" /> Datathon project · FloodIQ
          </span>
          <h1 className="mt-5 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[46px]">
            Smarter Decisions <br className="hidden sm:block" />
            <span className="text-primary">Beneath the Surface</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-muted">
            FloodIQ brings together years of historical well data to investigate how water injection relates to production performance —
            surfacing underperforming wells and waterflood optimization opportunities across the field.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" iconRight={<ArrowRight className="size-4" />} onClick={() => navigate('/wells')}>
              Explore Wells
            </Button>
            <Button size="lg" variant="secondary" onClick={() => document.getElementById('research')?.scrollIntoView({ behavior: 'smooth' })}>
              Research background
            </Button>
          </div>
        </div>
      </section>

      {/* Concepts */}
      <section aria-labelledby="concepts-heading">
        <SectionHeading id="concepts-heading" eyebrow="The problem" title="Why waterflood intelligence matters" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {CONCEPTS.map(({ icon: Icon, title, body, accent }) => (
            <Card key={title} className="group p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float">
              <div className={`grid size-10 place-items-center rounded-xl ${accent}`}>
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Field summary (backend: CSV export or Databricks) */}
      <section aria-labelledby="live-heading">
        <SectionHeading
          id="live-heading"
          eyebrow="Field snapshot"
          title="Field summary"
          description="Aggregated by the FloodIQ API from the team's exported Databricks tables: well master, performance classes and saved conversion results. Injector–producer pairs appear when that table is available."
        />
        <div className="mt-6">
          <LiveSummary />
        </div>
      </section>

      {/* Dataset */}
      <section aria-labelledby="dataset-heading">
        <SectionHeading
          id="dataset-heading"
          eyebrow="The data"
          title="Source datasets"
          description={`Daily readings from ${formatDate(datasetMeta.productionDateRange.start)} to ${formatDate(datasetMeta.productionDateRange.end)} across Alberta, Saskatchewan and British Columbia.`}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {DATASETS.map(({ icon: Icon, value, label, file }) => (
            <Card key={label} className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted">{label}</p>
                <Icon className="size-[18px] text-[#A39C92]" />
              </div>
              <p className="mt-3 text-[34px] font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
              <p className="mt-2 font-mono text-[11.5px] text-[#A39C92]">{file}</p>
            </Card>
          ))}
        </div>
        <Card className="mt-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FBF3E6] text-[#8A5A1E]">
            <AlertTriangle className="size-5" />
          </div>
          <p className="text-[13.5px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">A third dataset records {datasetMeta.equipmentFailures.toLocaleString()} equipment failures</span>{' '}
            (<span className="font-mono text-[12px]">production_failures.parquet</span>) — causes, failed systems and actions taken — which may support
            historical operational analysis alongside maintenance jobs.
          </p>
        </Card>
      </section>

      {/* Research */}
      <section id="research" aria-labelledby="research-heading" className="scroll-mt-6">
        <SectionHeading
          id="research-heading"
          eyebrow="Background"
          title="Industry Research & Previous Work"
          description="Reviewed publications and prior work informing our approach. Entries marked as placeholders are awaiting verified sources from the team."
        />
        <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {RESEARCH_ENTRIES.map((r) => (
            <ResearchCard key={r.id} entry={r} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">{title}</h2>
      {description && <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>}
    </div>
  )
}

/** Abstract cross-section: strata with injector and producer wells. Decorative only. */
function HeroGraphic() {
  return (
    <svg viewBox="0 0 520 480" preserveAspectRatio="xMaxYMid slice" className="h-full w-full">
      <defs>
        <linearGradient id="fade" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="520" height="480" fill="#F7F4EE" />
      <path d="M0 150 C120 135 260 165 520 140 L520 480 L0 480Z" fill="#EFE8DD" />
      <path d="M0 230 C140 215 300 250 520 222 L520 480 L0 480Z" fill="#E8DFD2" />
      <path d="M0 310 C150 296 320 330 520 300 L520 480 L0 480Z" fill="#E2D6C6" />
      <path d="M0 390 C160 378 330 404 520 380 L520 480 L0 480Z" fill="#DCCFBD" />
      {/* injectors */}
      {[190, 400].map((x) => (
        <g key={x}>
          <line x1={x} y1="96" x2={x} y2="330" stroke="#79BCE8" strokeWidth="3" strokeLinecap="round" />
          <circle cx={x} cy="92" r="7" fill="#79BCE8" stroke="#fff" strokeWidth="2.5" />
          <ellipse cx={x} cy="320" rx="54" ry="16" fill="#79BCE8" opacity="0.22" />
          <ellipse cx={x} cy="320" rx="30" ry="9" fill="#79BCE8" opacity="0.3" />
        </g>
      ))}
      {/* producers */}
      {[295, 490, 110].map((x) => (
        <g key={x}>
          <line x1={x} y1="96" x2={x} y2="318" stroke="#9B7055" strokeWidth="3" strokeLinecap="round" />
          <circle cx={x} cy="92" r="7" fill="#9B7055" stroke="#fff" strokeWidth="2.5" />
        </g>
      ))}
      {/* flow arrows */}
      {[[220, 265], [370, 325], [160, 125]].map(([a, b], i) => (
        <path key={i} d={`M${a} 322 Q${(a + b) / 2} 300 ${b} 314`} fill="none" stroke="#3778C2" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 4" />
      ))}
      <rect width="520" height="480" fill="url(#fade)" />
    </svg>
  )
}
