import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Eraser, Info, Send } from 'lucide-react'
import { clearActivity, getActivity } from '../lib/activity'
import { Card, PageHeader } from '../components/ui'
import { TransactionList } from '../components/TransactionList'
import type { LocalTransaction } from '../types'

export function Transactions() {
  const [activities, setActivities] = useState<LocalTransaction[]>(() => getActivity())

  const handleClear = () => {
    clearActivity()
    setActivities([])
  }

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Money in, money out, and transfers."
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
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            The API does <span className="font-medium text-slate-700">not</span> expose a
            transaction history endpoint yet. Each deposit/withdrawal is still recorded in
            the database with a unique reference ID; this list simply tracks what you do in
            this browser session.
          </p>
        </div>

        <Card
          title="Your activity"
          subtitle={`${activities.length} transaction${activities.length === 1 ? '' : 's'} recorded`}
          actions={
            activities.length > 0 ? (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear local log
              </button>
            ) : undefined
          }
        >
          <TransactionList
            transactions={activities}
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