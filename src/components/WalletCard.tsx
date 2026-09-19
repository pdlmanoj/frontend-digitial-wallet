import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Send, Wallet as WalletIcon } from 'lucide-react'
import type { WalletBalance } from '../types'
import { formatMoney } from '../lib/format'
import { Spinner } from './ui'
import { WalletStatusBadge } from './badges'

export function WalletCard({
  wallet,
  loading,
}: {
  wallet: WalletBalance | null
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="card flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading wallet…
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="card border-dashed p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <WalletIcon className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">No wallet yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          You don't have a wallet yet. Create one with an opening balance to start
          depositing, withdrawing, and sending money.
        </p>
        <Link
          to="/wallet"
          className="mt-4 inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Create a wallet
        </Link>
      </div>
    )
  }

  const hold = Number(wallet.hold_amount ?? 0)

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
            <WalletIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Available balance
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {formatMoney(wallet.amount, wallet.currency)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <WalletStatusBadge active={wallet.is_active} />
              {hold > 0 && (
                <span className="text-xs text-slate-500">
                  {formatMoney(hold, wallet.currency)} on hold
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/deposit"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowDownToLine className="h-4 w-4 text-emerald-600" /> Deposit
          </Link>
          <Link
            to="/withdraw"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowUpFromLine className="h-4 w-4 text-amber-600" /> Withdraw
          </Link>
          <Link
            to="/send"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Send className="h-4 w-4" /> Send money
          </Link>
        </div>
      </div>
    </div>
  )
}