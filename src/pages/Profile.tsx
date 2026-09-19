import { Info } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { formatDOB, capitalize } from '../lib/format'
import { Badge, Card, PageHeader } from '../components/ui'

export function Profile() {
  const { user } = useAuth()
  if (!user) return null

  const accountTone =
    user.status === 'active' ? 'success' : user.status === 'inactive' ? 'danger' : 'warning'

  const rows: { label: string; value: string }[] = [
    { label: 'Full name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Phone number', value: user.phone_number },
    { label: 'Gender', value: capitalize(user.gender) },
    { label: 'Date of birth', value: formatDOB(user.date_of_birth) },
  ]

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your account information as stored by the API." />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-900">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={accountTone === 'success' ? 'success' : 'warning'}>
                  {capitalize(user.status)}
                </Badge>
                <Badge tone={user.is_2fa_enable ? 'success' : 'neutral'}>
                  {user.is_2fa_enable ? '2FA enabled' : '2FA off'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Account details" subtitle="All fields come from /auth/me.">
          <dl className="divide-y divide-slate-100 px-5">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-4"
              >
                <dt className="text-sm text-slate-500">{row.label}</dt>
                <dd className="text-sm font-medium text-slate-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            The API doesn't expose an update-profile endpoint yet, so this page is
            read-only. You can change your password and 2FA settings under Security.
          </p>
        </div>
      </div>
    </div>
  )
}