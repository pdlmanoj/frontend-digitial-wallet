import { Link } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Layers,
  Wallet as WalletIcon,
} from 'lucide-react'
import { useAuth } from '../auth/auth'
import { useWalletBalance } from '../lib/useWallet'
import { getActivity } from '../lib/activity'
import { formatMoney, greeting } from '../lib/format'
import { Card, PageHeader, Spinner } from '../components/ui'
import { WalletCard } from '../components/WalletCard'
import { WalletStatusBadge } from '../components/badges'
import { TransactionList } from '../components/TransactionList'

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  hint?: string
}) {
  return (
    <div className="card flex items-start gap-3 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

export function Dashboard() {
  const { user, status } = useAuth()
  const { wallet, loading } = useWalletBalance()
  const activity = getActivity()
  const recent = activity.slice(0, 6)

  if (status !== 'authenticated' || !user) return null

  const firstName = user.name.split(' ')[0]

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle="Here's a quick look at your wallet."
      />

      <div className="space-y-6">
        <WalletCard wallet={wallet} loading={loading} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total balance"
            value={loading ? <Spinner className="h-5 w-5" /> : wallet ? formatMoney(wallet.amount, wallet.currency) : '—'}
            icon={<WalletIcon className="h-5 w-5" />}
            hint={wallet ? `${wallet.currency} currency` : 'No wallet yet'}
          />
          <StatCard
            label="Wallets"
            value={wallet ? '1' : '0'}
            icon={<Layers className="h-5 w-5" />}
            hint="One wallet per account"
          />
          <StatCard
            label="Wallet status"
            value={
              wallet ? (
                <span className="inline-block align-bottom">
                  <WalletStatusBadge active={wallet.is_active} />
                </span>
              ) : (
                <span className="text-base">—</span>
              )
            }
            icon={<CheckCircle2 className="h-5 w-5" />}
            hint="Active wallets can transact"
          />
          <StatCard
            label="Recent activity"
            value={activity.length}
            icon={<ArrowLeftRight className="h-5 w-5" />}
            hint="This browser session"
          />
        </div>

        <Card
          title="Recent transactions"
          subtitle={`${recent.length} recorded in this browser session`}
          actions={
            <Link
              to="/transactions"
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          }
        >
          <TransactionList
            transactions={recent}
            emptyAction={
              <Link to="/deposit" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                Make your first deposit
              </Link>
            }
          />
        </Card>
      </div>
    </div>
  )
}