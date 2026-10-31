// TypeScript mirrors of the FastAPI / Pydantic schemas.
// Keep these in sync with apps/schemas/*.py.

export type Gender = 'male' | 'female' | 'other'
export type UserStatus = 'active' | 'inactive' | 'password_lock'

export type TxStatus = 'pending' | 'success' | 'failed'
export type TxType = 'deposit' | 'withdraw'

// apps/common/pagination/schema.py -> PaginationSchema
export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

// apps/common/pagination/schema.py -> PaginatedResponseSchema[T]
export interface PaginatedResponse<T> {
  pagination: Pagination
  results: T[]
}

// GET /auth/me -> UserProfileResponseSchema
export interface UserProfile {
  name: string
  email: string
  phone_number: string
  gender: Gender
  date_of_birth: string
  status: UserStatus
  is_admin: boolean
  is_2fa_enable: boolean
  // The API returns a nested wallet object containing only its status.
  wallet: { is_active: boolean } | null
}

// GET /manage/{id}/details -> UserResponseSchema (profile + id + timestamps)
export interface AdminUser extends UserProfile {
  id: string
  created_at: string
  updated_at: string
}

// GET /manage/{id} -> WalletListReadSchema (admin, keyed by USER id)
export interface AdminWallet {
  currency: string
  balance: string
  user_id: string
  is_active: boolean
}

// POST /auth/login (form) -> TokenResponseSchema | Token2FAResponseSchema
// The 2FA response has NO access/refresh tokens — it only signals that a
// temporary token is needed to complete login via /auth/verify-2fa.
export interface LoginTokenResponse {
  access_token: string
  refresh_token: string
  type?: string
}

export interface LoginTwoFactorResponse {
  is_2fa_enable: boolean
  token: string
  required_2fa_verification: boolean
}

export type LoginResponse = LoginTokenResponse | LoginTwoFactorResponse

// POST /auth/refresh
export interface RefreshResponse {
  access_token: string
  refresh_token: string
  type: string
}

// GET /wallet/check-balance -> AvailableBalanceReadSchema
export interface WalletBalance {
  currency: string
  balance: string
  hold_amount: string
  is_active: boolean
}

// POST /wallet/create request -> CreateWalletFormSchema
export interface CreateWalletRequest {
  currency: string | null
  balance: number
}

// GET /transaction/recent-transaction -> PaginatedResponseSchema[RecentTransactionSchema]
export interface ServerTransaction {
  id: string
  amount: string
  type: TxType
  status: TxStatus
  reference_id: string
  created_at: string
}

// GET /user/profile-image -> presigned S3 URL
export interface ProfileImageResponse {
  image_url: string
  expires_in: string
}

export type ProfileImage = ProfileImageResponse | null

// Simple message responses used by most mutating endpoints.
export interface MessageResponse {
  msg: string
}
