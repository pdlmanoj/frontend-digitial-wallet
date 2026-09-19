import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, clearTokens, getAccessToken, setTokens, UNAUTHORIZED_EVENT } from '../lib/api'
import type { LoginTokenResponse, UserProfile } from '../types'

const TWO_FACTOR_KEY = 'dw.2fa.token'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface LoginOutcome {
  needTwoFactor: boolean
}

interface AuthContextValue {
  user: UserProfile | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<LoginOutcome>
  verifyTotp: (totp: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const refreshUser = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const profile = await authApi.me()
      setUser(profile)
      setStatus('authenticated')
      return profile
    } catch {
      setUser(null)
      setStatus('unauthenticated')
      return null
    }
  }, [])

  // Restore a session on first load: if we have tokens, validate them via /auth/me.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getAccessToken()) {
        if (!cancelled) setStatus('unauthenticated')
        return
      }
      const profile = await refreshUser()
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

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const response = await authApi.login(email, password)

      // 2FA-enabled accounts get a temporary token and MUST verify a TOTP
      // code before any access token is issued.
      if ('required_2fa_verification' in response && response.required_2fa_verification) {
        sessionStorage.setItem(TWO_FACTOR_KEY, response.token)
        return { needTwoFactor: true }
      }

      // At this point the response is a normal token pair.
      const tokens = response as LoginTokenResponse
      setTokens(tokens.access_token, tokens.refresh_token)
      await refreshUser()
      return { needTwoFactor: false }
    },
    [refreshUser],
  )

  const verifyTotp = useCallback(
    async (totp: string): Promise<void> => {
      const tempToken = sessionStorage.getItem(TWO_FACTOR_KEY)
      if (!tempToken) throw new Error('2FA session expired. Please sign in again.')

      const tokens = await authApi.verifyTwoFactor(tempToken, totp)
      sessionStorage.removeItem(TWO_FACTOR_KEY)
      setTokens(tokens.access_token, tokens.refresh_token)
      await refreshUser()
    },
    [refreshUser],
  )

  const logout = useCallback(() => {
    clearTokens()
    sessionStorage.removeItem(TWO_FACTOR_KEY)
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