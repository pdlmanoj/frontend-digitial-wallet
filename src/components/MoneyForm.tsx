import { useState, type FormEvent, type ReactNode } from 'react'
import { Alert, Button, Card, Input } from './ui'
import { useWalletBalance } from '../lib/useWallet'
import { formatMoney } from '../lib/format'
import { WalletCard } from './WalletCard'

export interface SubmitResult {
  message: string
  status: 'success' | 'failed'
}

interface AmountFormProps {
  icon: ReactNode
  title: string
  subtitle: string
  submitLabel: string
  hint: string
  onSubmit: (amount: number) => Promise<SubmitResult>
}

/**
 * Shared deposit/withdraw form. Renders a Live balance card on top, an amount
 * field, and a result banner after the API call.
 */
export function AmountForm({
  icon,
  title,
  subtitle,
  submitLabel,
  hint,
  onSubmit,
}: AmountFormProps) {
  const { wallet, loading, refresh } = useWalletBalance()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setResult(null)

    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value < 1) {
      setError('Amount must be at least 1.')
      return
    }

    setSubmitting(true)
    try {
      const response = await onSubmit(value)
      setResult(response)
      setAmount('')
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <WalletCard wallet={null} loading />
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="space-y-6">
        <WalletCard wallet={null} loading={false} />
      </div>
    )
  }

  if (!wallet.is_active) {
    return (
      <div className="space-y-6">
        <WalletCard wallet={wallet} loading={false} />
        <Alert tone="warning" title="Wallet inactive">
          Your wallet is not active, so transactions are blocked by the API. Please
          contact an administrator to reactivate it.
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <WalletCard wallet={wallet} loading={false} />

      <Card title={title} subtitle={subtitle}>
        <div className="px-5 py-5">
          <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
            <span className="text-slate-400">{icon}</span>
            Current balance:{' '}
            <span className="font-semibold text-slate-900">
              {formatMoney(wallet.balance, wallet.currency)}
            </span>
          </div>

          {error && (
            <div className="mb-4">
              <Alert tone="error" title="Transaction failed">
                {error}
              </Alert>
            </div>
          )}

          {result && (
            <div className="mb-4">
              <Alert tone={result.status === 'success' ? 'success' : 'error'}>
                {result.message}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
            <Input
              label="Amount"
              type="number"
              min={1}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              hint={hint}
            />
            <Button type="submit" loading={submitting} className="w-full">
              {!submitting && (
                <span className="inline-flex items-center gap-2">
                  {icon}
                  {submitLabel}
                </span>
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}