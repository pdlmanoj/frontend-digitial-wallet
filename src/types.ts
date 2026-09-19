// TypeScript mirrors of the FastAPI / Pydantic schemas.
// Keep these in sync with apps/schemas/*.py.

export type Gender = 'male' | 'female' | 'other'
export type UserStatus = 'active' | 'inactive' | 'password_lock'

export type TxStatus = 'pending' | 'success' | 'failed'
export type TxType = 'deposit' | 'withdraw' | 'send'

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

// GET /user/users / GET /user/{id} -> UserResponseSchema (profile + id)
export interface AdminUser extends UserProfile {
  id: string
}

// GET /wallet/{id} -> WalletListReadSchema (admin, keyed by USER id)
// Balance again appears under "amount", like /wallet/check-balance.
export interface AdminWallet {
  currency: string
  amount: string
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
  token_type: string
}

// GET /wallet/check-balance -> AvailableBalanceReadSchema
// NOTE: the response key for the balance is "amount", not "balance".
// This mirrors the backend's Pydantic model (field `amount` with
// validation_alias `balance`).
export interface WalletBalance {
  currency: string
  amount: string
  hold_amount: string
  is_active: boolean
}

// POST /wallet/create request -> CreateWalletFormSchema
// NOTE: the accepted body key is "balance" (Pydantic validation alias).
export interface CreateWalletRequest {
  currency: string | null
  balance: number
}

// Simple message responses used by most mutating endpoints.
export interface MessageResponse {
  msg: string
}

// POST /auth/verify-2fa response == LoginTokenResponse.

// A transaction record we keep locally in the browser, because the API
// does not (yet) expose transaction history.
export interface LocalTransaction {
  id: string
  type: TxType
  amount: string
  currency: string
  status: 'success' | 'failed'
  createdAt: string
  note: string
}