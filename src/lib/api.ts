import type {
  AdminUser,
  AdminWallet,
  CreateWalletRequest,
  LoginResponse,
  LoginTokenResponse,
  MessageResponse,
  PaginatedResponse,
  ProfileImage,
  ProfileImageResponse,
  RefreshResponse,
  ServerTransaction,
  UserProfile,
  WalletBalance,
} from '../types'

// The base URL of the FastAPI backend. Override by setting VITE_API_BASE_URL
// in a .env file, e.g. VITE_API_BASE_URL=https://api.example.com
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000'

const ACCESS_KEY = 'dw.access_token'
const REFRESH_KEY = 'dw.refresh_token'

// Cache successful GET responses briefly and share in-flight requests. This
// avoids duplicate calls when several components mount at once (or when React
// StrictMode replays effects in development) and when navigating between
// screens that need the same data.
const GET_CACHE_TTL = 15_000
const getCache = new Map<string, { expires: number; value: unknown }>()
const getInFlight = new Map<string, Promise<unknown>>()
let getCacheVersion = 0

export function invalidateApiCache(prefix?: string): void {
  getCacheVersion += 1
  if (!prefix) {
    getCache.clear()
    return
  }
  for (const key of getCache.keys()) {
    if (key.includes(prefix)) getCache.delete(key)
  }
}

async function cachedGet<T>(
  key: string,
  loader: () => Promise<T>,
  force = false,
): Promise<T> {
  const token = getAccessToken() ?? 'anonymous'
  const cacheKey = `${token}:${key}`

  if (!force) {
    const cached = getCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) return cached.value as T

    const pending = getInFlight.get(cacheKey)
    if (pending) return pending as Promise<T>
  }

  const version = getCacheVersion
  const promise = loader()
    .then((value) => {
      if (version === getCacheVersion) {
        getCache.set(cacheKey, {
          expires: Date.now() + GET_CACHE_TTL,
          value,
        })
      }
      return value
    })
    .finally(() => {
      if (getInFlight.get(cacheKey) === promise) getInFlight.delete(cacheKey)
    })

  getInFlight.set(cacheKey, promise)
  return promise
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function setTokens(
  accessToken: string,
  refreshToken: string | null,
): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  invalidateApiCache()
}

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return atob(padded)
  } catch {
    return null
  }
}

/**
 * Reads the `sub` claim from the current access token. The backend stores the
 * user UUID there, which lets us identify an admin account (admins are blocked
 * from /auth/me by get_current_user, so we resolve them via /manage instead).
 */
export function getAccessTokenSubject(): string | null {
  const token = getAccessToken()
  if (!token) return null

  const parts = token.split('.')
  if (parts.length < 2) return null

  const json = decodeBase64Url(parts[1])
  if (!json) return null

  try {
    const payload = JSON.parse(json) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// A tiny event so the AuthProvider can react when the API client was forced
// to log the user out (e.g. refresh token expired).
export const UNAUTHORIZED_EVENT = 'dw:unauthorized'

function emitUnauthorized(): void {
  clearTokens()
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
}

/**
 * Normalizes the many different error shapes the FastAPI backend returns into
 * a single human readable message. Shapes handled:
 *  - { detail: { error_type, msg } }        (HTTPException with a dict detail)
 *  - { detail: "..." }                       (HTTPException with a string)
 *  - { detail: [ { loc, msg, type } ] }      (Pydantic 422 validation errors)
 *  - { error: "Rate limit exceeded: ..." }   (slowapi 429)
 */
export function extractErrorMessage(blob: unknown, fallback: string): string {
  if (!blob || typeof blob !== 'object') {
    return typeof blob === 'string' && blob ? blob : fallback
  }
  const obj = blob as Record<string, unknown>

  if (typeof obj.msg === 'string' && obj.msg) {
    return obj.msg
  }

  if (typeof obj.message === 'string' && obj.message) {
    return obj.message
  }

  if ('detail' in obj) {
    return extractErrorMessage(obj.detail, fallback)
  }

  // slowapi 429 responses use a top-level { error: "..." } shape.
  if (typeof obj.error === 'string' && obj.error) {
    return obj.error
  }

  if (typeof obj.error_type === 'string') {
    return obj.error_type
  }

  if (Array.isArray(obj)) {
    const parts = obj
      .map((item) => {
        const loc = Array.isArray(item?.loc)
          ? item.loc.filter((x: unknown) => typeof x === 'string').pop()
          : undefined
        const msg = typeof item?.msg === 'string' ? item.msg : 'Invalid value'
        return loc ? `${loc}: ${msg}` : msg
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }

  return fallback
}

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  // JSON-serialized; pass a URLSearchParams/FormData instance instead for
  // form-encoded requests (login uses OAuth2 form fields).
  body?: unknown
  headers?: Record<string, string>
  // Attach the Authorization header. Default true.
  auth?: boolean
  // Allow the client to attempt a token refresh and retry once on a 401.
  // Disable for /auth/login and /auth/refresh themselves.
  retry?: boolean
  // Clear the session when a 401 cannot be recovered. Disable for calls that
  // intentionally probe an endpoint (e.g. resolving an admin profile).
  handleUnauthorized?: boolean
  // Return the raw Response (e.g. to read the QR image blob) instead of JSON.
  raw?: boolean
}

async function performRequest(
  path: string,
  options: RequestOptions,
): Promise<Response> {
  const { method = 'GET', body, headers = {}, auth = true } = options

  const reqHeaders: Record<string, string> = { ...headers }

  // Letting a caller set Content-Type manually lets us send urlencoded
  // form data (required by /auth/login) via a URLSearchParams body.
  if (
    body !== undefined &&
    !(body instanceof URLSearchParams || body instanceof FormData) &&
    !reqHeaders['Content-Type']
  ) {
    reqHeaders['Content-Type'] = 'application/json'
  }

  const token = getAccessToken()
  if (auth && token && !reqHeaders['Authorization']) {
    reqHeaders['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof URLSearchParams || body instanceof FormData
          ? body
          : JSON.stringify(body),
  })

  if (response.ok) return response

  let errorBody: unknown = null
  try {
    errorBody = await response.json()
  } catch {
    errorBody = null
  }

  const message = extractErrorMessage(
    errorBody,
    `Request failed (${response.status})`,
  )
  throw new ApiError(response.status, message, errorBody)
}

let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) return false

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: refreshToken }),
        })
        if (!response.ok) return false
        const data = (await response.json()) as RefreshResponse
        setTokens(data.access_token, data.refresh_token)
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

/**
 * Small wrapper around fetch that:
 *  - attaches the JWT access token,
 *  - silently refreshes the access token once when it expires,
 *  - throws a readable ApiError with the backend's message.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { retry = true, handleUnauthorized = true, ...rest } = options

  try {
    const response = await performRequest(path, { ...rest })
    if (rest.raw) return response as unknown as T
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && retry) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        try {
          const response = await performRequest(path, { ...rest })
          if (rest.raw) return response as unknown as T
          return (await response.json()) as T
        } catch (retryError) {
          if (
            handleUnauthorized &&
            retryError instanceof ApiError &&
            retryError.status === 401
          ) {
            emitUnauthorized()
          }
          throw retryError
        }
      } else if (handleUnauthorized) {
        emitUnauthorized()
      }
    }
    throw error
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
}

// ---------- Typed wrappers for the endpoints we actually use ----------

export const authApi = {
  login: (email: string, password: string) => {
    const data = new URLSearchParams()
    data.append('username', email)
    data.append('password', password)
    return apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      retry: false,
      body: data,
    })
  },

  verifyTwoFactor: (tempToken: string, totp: string) =>
    apiRequest<LoginTokenResponse>('/auth/verify-2fa', {
      method: 'POST',
      auth: false,
      retry: false,
      headers: { 'X-Auth-Token': tempToken, 'Content-Type': 'application/json' },
      body: { totp },
    }),

  // Admins are rejected by /auth/me; the caller resolves them via adminApi.
  me: () =>
    apiRequest<UserProfile>('/auth/me', {
      retry: true,
      handleUnauthorized: false,
    }),

  logout: () => api.post<MessageResponse>('/auth/logout', {}),

  // Returns the QR code as a blob URL so <img> can display it.
  enableTwoFactor: async (): Promise<string> => {
    const response = await apiRequest<Response>('/auth/enable-2fa', {
      method: 'POST',
      raw: true,
    })
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },

  confirmTwoFactor: (totp: string) =>
    api.post<MessageResponse>('/auth/confirm-2fa', { totp }),

  disableTwoFactor: () => api.post<MessageResponse>('/auth/disable-2fa', {}),
}

function invalidateMoneyData(): void {
  invalidateApiCache('wallet:balance')
  invalidateApiCache('transaction:recent')
}

export const walletApi = {
  balance: (force = false) =>
    cachedGet(
      'wallet:balance',
      () => api.get<WalletBalance>('/wallet/check-balance'),
      force,
    ),

  create: async (payload: CreateWalletRequest) => {
    const response = await api.post<MessageResponse>('/wallet/create', payload)
    invalidateMoneyData()
    return response
  },
}

export const transactionApi = {
  deposit: async (amount: number, currency = 'NPR') => {
    const response = await api.post<MessageResponse>('/transaction/deposit', {
      type: 'deposit',
      amount,
      currency,
    })
    invalidateMoneyData()
    return response
  },

  withdraw: async (amount: number) => {
    const response = await api.post<MessageResponse>('/transaction/withdraw', {
      type: 'withdraw',
      amount,
    })
    invalidateMoneyData()
    return response
  },

  sendMoney: async (receiverPhoneNumber: string, amount: number) => {
    const response = await api.post<MessageResponse>('/transaction/send-money', {
      receiver_phone_number: receiverPhoneNumber,
      amount,
    })
    invalidateMoneyData()
    return response
  },

  recent: (page = 1, pageSize = 5, force = false) =>
    cachedGet(
      `transaction:recent:${page}:${pageSize}`,
      () =>
        api.get<PaginatedResponse<ServerTransaction>>(
          `/transaction/recent-transaction?page=${page}&page_size=${pageSize}`,
        ),
      force,
    ),
}

export const userApi = {
  signup: (payload: unknown) =>
    apiRequest<MessageResponse>('/user/signup', {
      method: 'POST',
      auth: false,
      retry: false,
      body: payload,
    }),

  changePassword: (current_password: string, new_password: string) =>
    api.post<MessageResponse>('/user/change-password', {
      current_password,
      new_password,
    }),

  // Returns null when the account has no profile image yet (backend 404).
  profileImage: (force = false) =>
    cachedGet<ProfileImage>(
      'profile:image',
      async () => {
        try {
          return await api.get<ProfileImageResponse>('/user/profile-image')
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }
      },
      force,
    ),

  uploadProfileImage: async (file: File) => {
    const form = new FormData()
    form.append('image', file)
    const response = await apiRequest<MessageResponse>('/user/profile-image', {
      method: 'POST',
      body: form,
    })
    invalidateApiCache('profile:image')
    return response
  },
}

// --- admin-only routes (all require an admin token) ---
// NOTE: `id` is always the USER's UUID, never a wallet id.
function invalidateAdminData(): void {
  invalidateApiCache('admin:')
}

export const adminApi = {
  listUsers: (page = 1, pageSize = 10, force = false) =>
    cachedGet(
      `admin:users:${page}:${pageSize}`,
      () =>
        api.get<PaginatedResponse<AdminUser>>(
          `/manage/users?page=${page}&page_size=${pageSize}`,
        ),
      force,
    ),

  getUser: (id: string, force = false) =>
    cachedGet(
      `admin:user:${id}`,
      () => api.get<AdminUser>(`/manage/${id}/details`),
      force,
    ),

  inactivateUser: async (id: string) => {
    const response = await api.post<MessageResponse>(`/manage/inactive-user/${id}`, {})
    invalidateAdminData()
    return response
  },

  reactivateUser: async (id: string) => {
    const response = await api.post<MessageResponse>(
      `/manage/reactivate-user/${id}`,
      {},
    )
    invalidateAdminData()
    return response
  },

  walletByUser: (id: string, force = false) =>
    cachedGet(
      `admin:wallet:${id}`,
      () => api.get<AdminWallet>(`/manage/user-wallet/${id}`),
      force,
    ),

  activateWallet: async (id: string) => {
    const response = await api.post<MessageResponse>(
      `/manage/wallet-activate/${id}`,
      {},
    )
    invalidateAdminData()
    return response
  },

  deactivateWallet: async (id: string) => {
    const response = await api.post<MessageResponse>(
      `/manage/wallet-deactivate/${id}`,
      {},
    )
    invalidateAdminData()
    return response
  },
}
