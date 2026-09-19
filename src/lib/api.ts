import type {
  AdminUser,
  AdminWallet,
  CreateWalletRequest,
  LoginResponse,
  LoginTokenResponse,
  MessageResponse,
  RefreshResponse,
  UserProfile,
  WalletBalance,
} from '../types'

// The base URL of the FastAPI backend. Override by setting VITE_API_BASE_URL
// in a .env file, e.g. VITE_API_BASE_URL=http://127.0.0.1:8000
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000'

const ACCESS_KEY = 'dw.access_token'
const REFRESH_KEY = 'dw.refresh_token'

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

  if (typeof obj.error === 'string' && obj.error) {
    return obj.error
  }

  if ('detail' in obj) {
    return extractErrorMessage(obj.detail, fallback)
  }

  if (typeof obj.msg === 'string' && obj.msg) {
    return obj.msg
  }

  if (typeof obj.message === 'string' && obj.message) {
    return obj.message
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
          body: JSON.stringify({ refresh_token: refreshToken }),
        })
        if (!response.ok) return false
        const data = (await response.json()) as RefreshResponse
        setTokens(data.access_token, null)
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
  const { retry = true, ...rest } = options

  try {
    const response = await performRequest(path, { ...rest })
    if (rest.raw) return response as unknown as T
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      retry
    ) {
      const refreshed = await tryRefresh()
      if (refreshed) {
        try {
          const response = await performRequest(path, { ...rest })
          if (rest.raw) return response as unknown as T
          return (await response.json()) as T
        } catch (retryError) {
          if (retryError instanceof ApiError && retryError.status === 401) {
            emitUnauthorized()
          }
          throw retryError
        }
      } else {
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

  me: () => apiRequest<UserProfile>('/auth/me', { retry: true }),

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

export const walletApi = {
  balance: () => api.get<WalletBalance>('/wallet/check-balance'),

  create: (payload: CreateWalletRequest) =>
    api.post<MessageResponse>('/wallet/create', payload),

  // --- admin-only routes (everything below requires an admin token) ---
  // NOTE: the path param `id` is the USER's id, not a wallet id.
  byUser: (userId: string) => api.get<AdminWallet>(`/wallet/${userId}`),

  activate: (userId: string) =>
    api.post<MessageResponse>(`/wallet/activate/${userId}`, {}),

  deactivate: (userId: string) =>
    api.post<MessageResponse>(`/wallet/deactivate/${userId}`, {}),
}

export const transactionApi = {
  deposit: (amount: number, currency = 'NPR') =>
    api.post<MessageResponse>('/transaction/deposit', {
      type: 'deposit',
      amount,
      currency,
    }),

  withdraw: (amount: number) =>
    api.post<MessageResponse>('/transaction/withdraw', {
      type: 'withdraw',
      amount,
    }),

  sendMoney: (receiverPhoneNumber: string, amount: number) =>
    api.post<MessageResponse>('/transaction/send-money', {
      receiver_phone_number: receiverPhoneNumber,
      amount,
    }),
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

  // --- user lookups (admin UI) ---
  listAllUsers: () => api.get<AdminUser[]>('/user/users'),

  getUser: (id: string) => api.get<AdminUser>(`/user/${id}`),
}