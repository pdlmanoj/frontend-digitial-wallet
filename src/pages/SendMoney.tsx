import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import { Alert, Button, Card, Input, PageHeader } from '../components/ui'
import { WalletCard } from '../components/WalletCard'
import { transactionApi } from '../lib/api'
import { formatMoney, isValidPhone } from '../lib/format'
import { useWalletBalance } from '../lib/useWallet'
import type { SubmitResult } from '../components/MoneyForm'

export function SendMoney() {
  const { wallet, loading, refresh } = useWalletBalance()

  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState<{ phone: string; amount: number } | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Send money" subtitle="Transfer to a registered user by phone number." />
        <WalletCard wallet={null} loading />
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="space-y-6">
        <PageHeader title="Send money" subtitle="Transfer to a registered user by phone number." />
        <WalletCard wallet={null} loading={false} />
      </div>
    )
  }

  const handleReview = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setResult(null)
    setPhoneError(null)
    setAmountError(null)

    const value = Number(amount)
    let valid = true
    if (!phone || !isValidPhone(phone)) {
      setPhoneError('Enter a 10-digit phone number.')
      valid = false
    }
    if (!amount || Number.isNaN(value) || value < 1) {
      setAmountError('Amount must be at least 1.')
      valid = false
    }
    if (!valid) return

    setReview({ phone, amount: value })
  }

  const handleConfirm = async () => {
    if (!review) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const response = await transactionApi.sendMoney(review.phone, review.amount)
      setResult({ message: response.msg, status: 'success' })
      setReview(null)
      setPhone('')
      setAmount('')
      void refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed. Please try again.')
      setReview(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Send money" subtitle="Transfer to a registered user by phone number." />

      <div className="space-y-6">
        <WalletCard wallet={wallet} loading={false} />

        {!wallet.is_active && (
          <Alert tone="warning" title="Wallet inactive">
            Your wallet is not active, so the API will reject transfers. Please contact an
            administrator to reactivate it.
          </Alert>
        )}

        <Card title="Send money to a user" subtitle="The receiver is identified by their 10-digit phone number.">
          <div className="px-5 py-5">
            {error && (
              <div className="mb-4">
                <Alert tone="error" title="Transfer failed">
                  {error}
                </Alert>
              </div>
            )}

            {result && (
              <div className="mb-4">
                <Alert tone="success">{result.message}</Alert>
              </div>
            )}

            {review ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <p className="text-sm font-medium text-emerald-800">
                    You are about to send
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-900">
                    {formatMoney(review.amount, wallet.currency)}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    to user with phone{' '}
                    <span className="font-semibold">+{review.phone}</span>. This can't be
                    undone.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setReview(null)} disabled={submitting}>
                    Back
                  </Button>
                  <Button onClick={handleConfirm} loading={submitting}>
                    {!submitting && <Send className="h-4 w-4" />}
                    Confirm &amp; send
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReview} className="max-w-sm space-y-4">
                <Input
                  label="Receiver phone number"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="9847284181"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ''))}
                  error={phoneError ?? undefined}
                  hint="Must match a registered user, e.g. their wallet phone."
                />
                <Input
                  label="Amount"
                  type="number"
                  min={1}
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  error={amountError ?? undefined}
                  hint={`Available balance: ${formatMoney(wallet.balance, wallet.currency)}`}
                />
                <Button type="submit" className="w-full">
                  <Send className="h-4 w-4" />
                  Review transfer
                </Button>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}