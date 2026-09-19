import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, PowerOff, Power } from 'lucide-react'
import { userApi, walletApi } from '../../lib/api'
import type { AdminUser, AdminWallet } from '../../types'
import { capitalize, formatDOB, formatMoney } from '../../lib/format'
import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner } from '../../components/ui'
import { WalletStatusBadge } from '../../components/badges'

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const userId = id ?? ''

  const [user, setUser] = useState<AdminUser | null>(null)
  const [wallet, setWallet] = useState<AdminWallet | null>(null)
  const [hasWallet, setHasWallet] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'activate' | 'deactivate'>('activate')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fetchedUser = await userApi.getUser(userId)
      setUser(fetchedUser)
      try {
        const fetchedWallet = await walletApi.byUser(userId)
        setWallet(fetchedWallet)
        setHasWallet(true)
      } catch (walletErr) {
        // The wallet route 400s when the user has no wallet.
        if (walletErr instanceof Error && /no wallet/i.test(walletErr.message)) {
          setWallet(null)
          setHasWallet(false)
        } else {
          throw walletErr
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const openConfirm = (action: 'activate' | 'deactivate') => {
    setConfirmAction(action)
    setConfirmError(null)
    setConfirmOpen(true)
  }

  const runConfirm = async () => {
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      const response =
        confirmAction === 'activate'
          ? await walletApi.activate(userId)
          : await walletApi.deactivate(userId)
      setActionMsg(response.msg)
      setConfirmOpen(false)
      void load()
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setConfirmLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin — User"
        subtitle="Account and wallet, with admin wallet controls."
        actions={
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> All users
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load user">
            {error}
          </Alert>
        </div>
      )}

      {actionMsg && (
        <div className="mb-4">
          <Alert tone="success">{actionMsg}</Alert>
        </div>
      )}

      {loading && user === null ? (
        <div className="card flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading user…
        </div>
      ) : user ? (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  {user.name}
                </p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone={user.status === 'active' ? 'success' : 'warning'}>
                    {capitalize(user.status)}
                  </Badge>
                  {user.is_admin && <Badge tone="info">Admin</Badge>}
                  <Badge tone={user.is_2fa_enable ? 'success' : 'neutral'}>
                    {user.is_2fa_enable ? '2FA on' : '2FA off'}
                  </Badge>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-8 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-slate-500">Phone number</dt>
                <dd className="text-sm font-medium text-slate-900">{user.phone_number}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-slate-500">Date of birth</dt>
                <dd className="text-sm font-medium text-slate-900">{formatDOB(user.date_of_birth)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-slate-500">Gender</dt>
                <dd className="text-sm font-medium text-slate-900">{capitalize(user.gender)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2">
                <dt className="text-sm text-slate-500">User ID</dt>
                <dd className="max-w-[14rem] truncate text-xs text-slate-500">{user.id}</dd>
              </div>
            </dl>
          </Card>

          <Card
            title="Wallet"
            subtitle="Source: /wallet/{user_id} and admin activate/deactivate routes."
          >
            {hasWallet && wallet ? (
              <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Balance
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                    {formatMoney(wallet.amount, wallet.currency)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <WalletStatusBadge active={wallet.is_active} />
                    <span className="text-xs text-slate-500">{wallet.currency}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {wallet.is_active ? (
                    <Button variant="danger" onClick={() => openConfirm('deactivate')}>
                      <PowerOff className="h-4 w-4" /> Deactivate wallet
                    </Button>
                  ) : (
                    <Button onClick={() => openConfirm('activate')}>
                      <Power className="h-4 w-4" /> Activate wallet
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 py-5 text-sm text-slate-500">
                <p>This user has no wallet yet.</p>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* Confirm activate/deactivate */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={confirmAction === 'activate' ? 'Activate wallet' : 'Deactivate wallet'}
      >
        <div className="space-y-4">
          {confirmError && <Alert tone="error">{confirmError}</Alert>}
          <p className="text-sm text-slate-600">
            {confirmAction === 'activate'
              ? 'This lets the user deposit, withdraw, and send money again.'
              : 'The user will not be able to make transactions until the wallet is reactivated.'}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={confirmLoading}>
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'activate' ? 'primary' : 'danger'}
              onClick={runConfirm}
              loading={confirmLoading}
            >
              {!confirmLoading &&
                (confirmAction === 'activate' ? (
                  <Power className="h-4 w-4" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                ))}
              {confirmAction === 'activate' ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}