import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../auth/auth'
import { ApiError } from '../../lib/api'
import { AuthShell } from '../../components/AuthShell'
import { DemoAccountsPanel } from '../../components/DemoAccountsPanel'
import { demoAccounts } from '../../config/demo'
import { Alert, Button, Input } from '../../components/ui'

export function AdminLogin() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const demo = location.state as { demoEmail?: string; demoPassword?: string } | null

  const [email, setEmail] = useState(demo?.demoEmail ?? '')
  const [password, setPassword] = useState(demo?.demoPassword ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user?.is_admin) {
    return <Navigate to="/admin" replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both your admin email and password.')
      return
    }

    setLoading(true)
    try {
      const { needTwoFactor } = await login(email.trim(), password, 'admin')
      navigate(needTwoFactor ? '/verify-2fa' : '/admin', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Unable to sign in. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Admin sign in"
      subtitle="Restricted access to the administration console."
      footer={
        <>
          Customer account?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Customer login
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Admin sign in failed">
            {error}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Admin email"
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div>
          <label htmlFor="admin-password" className="label">
            Password
          </label>
          <div className="relative">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="input pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Only accounts with administrator privileges can use this portal.
          </p>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {!loading && <ShieldCheck className="h-4 w-4" />}
          Sign in to admin console
        </Button>
      </form>

      <DemoAccountsPanel
        accounts={[
          {
            account: demoAccounts.admin,
            actionLabel: 'Use',
            onUse: () => {
              setEmail(demoAccounts.admin.email)
              setPassword(demoAccounts.admin.password)
              setError(null)
            },
          },
        ]}
      />
    </AuthShell>
  )
}
