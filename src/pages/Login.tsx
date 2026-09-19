import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { ApiError } from '../lib/api'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Input } from '../components/ui'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const registered = (location.state as { registered?: boolean } | null)?.registered === true

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.')
      return
    }

    setLoading(true)
    try {
      const { needTwoFactor } = await login(email.trim(), password)
      navigate(needTwoFactor ? '/verify-2fa' : from, { replace: true })
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
      title="Welcome back"
      subtitle="Manage your money securely."
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Create one
          </Link>
        </>
      }
    >
      {registered && (
        <div className="mb-4">
          <Alert tone="success" title="Account created">
            Your account is ready. Please sign in to continue.
          </Alert>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Sign in failed">
            {error}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <div>
          <label htmlFor="login-password" className="label">
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
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
            The API locks an account after repeated failed attempts and can require a
            one-time code when 2FA is on.
          </p>
        </div>

        <Button type="submit" loading={loading} className="w-full">
          {!loading && <LogIn className="h-4 w-4" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}