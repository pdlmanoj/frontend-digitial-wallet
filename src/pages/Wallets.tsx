import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Plus, Send } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { useWalletBalance } from '../lib/useWallet'
import { walletApi } from '../lib/api'
import { formatMoney } from '../lib/format'
import { Alert, Button, Card, Input, PageHeader, Spinner } from '../components/ui'
import { WalletStatusBadge } from '../components/badges'

function CreateWalletForm({ onCreated }: { onCreated: () => void }) {
  const [balance, setBalance] = useState('')
  const [currency] = useState('NPR')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const amount = Number(balance)

    if (!balance || Number.isNaN(amount) || amount < 1) {
      setError('Opening balance must be at least 1.')
      return
    }

    setLoading(true)
    try {
      // Note: the backend's Pydantic schema accepts the opening balance under
      // the JSON key "balance" (validation alias), even though the DB column
      // is also called balance.
      await walletApi.create({ currency, balance: amount })
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the wallet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title="Create your wallet"
      subtitle="Each account has a single wallet. Currency is currently fixed to NPR."
    >
      <div className="px-5 py-5">
        {error && (
          <div className="mb-4">
            <Alert tone="error" title="Could not create wallet">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
          <Input
            label="Opening balance"
            type="number"
            min={1}
            step="0.01"
            placeholder="0.00"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            hint="You can fund the wallet later with a deposit."
          />
          <Input
            label="Currency"
            value={`${currency} (Nepalese Rupee)`}
            disabled
            hint="Only NPR is supported by the API."
          />
          <Button type="submit" loading={loading} className="w-full">
            {!loading && <Plus className="h-4 w-4" />}
            Create wallet
          </Button>
        </form>
      </div>
    </Card>
  )
}

export function Wallets() {
  const { user } = useAuth()
  const { wallet, loading, refresh } = useWalletBalance()
  const [justCreated, setJustCreated] = useState(false)

  const onCreated = () => {
    setJustCreated(true)
    void refresh()
  }

  return (
    <div>
      <PageHeader title="Wallet" />

      <div className="space-y-6">
        {justCreated && (
          <Alert tone="success" title="Wallet created">
            Your wallet is ready. You can now deposit, withdraw, and send money.
          </Alert>
        )}

        {loading ? (
          <div className="card flex h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading wallet…
          </div>
        ) : wallet ? (
          <Card title="Wallet details">
            <dl className="divide-y divide-slate-100 px-5">
              <div className="flex items-center justify-between py-4">
                <dt className="text-sm text-slate-500">Available balance</dt>
                <dd className="text-lg font-bold tracking-tight text-slate-900">
                  {formatMoney(wallet.balance, wallet.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-4">
                <dt className="text-sm text-slate-500">Status</dt>
                <dd>
                  <WalletStatusBadge active={wallet.is_active} />
                </dd>
              </div>
              <div className="flex items-center justify-between py-4">
                <dt className="text-sm text-slate-500">Currency</dt>
                <dd className="text-sm font-medium text-slate-900">{wallet.currency}</dd>
              </div>
              <div className="flex items-center justify-between py-4">
                <dt className="text-sm text-slate-500">Held amount</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {formatMoney(wallet.hold_amount, wallet.currency)}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-4">
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
          </Card>
        ) : (
          <CreateWalletForm onCreated={onCreated} />
        )}

        {user && (
          <div className="text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{user.email}</span>
          </div>
        )}
      </div>
    </div>
  )
}