import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Input } from '../components/ui'

const TWO_FACTOR_KEY = 'dw.2fa.token'

export function VerifyTwoFactor() {
  const { verifyTotp, user } = useAuth()
  const navigate = useNavigate()

  const [totp, setTotp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Already fully signed in, nothing to verify.
  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  const hasPendingToken = sessionStorage.getItem(TWO_FACTOR_KEY)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!/^[0-9]{6}$/.test(totp)) {
      setError('Please enter the 6-digit code from your authenticator app.')
      return
    }

    setLoading(true)
    try {
      await verifyTotp(totp)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify the code.')
    } finally {
      setLoading(false)
    }
  }

  if (!hasPendingToken) {
    return (
      <AuthShell
        title="2FA verification required"
        subtitle="Confirm your identity with an authenticator app."
        footer={
          <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Back to sign in
          </Link>
        }
      >
        <Alert tone="error" title="Session expired">
          This sign-in session has expired or already completed. Please sign in again to
          get a fresh verification code.
        </Alert>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Enter your code"
      subtitle="This account has two-factor authentication enabled."
      footer={
        <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
          Start over
        </Link>
      }
    >
      <div className="mb-4">
        <Alert tone="info" title="Two-factor authentication">
          Open your authenticator app and enter the 6-digit code. The temporary sign-in
          token expires after 5 minutes.
        </Alert>
      </div>

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Verification failed">
            {error}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={totp}
          onChange={(event) => setTotp(event.target.value.replace(/[^0-9]/g, ''))}
        />
        <Button type="submit" loading={loading} className="w-full">
          {!loading && <ShieldCheck className="h-4 w-4" />}
          Verify &amp; continue
        </Button>
      </form>
    </AuthShell>
  )
}