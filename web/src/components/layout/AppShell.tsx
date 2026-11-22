import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { LogoMark } from './Logo'

const STORAGE_KEY = 'floodiq.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* storage unavailable */
    }
    // Let maps resize after the sidebar width transition.
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 320)
    return () => clearTimeout(t)
  }, [collapsed])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-float">
        Skip to content
      </a>

      {/* Desktop / tablet sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden md:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      </div>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur md:hidden">
        <button onClick={() => setDrawerOpen(true)} aria-label="Open navigation" className="-ml-1 rounded-lg p-2 text-ink hover:bg-black/5 cursor-pointer">
          <Menu className="size-5" />
        </button>
        <LogoMark className="size-7 rounded-lg" />
        <span className="text-[15px] font-semibold">FloodIQ</span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#292724]/25 animate-fade-in" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 shadow-float animate-[page-in_220ms_ease-out]">
            <Sidebar mobile collapsed={false} onToggleCollapsed={() => {}} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <main
        id="main"
        className={`min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${collapsed ? 'md:pl-[76px]' : 'md:pl-[248px]'}`}
      >
        <div key={location.pathname} className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9 animate-page-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
