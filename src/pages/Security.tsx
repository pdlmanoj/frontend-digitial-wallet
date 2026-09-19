import { useEffect, useState, type FormEvent } from 'react'
import { QrCode, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { authApi, userApi } from '../lib/api'
import { Alert, Button, Card, Input, Modal, PageHeader } from '../components/ui'

export function Security() {
  const { user, refreshUser } = useAuth()
  const isTwoFactorEnabled = user?.is_2fa_enable ?? false

  // --- 2FA setup modal state ---
  const [setupOpen, setSetupOpen] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [setupTotp, setSetupTotp] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null)

  // --- disable 2FA modal state ---
  const [disableOpen, setDisableOpen] = useState(false)
  const [disableLoading, setDisableLoading] = useState(false)
  const [disableError, setDisableError] = useState<string | null>(null)
  const [disableSuccess, setDisableSuccess] = useState<string | null>(null)

  // --- change password state ---
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)

  // Fetch the QR code whenever the setup modal opens.
  useEffect(() => {
    if (!setupOpen) return
    let url: string | null = null
    setSetupError(null)
    setSetupSuccess(null)
    setSetupTotp('')
    setQrUrl(null)
    ;(async () => {
      try {
        url = await authApi.enableTwoFactor()
        setQrUrl(url)
      } catch (err) {
        setSetupError(err instanceof Error ? err.message : 'Failed to generate the QR code.')
      }
    })()
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [setupOpen])

  const confirmSetup = async (event: FormEvent) => {
    event.preventDefault()
    setSetupError(null)
    setSetupSuccess(null)
    if (!/^[0-9]{6}$/.test(setupTotp)) {
      setSetupError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setSetupLoading(true)
    try {
      const response = await authApi.confirmTwoFactor(setupTotp)
      await refreshUser()
      setSetupSuccess(response.msg)
      setSetupOpen(false)
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not confirm the code.')
    } finally {
      setSetupLoading(false)
    }
  }

  const confirmDisable = async () => {
    setDisableError(null)
    setDisableSuccess(null)
    setDisableLoading(true)
    try {
      const response = await authApi.disableTwoFactor()
      await refreshUser()
      setDisableSuccess(response.msg)
      setDisableOpen(false)
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : 'Could not disable 2FA.')
    } finally {
      setDisableLoading(false)
    }
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.')
      return
    }
    setPasswordLoading(true)
    try {
      const response = await userApi.changePassword(currentPassword, newPassword)
      setPasswordSuccess(response.msg)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change the password.')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Protect your account with 2FA and a strong password."
      />

      <div className="space-y-6">
        <Card title="Two-factor authentication" subtitle="TOTP codes via an authenticator app.">
          <div className="px-5 py-5">
            {setupSuccess && (
              <div className="mb-4">
                <Alert tone="success">{setupSuccess}</Alert>
              </div>
            )}
            {disableSuccess && (
              <div className="mb-4">
                <Alert tone="success">{disableSuccess}</Alert>
              </div>
            )}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isTwoFactorEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {isTwoFactorEnabled ? 'Enabled' : 'Not enabled'}
                  </p>
                  <p className="mt-0.5 max-w-lg text-sm text-slate-500">
                    {isTwoFactorEnabled
                      ? 'New sign-ins require a 6-digit code from your authenticator app.'
                      : 'Add a second layer of security. You will need an authenticator app such as Google Authenticator.'}
                  </p>
                </div>
              </div>
              {isTwoFactorEnabled ? (
                <Button variant="danger" onClick={() => setDisableOpen(true)}>
                  <ShieldOff className="h-4 w-4" /> Disable 2FA
                </Button>
              ) : (
                <Button onClick={() => setSetupOpen(true)}>
                  <QrCode className="h-4 w-4" /> Set up 2FA
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card title="Change password" subtitle="You can't reuse your current or previous password.">
          <div className="px-5 py-5">
            {passwordSuccess && (
              <div className="mb-4">
                <Alert tone="success">{passwordSuccess}</Alert>
              </div>
            )}
            {passwordError && (
              <div className="mb-4">
                <Alert tone="error" title="Could not change password">
                  {passwordError}
                </Alert>
              </div>
            )}
            <form onSubmit={changePassword} className="max-w-sm space-y-4">
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                hint="Must differ from your current and previous password."
              />
              <Button type="submit" loading={passwordLoading}>
                {!passwordLoading && <KeyRound className="h-4 w-4" />}
                Update password
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* 2FA setup modal */}
      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Set up two-factor authentication">
        <div className="space-y-4">
          {setupError && <Alert tone="error">{setupError}</Alert>}

          <p className="text-sm text-slate-600">
            Scan the QR code below with your authenticator app, then enter the 6-digit code
            it shows to confirm. The setup key expires after 5 minutes.
          </p>

          <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="TOTP QR code"
                className="h-48 w-48 rounded-lg"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-sm text-slate-400">
                Loading QR code…
              </div>
            )}
          </div>

          <form onSubmit={confirmSetup} className="space-y-3">
            <Input
              label="6-digit code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={setupTotp}
              onChange={(event) => setSetupTotp(event.target.value.replace(/[^0-9]/g, ''))}
            />
            <Button type="submit" loading={setupLoading} className="w-full" disabled={!qrUrl}>
              {!setupLoading && <ShieldCheck className="h-4 w-4" />}
              Activate 2FA
            </Button>
          </form>
        </div>
      </Modal>

      {/* Disable 2FA modal */}
      <Modal open={disableOpen} onClose={() => setDisableOpen(false)} title="Disable two-factor authentication">
        <div className="space-y-4">
          {disableError && <Alert tone="error">{disableError}</Alert>}
          <p className="text-sm text-slate-600">
            Are you sure? Your account will no longer require a one-time code at sign-in.
            You can set it up again later.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDisableOpen(false)} disabled={disableLoading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDisable} loading={disableLoading}>
              {!disableLoading && <ShieldOff className="h-4 w-4" />}
              Disable 2FA
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}