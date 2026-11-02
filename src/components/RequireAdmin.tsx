import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/auth'
import { Spinner } from './ui'

/**
 * Only renders its children for authenticated admins (user.is_admin from
 * /manage/{id}/details). Everyone else is redirected out of the admin portal.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading admin session…
      </div>
    )
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/admin/login" replace />
  }

  if (!user.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
