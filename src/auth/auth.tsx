import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  adminApi,
  authApi,
  clearTokens,
  getAccessToken,
  getAccessTokenSubject,
  setTokens,
  UNAUTHORIZED_EVENT,
} from '../lib/api'
import type { LoginTokenResponse, UserProfile } from '../types'

const TWO_FACTOR_KEY = 'dw.2fa.token'
const LOGIN_ROLE_KEY = 'dw.login.role'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
type LoginRole = 'customer' | 'admin'

interface LoginOutcome {
  needTwoFactor: boolean
  user: UserProfile | null
}

interface AuthContextValue {
  user: UserProfile | null
  status: AuthStatus
  login: (
    email: string,
    password: string,
    role?: LoginRole,
  ) => Promise<LoginOutcome>
  verifyTotp: (totp: string) => Promise<UserProfile | null>
  logout: () => void
  refreshUser: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const restoreRef = useRef<Promise<UserProfile | null> | null>(null)

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await authApi.me()
      setUser(profile)
      setStatus('authenticated')
      return profile
    } catch {
      // Admins are blocked from /auth/me by get_current_user, so resolve their
      // profile through the admin-only /manage endpoint instead.
      const subject = getAccessTokenSubject()
      if (subject) {
        try {
          const admin = await adminApi.getUser(subject)
          if (admin.is_admin) {
            setUser(admin)
            setStatus('authenticated')
            return admin
          }
        } catch {
          // Fall through to unauthenticated below.
        }
      }

      clearTokens()
      setUser(null)
      setStatus('unauthenticated')
      return null
    }
  }, [])

  // Restore a session on first load: if we have tokens, validate them.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getAccessToken()) {
        if (!cancelled) setStatus('unauthenticated')
        return
      }
      if (!restoreRef.current) {
        restoreRef.current = refreshUser().finally(() => {
          restoreRef.current = null
        })
      }
      const profile = await restoreRef.current
      if (cancelled) return
      if (profile) setStatus('authenticated')
      else {
        setUser(null)
        setStatus('unauthenticated')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  // If the API client had to drop the session (refresh token expired), log out.
  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null)
      setStatus('unauthenticated')
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const rejectWrongPortal = useCallback((profile: UserProfile, role: LoginRole) => {
    if (role === 'admin' && !profile.is_admin) {
      throw new Error('This account is not an administrator. Use the customer sign-in.')
    }
    if (role === 'customer' && profile.is_admin) {
      throw new Error('This is an administrator account. Use the admin sign-in.')
    }
  }, [])

  const login = useCallback(
    async (
      email: string,
      password: string,
      role: LoginRole = 'customer',
    ): Promise<LoginOutcome> => {
      const response = await authApi.login(email, password)

      // 2FA-enabled accounts get a temporary token and MUST verify a TOTP
      // code before any access token is issued.
      if ('required_2fa_verification' in response && response.required_2fa_verification) {
        sessionStorage.setItem(TWO_FACTOR_KEY, response.token)
        sessionStorage.setItem(LOGIN_ROLE_KEY, role)
        return { needTwoFactor: true, user: null }
      }

      // At this point the response is a normal token pair.
      const tokens = response as LoginTokenResponse
      setTokens(tokens.access_token, tokens.refresh_token)
      const profile = await refreshUser()

      if (!profile) {
        throw new Error('Unable to load your account. Please try again.')
      }

      try {
        rejectWrongPortal(profile, role)
      } catch (error) {
        clearTokens()
        sessionStorage.removeItem(TWO_FACTOR_KEY)
        sessionStorage.removeItem(LOGIN_ROLE_KEY)
        setUser(null)
        setStatus('unauthenticated')
        throw error
      }

      return { needTwoFactor: false, user: profile }
    },
    [refreshUser, rejectWrongPortal],
  )

  const verifyTotp = useCallback(
    async (totp: string): Promise<UserProfile | null> => {
      const tempToken = sessionStorage.getItem(TWO_FACTOR_KEY)
      if (!tempToken) throw new Error('2FA session expired. Please sign in again.')

      const tokens = await authApi.verifyTwoFactor(tempToken, totp)
      setTokens(tokens.access_token, tokens.refresh_token)
      const profile = await refreshUser()
      const role = (sessionStorage.getItem(LOGIN_ROLE_KEY) as LoginRole | null) ?? 'customer'

      if (!profile) {
        throw new Error('Unable to load your account. Please try again.')
      }

      try {
        rejectWrongPortal(profile, role)
      } catch (error) {
        clearTokens()
        sessionStorage.removeItem(TWO_FACTOR_KEY)
        sessionStorage.removeItem(LOGIN_ROLE_KEY)
        setUser(null)
        setStatus('unauthenticated')
        throw error
      }

      sessionStorage.removeItem(TWO_FACTOR_KEY)
      sessionStorage.removeItem(LOGIN_ROLE_KEY)
      return profile
    },
    [refreshUser, rejectWrongPortal],
  )

  const logout = useCallback(() => {
    void authApi.logout().catch(() => {
      // The local session is cleared regardless of the server response.
    })
    clearTokens()
    sessionStorage.removeItem(TWO_FACTOR_KEY)
    sessionStorage.removeItem(LOGIN_ROLE_KEY)
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({ user, status, login, verifyTotp, logout, refreshUser }),
    [user, status, login, verifyTotp, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
