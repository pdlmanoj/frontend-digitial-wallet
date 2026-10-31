import { ArrowDownToLine, ArrowUpFromLine, Activity } from 'lucide-react'
import type { ServerTransaction, TxType } from '../types'
import { formatDate, formatMoney } from '../lib/format'
import { TransactionStatusBadge } from './badges'
import { EmptyState } from './ui'

const typeMeta: Record<TxType, { label: string; icon: typeof Activity; className: string; sign: number }> = {
  deposit: {
    label: 'Deposit',
    icon: ArrowDownToLine,
    className: 'bg-emerald-50 text-emerald-600',
    sign: 1,
  },
  withdraw: {
    label: 'Withdrawal',
    icon: ArrowUpFromLine,
    className: 'bg-amber-50 text-amber-600',
    sign: -1,
  },
}

export function TransactionRow({
  transaction,
  currency = 'NPR',
}: {
  transaction: ServerTransaction
  currency?: string
}) {
  const meta = typeMeta[transaction.type]
  const Icon = meta.icon
  const sign = meta.sign > 0 ? '+' : '−'
  const amountClass = meta.sign > 0 ? 'text-emerald-600' : 'text-slate-900'

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{meta.label}</p>
        <p className="truncate text-xs text-slate-500">Ref {transaction.reference_id}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
          {sign}
          {formatMoney(transaction.amount, currency)}
        </p>
        <p className="text-xs text-slate-500">{formatDate(transaction.created_at)}</p>
      </div>
      <div className="sm:hidden text-right">
        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
          {sign}
          {formatMoney(transaction.amount, currency)}
        </p>
      </div>
      <TransactionStatusBadge status={transaction.status} />
    </li>
  )
}

export function TransactionList({
  transactions,
  currency,
  emptyAction,
}: {
  transactions: ServerTransaction[]
  currency?: string
  emptyAction?: React.ReactNode
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No transactions yet"
        description="Deposits and withdrawals from your wallet will show up here."
        action={emptyAction}
      />
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          currency={currency}
        />
      ))}
    </ul>
  )
}
