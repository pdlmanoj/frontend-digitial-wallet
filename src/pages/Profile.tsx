import { useRef, useState, type ChangeEvent } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../auth/auth'
import { formatDOB, capitalize } from '../lib/format'
import { useProfileImage } from '../lib/useProfileImage'
import { Alert, Badge, Card, PageHeader, Spinner } from '../components/ui'

const MAX_IMAGE_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg']

export function Profile() {
  const { user } = useAuth()
  const { image, loading: imageLoading, uploading, error: imageError, upload } = useProfileImage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('Only PNG and JPEG images are allowed.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('The image must be 2 MB or smaller.')
      return
    }

    setUploadError(null)
    setNotice(null)
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)

    try {
      await upload(file)
      setNotice('Your profile image was updated.')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image.')
    } finally {
      URL.revokeObjectURL(objectUrl)
      setPreview(null)
    }
  }

  const imageSrc = preview ?? image?.image_url ?? null
  const initial = user.name.charAt(0).toUpperCase()

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center">
            <div className="group relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageLoading || uploading}
                className="relative h-20 w-20 overflow-hidden rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700 ring-emerald-600/30 transition focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed"
                aria-label={image ? 'Change profile photo' : 'Upload profile photo'}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={`${user.name} profile`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">{initial}</span>
                )}

                <span className="absolute inset-0 flex items-center justify-center bg-slate-900/0 text-white opacity-0 transition group-hover:bg-slate-900/40 group-hover:opacity-100 group-focus-within:bg-slate-900/40 group-focus-within:opacity-100">
                  <Pencil className="h-5 w-5" />
                </span>

                {(imageLoading || uploading) && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-emerald-700">
                    <Spinner className="h-5 w-5" />
                  </span>
                )}
              </button>

              <div
                role="tooltip"
                className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium leading-relaxed text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
              >
                PNG or JPEG, max 2 MB
              </div>
            </div>

            <div className="min-w-0 flex-1">
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>

          {(uploadError || imageError) && (
            <div className="border-t border-slate-100 px-5 py-4">
              <Alert tone="error" title="Could not update profile image">
                {uploadError ?? imageError}
              </Alert>
            </div>
          )}

          {notice && (
            <div className="border-t border-slate-100 px-5 py-4">
              <Alert tone="success">{notice}</Alert>
            </div>
          )}
        </Card>

        <Card title="Account details">
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
      </div>
    </div>
  )
}
