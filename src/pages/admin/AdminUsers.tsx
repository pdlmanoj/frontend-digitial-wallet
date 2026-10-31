import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { adminApi } from '../../lib/api'
import type { AdminUser, PaginatedResponse } from '../../types'
import { capitalize } from '../../lib/format'
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  Spinner,
} from '../../components/ui'
import { WalletStatusBadge } from '../../components/badges'

const PAGE_SIZE = 10

export function AdminUsers() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.listUsers(page, PAGE_SIZE))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const users = data?.results ?? []

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Every registered customer account."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load users">
            {error}
          </Alert>
        </div>
      )}

      <Card
        title="All accounts"
        subtitle={
          data
            ? `${data.pagination.total} user${data.pagination.total === 1 ? '' : 's'} · Source: GET /manage/users`
            : 'Source: GET /manage/users'
        }
      >
        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading users…
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No users yet"
            description="Registered accounts will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Wallet</th>
                  <th className="px-5 py-3">2FA</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{user.phone_number}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={user.status === 'active' ? 'success' : 'warning'}>
                          {capitalize(user.status)}
                        </Badge>
                        {user.is_admin && <Badge tone="info">Admin</Badge>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {user.wallet ? (
                        <WalletStatusBadge active={user.wallet.is_active} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {user.is_2fa_enable ? (
                        <Badge tone="success">
                          <ShieldCheck className="h-3 w-3" /> On
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Off</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.total_pages}
            total={data.pagination.total}
            onPageChange={setPage}
            disabled={loading}
          />
        )}
      </Card>
    </div>
  )
}
