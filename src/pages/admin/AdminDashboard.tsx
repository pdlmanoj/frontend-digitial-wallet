import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, UserX, Users, Wallet as WalletIcon } from 'lucide-react'
import { adminApi } from '../../lib/api'
import type { AdminUser, PaginatedResponse } from '../../types'
import { capitalize } from '../../lib/format'
import { Alert, Badge, Card, EmptyState, PageHeader, Spinner } from '../../components/ui'
import { WalletStatusBadge } from '../../components/badges'

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: React.ReactNode
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div className="card flex items-start gap-3 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await adminApi.listUsers(1, 5)
        if (!cancelled) setData(response)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load admin dashboard.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const recent = data?.results ?? []
  const wallets = recent.filter((user) => user.wallet).length
  const twoFactor = recent.filter((user) => user.is_2fa_enable).length
  const inactive = recent.filter((user) => user.status !== 'active').length

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        subtitle="Manage customer accounts and wallet access."
        actions={
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Users className="h-4 w-4" /> All users
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load dashboard">
            {error}
          </Alert>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total users"
            value={loading ? <Spinner className="h-5 w-5" /> : (data?.pagination.total ?? 0)}
            hint="Across all pages"
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            label="Wallets"
            value={loading ? <Spinner className="h-5 w-5" /> : wallets}
            hint="In the latest 5 accounts"
            icon={<WalletIcon className="h-5 w-5" />}
          />
          <StatCard
            label="2FA enabled"
            value={loading ? <Spinner className="h-5 w-5" /> : twoFactor}
            hint="In the latest 5 accounts"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Inactive"
            value={loading ? <Spinner className="h-5 w-5" /> : inactive}
            hint="In the latest 5 accounts"
            icon={<UserX className="h-5 w-5" />}
          />
        </div>

        <Card
          title="Recently registered users"
          actions={
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading users…
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No users yet"
              description="Registered accounts will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((user) => (
                <li key={user.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="hidden flex-wrap gap-1.5 sm:flex">
                    <Badge tone={user.status === 'active' ? 'success' : 'warning'}>
                      {capitalize(user.status)}
                    </Badge>
                    {user.wallet ? (
                      <WalletStatusBadge active={user.wallet.is_active} />
                    ) : (
                      <Badge tone="neutral">No wallet</Badge>
                    )}
                  </div>
                  <Link
                    to={`/admin/users/${user.id}`}
                    className="text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
