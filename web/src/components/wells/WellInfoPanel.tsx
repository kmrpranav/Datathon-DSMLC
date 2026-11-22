import type { ReactNode } from 'react'
import { ArrowRight, Droplets, MapPin, X } from 'lucide-react'
import clsx from 'clsx'
import type { Well } from '../../types/well'
import { formatCell, formatCoord, formatDate, formatNumber, prettyColumn, provinceName } from '../../lib/format'
import { Button } from '../ui/Button'
import { Badge, DualTag, StatusBadge, WellTypeBadge } from '../ui/Badge'

interface WellInfoPanelProps {
  well: Well
  onClose: () => void
  onViewDetails: (well: Well) => void
  className?: string
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[12.5px] text-muted shrink-0">{label}</dt>
      <dd className="text-right text-[13px] text-ink min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Measure({ label, value, unit, date }: { label: string; value: number | null | undefined; unit: string; date: string | null | undefined }) {
  const v = formatNumber(value)
  return (
    <div className="rounded-xl border border-line bg-[#FBFAF7] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{label}</p>
      {v !== null ? (
        <>
          <p className="mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.01em]">
            {v} <span className="text-[12px] font-normal text-muted">{unit}</span>
          </p>
          <p className="text-[11.5px] text-muted">{formatDate(date)}</p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-muted">Not recorded</p>
      )}
    </div>
  )
}

const roleText = (v: boolean | null) => (v === true ? 'Yes' : v === false ? 'No' : 'No evidence')
const PERF_TONE: Record<string, 'green' | 'amber' | 'neutral'> = { good: 'green', moderate: 'amber', low: 'neutral' }

export function WellInfoPanel({ well, onClose, onViewDetails, className }: WellInfoPanelProps) {
  const fromSnapshot = well.latestOilM3 !== undefined
  const metrics = Object.entries(well.metrics).filter(([, v]) => v !== null && v !== '')
  const measures =
    well.wellType === 'injection'
      ? [
          { label: 'Water injected', value: well.latestInjectedWaterM3, unit: 'm³/d', date: well.latestInjectedWaterDate },
          { label: 'Oil produced', value: well.latestOilM3, unit: 'm³/d', date: well.latestOilDate },
        ]
      : [
          { label: 'Oil produced', value: well.latestOilM3, unit: 'm³/d', date: well.latestOilDate },
          { label: 'Water produced', value: well.latestWaterProducedM3, unit: 'm³/d', date: well.latestWaterProducedDate },
          { label: 'Gas produced', value: well.latestGasE3m3, unit: 'e³m³/d', date: well.latestGasDate },
          { label: 'Water injected', value: well.latestInjectedWaterM3, unit: 'm³/d', date: well.latestInjectedWaterDate },
        ]

  return (
    <section
      aria-label={`Details for ${well.wellName ?? well.uwi}`}
      className={clsx('flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-float animate-slide-in', className)}
    >
      <header className="flex items-start gap-3 border-b border-line p-4">
        <div className={clsx('mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px]', well.wellType === 'injection' ? 'bg-[#EAF5FC] text-[#3C8CC4]' : well.wellType === 'production' ? 'bg-[#F5EEE9] text-production' : 'bg-[#F3EFE8] text-muted')}>
          {well.wellType === 'injection' ? <Droplets className="size-[18px]" /> : <MapPin className="size-[18px]" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] break-words">{well.wellName ?? 'Unnamed well'}</h2>
          <p className="mt-0.5 font-mono text-[11.5px] text-muted break-all">{well.formattedUwi ?? well.uwi}</p>
        </div>
        <button onClick={onClose} aria-label="Close well details" className="-mr-1 -mt-1 rounded-lg p-1.5 text-muted hover:bg-black/5 hover:text-ink cursor-pointer">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4">
        <dl className="divide-y divide-line">
          <Row label="Current type">
            <div className="flex flex-col items-end gap-1">
              <WellTypeBadge type={well.wellType} />
              {well.roles.dualRole && <DualTag />}
            </div>
          </Row>
          <Row label="Has produced">{roleText(well.roles.hasProducedHistorically)}</Row>
          <Row label="Has injected">{roleText(well.roles.hasInjectedHistorically)}</Row>
          {!fromSnapshot && (
            <Row label="Performance">
              {well.performanceClass ? (
                <Badge tone={PERF_TONE[well.performanceClass.toLowerCase()] ?? 'neutral'}>{well.performanceClass}</Badge>
              ) : (
                <span className="text-muted">Not classified</span>
              )}
            </Row>
          )}
          <Row label="Latest status">
            <div className="flex flex-col items-end gap-0.5">
              <StatusBadge status={well.status} />
              {well.statusDate && <span className="text-[11.5px] text-muted">as of {formatDate(well.statusDate)}</span>}
            </div>
          </Row>
          <Row label="Province">{provinceName(well.province)}</Row>
          <Row label="Operating area">{well.operatingArea ?? <span className="text-muted">Not recorded</span>}</Row>
          <Row label="UWI"><span className="font-mono text-[12px]">{well.uwi}</span></Row>
          <Row label="Coordinates"><span className="tabular-nums">{formatCoord(well.latitude, well.longitude)}</span></Row>
          {well.recordCount !== undefined && (
            <Row label="Records">
              {well.recordCount.toLocaleString()} days
              <span className="block text-[11.5px] text-muted">{formatDate(well.firstRecordDate)} – {formatDate(well.lastRecordDate)}</span>
            </Row>
          )}
        </dl>

        {fromSnapshot ? (
          <>
            <p className="mt-3 mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Latest recorded measurements</p>
            <div className="grid grid-cols-2 gap-2 pb-4">
              {measures.map((m) => (
                <Measure key={m.label} {...m} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Performance metrics</p>
            {metrics.length ? (
              <dl className="divide-y divide-line pb-3">
                {metrics.map(([k, v]) => (
                  <Row key={k} label={prettyColumn(k)}>
                    <span className="tabular-nums">{formatCell(v)}</span>
                  </Row>
                ))}
              </dl>
            ) : (
              <p className="pb-4 text-[12.5px] text-muted">No performance record for this well in bushra_well_performance.</p>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-line p-3">
        <Button className="w-full" iconRight={<ArrowRight className="size-4" />} onClick={() => onViewDetails(well)}>
          View Well Details
        </Button>
      </footer>
    </section>
  )
}
