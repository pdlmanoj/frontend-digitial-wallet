import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react'
import { userApi } from '../lib/api'
import { isValidPhone } from '../lib/format'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Input, Select } from '../components/ui'
import type { Gender, SignupRequest } from '../types'

const OTP_PATTERN = /^[0-9]{6}$/

export function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState<SignupRequest>({
    name: '',
    email: '',
    password: '',
    phone_number: '',
    gender: 'male' as Gender,
    date_of_birth: '',
  })
  const [step, setStep] = useState<'details' | 'otp'>('details')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  const update = (key: keyof SignupRequest, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    setFieldErrors((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.name.trim()) errors.name = 'Please enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'Please enter a valid email address.'
    if (form.password.length < 8)
      errors.password = 'Password must be at least 8 characters long.'
    if (!isValidPhone(form.phone_number))
      errors.phone_number = 'Phone number must be exactly 10 digits.'
    if (!form.date_of_birth) {
      errors.date_of_birth = 'Please pick your date of birth.'
    } else if (form.date_of_birth > new Date().toISOString().slice(0, 10)) {
      errors.date_of_birth = 'Date of birth cannot be in the future.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const payload = (): SignupRequest => ({
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    password: form.password,
    phone_number: form.phone_number,
    gender: form.gender,
    date_of_birth: form.date_of_birth,
  })

  const handleDetailsSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!validate()) return

    setLoading(true)
    try {
      await userApi.sendOtp({ email: payload().email })
      setStep('otp')
      setNotice(`We sent a 6-digit verification code to ${payload().email}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send the verification code.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!OTP_PATTERN.test(otp)) {
      setError('Please enter the 6-digit code sent to your email.')
      return
    }

    setLoading(true)
    try {
      const details = payload()
      await userApi.verifyOtp({ email: details.email, otp })
      await userApi.signup(details)
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setOtp('')
      setError(err instanceof Error ? err.message : 'Unable to create your account.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError(null)
    setResending(true)
    try {
      await userApi.resendOtp({ email: payload().email })
      setOtp('')
      setNotice('A fresh verification code has been sent to your email.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend the verification code.')
    } finally {
      setResending(false)
    }
  }

  const handleBack = () => {
    setError(null)
    setNotice(null)
    setOtp('')
    setStep('details')
  }

  if (step === 'otp') {
    return (
      <AuthShell
        title="Verify your email"
        subtitle="Enter the code we sent before your account is created."
        footer={
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to details
          </button>
        }
      >
        <div className="mb-4">
          <Alert tone="info" title="Check your inbox">
            {notice ?? `We sent a 6-digit verification code to ${payload().email}.`}
          </Alert>
        </div>

        {error && (
          <div className="mb-4">
            <Alert tone="error" title="Verification failed">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <Input
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/[^0-9]/g, ''))}
            hint="The code expires after 5 minutes."
          />
          <Button type="submit" loading={loading} className="w-full">
            {!loading && <ShieldCheck className="h-4 w-4" />}
            Verify &amp; create account
          </Button>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Didn&apos;t receive it?</span>
            <Button
              type="button"
              variant="secondary"
              loading={resending}
              disabled={loading}
              onClick={handleResend}
            >
              {!resending && <RefreshCw className="h-4 w-4" />}
              Resend code
            </Button>
          </div>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Sign up to start using your wallet."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4">
          <Alert tone="error" title="Registration failed">
            {error}
          </Alert>
        </div>
      )}

      <form onSubmit={handleDetailsSubmit} className="space-y-4">
        <Input
          label="Full name"
          placeholder="Ram Sharma"
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          error={fieldErrors.name}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          error={fieldErrors.email}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          error={fieldErrors.password}
          hint="Must be at least 8 characters long."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Phone number"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="9847284181"
            value={form.phone_number}
            onChange={(event) =>
              update('phone_number', event.target.value.replace(/[^0-9]/g, ''))
            }
            error={fieldErrors.phone_number}
          />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(event) => update('gender', event.target.value)}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
        <Input
          label="Date of birth"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={form.date_of_birth}
          onChange={(event) => update('date_of_birth', event.target.value)}
          error={fieldErrors.date_of_birth}
        />
        <Button type="submit" loading={loading} className="w-full">
          {!loading && <MailCheck className="h-4 w-4" />}
          Send verification code
        </Button>
      </form>
    </AuthShell>
  )
}
