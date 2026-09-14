import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart2,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  Handshake,
  IndianRupee,
  Kanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { Breadcrumb, Button } from '../ui/index.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/leads', label: 'Leads', icon: FileText },
  { to: '/bank-applications', label: 'Bank Applications', icon: Building2 },
  { to: '/relationships', label: 'RM List', icon: Handshake },
  { to: '/disbursements', label: 'Disbursements', icon: IndianRupee },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/monitoring', label: 'Monitoring', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const currentBuildIdRef = useRef(null)

  const fetchBuildId = useCallback(async () => {
    if (typeof window === 'undefined') return null
    try {
      const url = new URL(`${import.meta.env.BASE_URL || '/'}build-meta.json`, window.location.origin)
      url.searchParams.set('_ts', String(Date.now()))
      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) return null
      const json = await res.json()
      const id = String(json?.buildId || '').trim()
      return id || null
    } catch {
      return null
    }
  }, [])

  const runUpdateCheck = useCallback(async () => {
    const latest = await fetchBuildId()
    if (!latest || !currentBuildIdRef.current) return
    if (latest !== currentBuildIdRef.current) setUpdateAvailable(true)
  }, [fetchBuildId])

  useEffect(() => {
    if (import.meta.env.DEV) return
    let active = true
    const bootstrapId = window.setTimeout(async () => {
      const initial = await fetchBuildId()
      if (!active || !initial) return
      currentBuildIdRef.current = initial
      setUpdateAvailable(false)
    }, 0)
    const id = window.setInterval(async () => {
      if (!active) return
      await runUpdateCheck()
    }, 2 * 60 * 1000)
    const onFocus = () => {
      if (!active) return
      void runUpdateCheck()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      window.clearTimeout(bootstrapId)
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchBuildId, runUpdateCheck])

  const handleRestartToUpdate = useCallback(async () => {
    if (!updateAvailable) return
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.update()))
        regs.forEach((r) => r.waiting?.postMessage?.({ type: 'SKIP_WAITING' }))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // Best effort: continue with hard refresh even if cache cleanup fails.
    }

    const next = new URL(window.location.href)
    next.searchParams.set('_update', String(Date.now()))
    window.location.replace(next.toString())
    window.setTimeout(() => window.location.reload(), 60)
  }, [updateAvailable])

  const breadcrumbItems = useMemo(() => {
    const path = location.pathname
    const parts = path.split('/').filter(Boolean)
    const items = [{ label: 'Dashboard', to: '/dashboard' }]

    if (parts[0] === 'customers') {
      items.push({ label: 'Customers', to: '/customers' })
      if (parts[1]) items.push({ label: 'Customer Detail' })
    }
    if (parts[0] === 'leads') {
      items.push({ label: 'Leads', to: '/leads' })
      if (parts[1]) items.push({ label: 'Lead Detail' })
    }
    if (parts[0] === 'documents') items.push({ label: 'Documents' })
    if (parts[0] === 'pipeline') items.push({ label: 'Pipeline' })
    if (parts[0] === 'bank-applications') items.push({ label: 'Bank Applications' })
    if (parts[0] === 'relationships') items.push({ label: 'Relationships' })
    if (parts[0] === 'disbursements') items.push({ label: 'Disbursements' })
    if (parts[0] === 'reports') items.push({ label: 'Reports' })
    if (parts[0] === 'monitoring') items.push({ label: 'Monitoring' })
    if (parts[0] === 'settings') items.push({ label: 'Settings' })

    return items
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <aside
        className={[
          'fixed inset-y-0 left-0 flex flex-col border-r border-border bg-surface',
          sidebarCollapsed ? 'w-[64px]' : 'w-[220px]',
        ].join(' ')}
      >
        <div
          className={[
            'flex items-center justify-between py-4',
            sidebarCollapsed ? 'px-3' : 'px-4',
          ].join(' ')}
        >
          <div className={['flex items-center', sidebarCollapsed ? '' : 'gap-2'].join(' ')}>
            <div className="h-7 w-7 rounded-md bg-accent/10 text-accent flex items-center justify-center font-semibold">
              O
            </div>
            {sidebarCollapsed ? null : <div className="text-[14px] font-semibold text-accent">Optom Capital</div>}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-text-secondary hover:bg-[#F5F5F3] hover:text-text-primary"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-md py-2 text-[13px]',
                    sidebarCollapsed ? 'justify-center px-2' : 'gap-2 px-3',
                    isActive
                      ? 'bg-blue-50 text-accent border-l-2 border-accent'
                      : 'text-text-secondary hover:bg-[#F5F5F3]',
                  ].join(' ')
                }
              >
                <Icon size={16} />
                {sidebarCollapsed ? null : <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto px-3 pt-3 pb-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!updateAvailable}
            className={['w-full', sidebarCollapsed ? 'justify-center px-0' : 'justify-start gap-2'].join(' ')}
            title={updateAvailable ? 'Restart to Update' : 'No Updates'}
            onClick={handleRestartToUpdate}
          >
            <span className="relative inline-flex">
              <Bell size={16} />
              {updateAvailable ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-surface" /> : null}
            </span>
            {sidebarCollapsed ? null : <span>{updateAvailable ? 'Restart to Update' : 'No Updates'}</span>}
          </Button>
        </div>
        <div className="mx-3 border-t border-border" />
        <div className="px-3 py-3">
          {sidebarCollapsed ? null : <div className="mb-2 truncate text-[12px] text-text-secondary">{user?.email}</div>}
          <Button
            variant="secondary"
            size="sm"
            className={['w-full', sidebarCollapsed ? 'justify-center px-0' : 'justify-start'].join(' ')}
            title="Logout"
            onClick={async () => {
              await logout()
              navigate('/login')
            }}
          >
            <LogOut size={16} />
            {sidebarCollapsed ? null : <span>Logout</span>}
          </Button>
        </div>
      </aside>

      <div className={sidebarCollapsed ? 'pl-[64px]' : 'pl-[220px]'}>
        <header className="sticky top-0 z-10 h-[52px] border-b border-border bg-surface">
          <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6">
            <Breadcrumb items={breadcrumbItems} />
            <div />
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
