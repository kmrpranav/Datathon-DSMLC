import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { NAV_ITEMS } from './navigation'
import { LogoMark } from './Logo'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Mobile drawer mode */
  mobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobile, onNavigate }: SidebarProps) {
  const compact = collapsed && !mobile
  return (
    <aside
      className={clsx(
        'flex h-full flex-col border-r border-line bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]',
        mobile ? 'w-[272px]' : compact ? 'w-[76px]' : 'w-[248px]',
      )}
      aria-label="Primary"
    >
      <div className={clsx('flex h-[72px] items-center gap-3 px-5', compact && 'justify-center px-0')}>
        <LogoMark />
        {!compact && (
          <div className="min-w-0 animate-fade-in">
            <p className="text-[15px] font-semibold tracking-[-0.01em] leading-tight">FloodIQ</p>
            <p className="text-[12px] text-muted leading-tight mt-0.5">Oilfield Intelligence</p>
          </div>
        )}
        {mobile && (
          <button onClick={onNavigate} aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-muted hover:bg-black/5 hover:text-ink cursor-pointer">
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3">
        {!compact && <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#A39C92]">Workspace</p>}
        {NAV_ITEMS.map(({ to, label, icon: Icon, description }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            title={compact ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-[10px] text-sm transition-colors duration-150',
                compact ? 'mx-auto size-11 justify-center' : 'h-11 px-3',
                isActive ? 'bg-surface text-ink shadow-soft font-medium' : 'text-[#5F5A53] hover:bg-black/[0.035] hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className={clsx('absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary', compact ? '-left-3' : '-left-3')} />}
                <Icon className={clsx('size-[18px] shrink-0 transition-colors', isActive ? 'text-primary' : 'text-[#8F887E] group-hover:text-ink')} strokeWidth={isActive ? 2.2 : 1.9} />
                {!compact && (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate leading-tight">{label}</span>
                    {isActive && <span className="truncate text-[11.5px] font-normal text-muted leading-tight mt-0.5">{description}</span>}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {!mobile && (
        <div className={clsx('border-t border-line p-3', compact && 'flex justify-center')}>
          <button
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className={clsx(
              'flex items-center gap-2 rounded-[10px] text-[13px] text-muted transition-colors hover:bg-black/[0.04] hover:text-ink cursor-pointer',
              compact ? 'size-11 justify-center' : 'h-10 w-full px-3',
            )}
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            {!compact && 'Collapse'}
          </button>
        </div>
      )}
    </aside>
  )
}
