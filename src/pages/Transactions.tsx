import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Send,
} from 'lucide-react'
import { useWalletBalance } from '../lib/useWallet'
import { useTransactions } from '../lib/useTransactions'
import { Alert, Card, PageHeader, Pagination, Spinner } from '../components/ui'
import { TransactionList } from '../components/TransactionList'

const PAGE_SIZE = 10

export function Transactions() {
  const [page, setPage] = useState(1)
  const { wallet } = useWalletBalance()
  const { transactions, pagination, loading, error, refresh } = useTransactions(
    page,
    PAGE_SIZE,
  )

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Deposits and withdrawals recorded by the API."
        actions={
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
        }
      />

      <div className="space-y-6">
        {error && (
          <Alert tone="error" title="Could not load transactions">
            {error}
          </Alert>
        )}

        <Card
          title="Transaction history"
          subtitle={
            pagination
              ? `${pagination.total} transaction${pagination.total === 1 ? '' : 's'}`
              : 'Loading history…'
          }
          actions={
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          }
        >
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading transactions…
            </div>
          ) : (
            <TransactionList
              transactions={transactions}
              currency={wallet?.currency ?? 'NPR'}
              emptyAction={
                <Link to="/deposit" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
                  Make your first deposit
                </Link>
              }
            />
          )}

          {pagination && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              total={pagination.total}
              onPageChange={setPage}
              disabled={loading}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
