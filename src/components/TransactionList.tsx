import { ArrowDownToLine, ArrowUpFromLine, Send, Activity } from 'lucide-react'
import type { LocalTransaction, TxType } from '../types'
import { formatDate, formatMoney } from '../lib/format'
import { TransactionStatusBadge } from './badges'
import { EmptyState } from './ui'

const typeMeta: Record<TxType, { label: string; icon: typeof Send; className: string; sign: number }> = {
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
  send: {
    label: 'Sent money',
    icon: Send,
    className: 'bg-sky-50 text-sky-600',
    sign: -1,
  },
}

export function TransactionRow({
  transaction,
}: {
  transaction: LocalTransaction
}) {
  const meta = typeMeta[transaction.type]
  const Icon = meta.icon
  const amount = Number(transaction.amount)
  const sign = meta.sign > 0 || amount <= 0 ? '+' : '−'
  const amountClass =
    meta.sign > 0 || amount <= 0 ? 'text-emerald-600' : 'text-slate-900'

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{meta.label}</p>
        <p className="truncate text-xs text-slate-500">{transaction.note}</p>
      </div>
      <div className="hidden text-right sm:block">
        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
          {sign}
          {formatMoney(transaction.amount, transaction.currency)}
        </p>
        <p className="text-xs text-slate-500">{formatDate(transaction.createdAt)}</p>
      </div>
      <div className="sm:hidden text-right">
        <p className={`text-sm font-semibold tabular-nums ${amountClass}`}>
          {sign}
          {formatMoney(transaction.amount, transaction.currency)}
        </p>
      </div>
      <TransactionStatusBadge status={transaction.status} />
    </li>
  )
}

export function TransactionList({
  transactions,
  emptyAction,
}: {
  transactions: LocalTransaction[]
  emptyAction?: React.ReactNode
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-6 w-6" />}
        title="No activity yet"
        description="Deposits, withdrawals, and transfers you make in this browser will show up here."
        action={emptyAction}
      />
    )
  }

  return (
    <ul className="divide-y divide-slate-100">
      {transactions.map((transaction) => (
        <TransactionRow key={transaction.id} transaction={transaction} />
      ))}
    </ul>
  )
}