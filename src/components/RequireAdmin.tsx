import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/auth'

/**
 * Only renders its children for authenticated admins (user.is_admin from
 * /auth/me). Everyone else is bounced back to the dashboard.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}