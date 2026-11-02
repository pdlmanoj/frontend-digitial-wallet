import { KeyRound } from 'lucide-react'
import type { DemoAccount } from '../config/demo'

interface DemoAccountAction {
  account: DemoAccount
  actionLabel: string
  onUse: () => void
}

export function DemoAccountsPanel({ accounts }: { accounts: DemoAccountAction[] }) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <KeyRound className="h-3.5 w-3.5" /> Demo accounts
      </p>
      <div className="mt-3 space-y-2">
        {accounts.map(({ account, actionLabel, onUse }) => (
          <div
            key={account.email}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700">{account.label}</p>
              <p className="truncate font-mono text-xs text-slate-600">{account.email}</p>
              <p className="font-mono text-xs text-slate-500">Password: {account.password}</p>
            </div>
            <button
              type="button"
              onClick={onUse}
              className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            >
              {actionLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
