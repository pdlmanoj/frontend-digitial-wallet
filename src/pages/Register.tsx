import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { userApi } from '../lib/api'
import { isValidPhone } from '../lib/format'
import { AuthShell } from '../components/AuthShell'
import { Alert, Button, Input, Select } from '../components/ui'
import type { Gender } from '../types'

export function Register() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone_number: '',
    gender: 'male' as Gender,
    date_of_birth: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form, value: string) => {
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validate()) return

    setLoading(true)
    try {
      await userApi.signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone_number: form.phone_number,
        gender: form.gender,
        date_of_birth: form.date_of_birth,
      })
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
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

      <form onSubmit={handleSubmit} className="space-y-4">
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
          {!loading && <UserPlus className="h-4 w-4" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}