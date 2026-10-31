import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  LayoutDashboard,
  LogOut,
  Menu,
  Send,
  ShieldCheck,
  UserRound,
  Wallet as WalletIcon,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/auth'
import { useProfileImage } from '../lib/useProfileImage'
import { Spinner } from './ui'

interface NavItem {
  to: string
  label: string
  icon: typeof WalletIcon
  end?: boolean
}

const primaryNav: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/wallet', label: 'Wallet', icon: WalletIcon },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
]

const moneyNav: NavItem[] = [
  { to: '/deposit', label: 'Deposit', icon: ArrowDownToLine },
  { to: '/withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
  { to: '/send', label: 'Send money', icon: Send },
]

const accountNav: NavItem[] = [
  { to: '/security', label: 'Security', icon: ShieldCheck },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
        <WalletIcon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-bold tracking-tight text-slate-900">Digital Wallet</p>
        <p className="text-[11px] font-medium text-slate-400">FastAPI + React</p>
      </div>
    </div>
  )
}

function NavGroup({ items, title }: { items: NavItem[]; title: string }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

function UserFooter({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  const { image } = useProfileImage()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return null

  const initial = user.name.charAt(0).toUpperCase()

  return (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {image ? (
            <img
              src={image.image_url}
              alt={`${user.name} profile`}
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            handleLogout()
            onNavigate?.()
          }}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function Navigation() {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5">
      <NavGroup items={primaryNav} title="Overview" />
      <NavGroup items={moneyNav} title="Money" />
      <NavGroup items={accountNav} title="Account" />
    </nav>
  )
}

export function Layout() {
  const { user, status } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading session…
      </div>
    )
  }

  // Admin accounts cannot call the regular user endpoints (get_current_user
  // rejects them), so keep them inside the admin section.
  if (user?.is_admin && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <Brand />
        </div>
        <Navigation />
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Navigation />
            <UserFooter onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}