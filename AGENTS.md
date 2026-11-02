# Frontend Flow Reference (for AI agents and maintainers)

> Read this before modifying the frontend. It describes **exactly** how the app
> connects to the Digital Wallet API, so that when the backend changes you can
> update the frontend in the right places. Keep this file in sync with the code.

- Stack: React 19, TypeScript 5 (strict), Vite 7, Tailwind CSS 3, React Router 7, lucide-react.
- Every screen maps to a **real** backend endpoint. Never call an endpoint that
  does not exist, and never build UI for one that doesn't.
- The single source of truth for backend types is `src/types.ts`. Update it
  when the backend Pydantic schemas change, then update `src/lib/api.ts`.
- The mock server `scripts/mock-server.mjs` mirrors the backend contract for
  local development. If you add/change endpoints, update it too.

---

## 1. Project layout

```
src/
├── main.tsx                  # createRoot + <App/>
├── App.tsx                   # <BrowserRouter> + customer/admin route tables
├── index.css                 # Tailwind layers + .card/.input/.label utilities
├── types.ts                  # TS mirrors of backend Pydantic schemas (KEEP IN SYNC)
├── auth/
│   └── auth.tsx              # AuthProvider; customer/admin login portals, 2FA, logout
├── config/
│   └── demo.ts               # Demo customer/admin credentials shown on login screens
├── lib/
│   ├── api.ts                # fetch wrapper, tokens, silent refresh, error parsing
│   ├── useWallet.ts          # useWalletBalance() -> {wallet, loading, error, refresh}
│   ├── useTransactions.ts    # paginated transaction history hook
│   ├── useProfileImage.ts    # profile photo load/upload + sidebar sync event
│   └── format.ts             # formatMoney / formatDate / formatDOB / greeting / etc.
├── components/               # UI kit (ui.tsx), Layout, AdminLayout, RequireAuth,
│                             #   RequireAdmin, WalletCard, MoneyForm, TransactionList,
│                             #   DemoAccountsPanel, badges, AuthShell
└── pages/                    # customer screens + admin/ for admin-only screens
```

---

## 2. Auth flow (critical)

1. **Customer login** — `/login` calls `POST /auth/login`
   (application/x-www-form-urlencoded, FastAPI `OAuth2PasswordRequestForm`:
   `username`, `password`) and passes role `customer`.
2. **Admin login** — `/admin/login` calls the same endpoint but passes role
   `admin`. The two portals are separate; role mismatch is rejected client-side
   after the token is resolved and the local session is cleared.
3. **2FA gate** — if the account has 2FA, login returns
   `{ is_2fa_enable, token, required_2fa_verification }` with **no tokens**.
   The temporary `token` and intended portal are stored in `sessionStorage`
   (`dw.2fa.token`, `dw.login.role`) and the user is routed to `/verify-2fa`.
4. **Verify 2FA** — `POST /auth/verify-2fa` with header **`X-Auth-Token: <temp token>`**
   and JSON `{ totp }` returns the real access + refresh tokens. The portal role
   is checked again before the session is accepted.
5. **Tokens** — stored in `localStorage` under `dw.access_token` and
   `dw.refresh_token`. No cookies. Access token expires in 10 minutes, refresh
   in 1 day.
6. **Session restore** — on app load, `AuthProvider` calls `GET /auth/me`.
   Both customers and admins are accepted there (the backend uses
   `get_current_user_or_admin` for `/auth/me`). As a fallback for older
   backends, when that call fails the provider decodes the JWT `sub` claim and
   calls `GET /manage/{sub}/details`; if `is_admin` is true the admin session is
   accepted. Otherwise the tokens are cleared.
7. **Silent refresh** — `apiRequest()` attaches
   `Authorization: Bearer <access_token>`; on a `401` it attempts
   `POST /auth/refresh` with JSON `{ token: <refresh_token> }`, stores the new
   access **and refresh** tokens, and retries the original request once. On
   refresh failure it clears tokens and dispatches `dw:unauthorized`.
   `/auth/me` deliberately opts out of auto-clearing (`handleUnauthorized:
false`) so admin detection can run.
8. **Logout** — both customers and admins call `POST /auth/logout`, then clear
   local tokens regardless of the server response.

Auth state machine (`auth/auth.tsx`): `status` is `'loading' |
'authenticated' | 'unauthenticated'`. `RequireAuth` protects customer routes;
`RequireAdmin` protects the admin portal and redirects non-admins to
`/dashboard`, unauthenticated visitors to `/admin/login`.

---

## 3. API client (`src/lib/api.ts`)

- `API_BASE_URL` ← `VITE_API_BASE_URL` (default `http://localhost:8000`).
- `apiRequest<T>(path, {method, body, headers, auth, retry, handleUnauthorized, raw})`
  — the single fetch path. `raw: true` returns the `Response` (used for the 2FA
  QR image).
- Request body is JSON unless it's a `URLSearchParams`/`FormData` instance.
- Error normalization — `extractErrorMessage()` handles every backend shape:
  - HTTPException dict: `{ detail: { error_type, msg } }`
  - HTTPException string: `{ detail: "..." }`
  - Pydantic 422: `{ detail: [ { loc, msg, type }, ... ] }`
  - slowapi 429: `{ error: "Rate limit exceeded: ..." }`
  Throws `ApiError(status, message, body)`. Pages catch it and show `message`.
- Endpoint wrappers are grouped: `authApi`, `walletApi`, `transactionApi`,
  `userApi`, `adminApi`. **Add new endpoints here.**
- GETs for balance, transaction history, profile image and admin data go
  through `cachedGet()`: identical in-flight requests are shared, successful
  responses are cached for 15s, and the cache key includes the access token.
  Money/admin mutations call `invalidateApiCache()` so the next read is fresh.
  This avoids duplicate calls from React StrictMode and multiple mounted hooks.
  `GET /user/profile-image` maps its 404 to `null` so “no photo yet” is cached
  like any other successful read.
- Rate limits in the backend (login 5/min, refresh 5/min, me 20/min, balance
  20/min, transactions 5/min, change-password 3/min, profile-image 2/min, admin
  20/min) are NOT retried on 429 — the message bubble shows the limit error.

---

## 4. Pagination

The backend wraps list endpoints as:

```ts
{ pagination: { page, page_size, total, total_pages }, results: [...] }
```

`PaginatedResponse<T>` lives in `src/types.ts`; `<Pagination>` in
`src/components/ui.tsx` renders previous/next controls. Endpoints:

| Endpoint | Default page_size | Max |
| -------- | ----------------- | --- |
| `GET /transaction/recent-transaction` | 5 | 50 |
| `GET /manage/users` | 5 | 50 |

---

## 5. Wallet flow

- One wallet per account. `useWalletBalance()` calls `GET /wallet/check-balance`;
  a `400` with "No wallet" is treated as `wallet === null` (not an error).
- `POST /wallet/create` accepts the opening balance under JSON key **`balance`**.
- `GET /wallet/check-balance` returns `AvailableBalanceReadSchema`:
  `{ currency, balance, hold_amount, is_active }` — the balance key is
  **`balance`** (not `amount`).
- Wallet activation/deactivation and wallet lookup by user are **admin-only**
  and live under `/manage` (see §6). There is no wallet id or creation date in
  the public wallet response.

---

## 6. Admin flow (admin-only)

An account is an admin when `GET /manage/{id}/details` returns
**`is_admin: true`** (also exposed on the user list). There is no API to
promote a user — set `users.is_admin` in the database.

- The admin portal has its own login (`/admin/login`), layout
  (`src/components/AdminLayout.tsx`) and dashboard (`/admin`).
- Demo credentials for both portals are configured in `src/config/demo.ts`
  (or `VITE_DEMO_*` env vars) and rendered on the login screens by
  `src/components/DemoAccountsPanel.tsx`; `/login` links to `/admin/login`.
  The customer login also offers a one-click demo fill and an admin demo entry
  that opens `/admin/login` prefilled.
- The customer sidebar (`src/components/Layout.tsx`) is not rendered for
  admins; if an admin token hits a customer route the layout redirects to
  `/admin`.
- Admin routes are wrapped in `<RequireAdmin>` and registered in `src/App.tsx`.
- Admin screens live in `src/pages/admin/`.
- Admins have their own profile screen at `/admin/profile`
  (`src/pages/admin/AdminProfile.tsx`) with the same account details and
  profile-photo upload/preview as the customer Profile page. The admin sidebar
  avatar also uses `useProfileImage()` so it stays in sync.

| Screen | Endpoint | Notes |
| ------ | -------- | ----- |
| `/admin` | `GET /manage/users` | dashboard summary + latest accounts |
| `/admin/users` | `GET /manage/users?page=&page_size=` | paginated `AdminUser` list |
| `/admin/users/:id` | `GET /manage/{id}/details` | `UserResponseSchema` (profile + `id`, `created_at`, `updated_at`) |
| `/admin/profile` | `GET /auth/me`, `GET /user/profile-image`, `POST /user/profile-image` | admin's own profile + photo |
| details action | `POST /manage/inactive-user/{id}` | marks account inactive |
| details action | `POST /manage/reactivate-user/{id}` | reactivates an inactive account |
| wallet | `GET /manage/user-wallet/{id}` | **`{id}` is the USER's UUID**; returns `WalletListReadSchema` |
| action | `POST /manage/wallet-activate/{id}` | 400 `wallet.already_activated` if already active |
| action | `POST /manage/wallet-deactivate/{id}` | 400 `wallet.already_deactivated` if already inactive |

The dashboard's **Total users** comes from `pagination.total`; the wallet,
2FA and inactive counters are computed only from the latest 5 accounts in that
same response.

`WalletListReadSchema` is `{ currency, balance, user_id, is_active }`.
A `400` `transaction.wallet_not_found` means the user has no wallet yet —
`AdminUserDetail` treats it as `hasWallet: false` and shows a “No wallet
associated” notice instead of a page error. A `400`
`transaction.wallet_not_active` means the wallet exists but is deactivated;
the detail page shows an “Activate wallet” button using
`POST /manage/wallet-activate/{id}` (no balance is available while inactive).

Account status follows the same pattern: `AdminUserDetail` shows **Deactivate
account** for `status === "active"` (`POST /manage/inactive-user/{id}`) and
**Activate account** for `status === "inactive"`
(`POST /manage/reactivate-user/{id}`). Both actions use a confirmation modal
and reload the user + wallet afterwards. Other statuses (e.g. `password_lock`)
show no account action button.

**Pattern for future admin APIs:** add the response type to `src/types.ts`,
add the wrapper to `adminApi` in `src/lib/api.ts`, build the screen in
`src/pages/admin/`, guard it with `<RequireAdmin>`, and mirror it in
`scripts/mock-server.mjs` (which enforces `is_admin` via `parseAdmin()`).

---

## 7. Transaction flows

Deposit / withdraw / send all: validate locally → call endpoint → parse the
returned `msg` → refresh balance. Result `status` is derived from the message
text via `statusFromMessage()` (deposit/withdraw randomly succeed/fail in the
backend).

| Screen        | Endpoint                     | Request body                                  | Notes |
| ------------- | ---------------------------- | --------------------------------------------- | ----- |
| `/deposit`    | `POST /transaction/deposit`  | `{ type: "deposit", amount, currency: "NPR" }`| shared `AmountForm` |
| `/withdraw`   | `POST /transaction/withdraw` | `{ type: "withdraw", amount }`                | backend checks balance → `422 insufficient_balance` |
| `/send`       | `POST /transaction/send-money` | `{ receiver_phone_number, amount }`         | two-step confirm; extra fields invalid (`extra="forbid"`) |

### Transaction history

`GET /transaction/recent-transaction?page=&page_size=` returns a paginated
list of `RecentTransactionSchema`:

```ts
{ id, amount, type: 'deposit' | 'withdraw', status, reference_id, created_at }
```

The Dashboard shows the latest 5; the Transactions page paginates 10 at a time
via `useTransactions()`. Sending money is not recorded by this endpoint
(the backend only stores deposit/withdraw transactions). There is no local
transaction log anymore.

---

## 8. Security and profile photo (customer + admin profile)

- Enable: `POST /auth/enable-2fa` returns a **PNG image** (raw body → blob URL)
  shown as a QR code; then `POST /auth/confirm-2fa` with `{ totp }`; backend
  replies `{ msg }`. `refreshUser()` updates `user.is_2fa_enable`.
- Disable: `POST /auth/disable-2fa` (empty body).
- Change password: `POST /user/change-password` with
  `{ current_password, new_password }`.
- Profile photo: `POST /user/profile-image` with multipart form field **`image`**
  (`image/png` or `image/jpeg`, max 2 MB) replies `{ msg }`.
  `GET /user/profile-image` replies `{ image_url, expires_in }` (a presigned S3
  URL valid for 3 minutes) or `404 user.profile_image.not_found` when unset.
  `userApi.profileImage()` maps that 404 to `null`.
- `src/lib/useProfileImage.ts` loads the image, uploads a new one, and broadcasts
  `dw:profile-image-updated` so the Profile page and sidebar avatar stay in
  sync. `src/pages/Profile.tsx` and `src/pages/admin/AdminProfile.tsx` handle
  client-side type/size validation.
- The backend's profile-image routes use `get_current_user_or_admin`, so admins
  use the same `/user/profile-image` endpoints from `/admin/profile`.
- Security is in `src/pages/Security.tsx` (customer-only; admins are redirected
  to the admin portal). Profile photo is available on both `/profile` and
  `/admin/profile`.

---

## 9. Types to keep in sync (`src/types.ts`)

`UserProfile` (includes `is_admin`), `AdminUser` (+ `id`, `created_at`,
`updated_at`), `AdminWallet`, `Pagination`, `PaginatedResponse<T>`,
`LoginTokenResponse`, `LoginTwoFactorResponse`, `RefreshResponse`,
`WalletBalance`, `CreateWalletRequest`, `ProfileImageResponse`, `ProfileImage`,
`ServerTransaction`, `MessageResponse`,
`TxStatus` (`pending|success|failed`), `TxType` (`deposit|withdraw`), `Gender`,
`UserStatus`.

---

## 10. Conventions to follow

- **Hooks first, early returns after** — all hooks are called before any
  `if (!wallet) return …` guard (see `MoneyForm.tsx`, `SendMoney.tsx`).
- **Error handling** — forms keep a local `error` state, catch `Error`/`ApiError`,
  and render an `<Alert tone="error">`. No global toast system.
- **Loading** — buttons accept `loading` (shows spinner); pages show an inline
  `<Spinner />`. Balance cards use `WalletCard`.
- **Don't invent fields/endpoints** — mirror the backend exactly.
- **Styling** — use the Tailwind design tokens: emerald primary, slate neutrals,
  white `card` surfaces with `border-slate-200`; icons from `lucide-react`;
  semantic `Badge` tones (`success|warning|danger|neutral|info`).

---

## 11. When you change the backend — checklist

1. Update `apps/schemas/*.py` → mirror the change in `src/types.ts`.
2. Update/add the wrapper in the right `*Api` group in `src/lib/api.ts`
   (request keys, headers, content-type, auth requirement).
3. Update the screen that uses it (`src/pages/*.tsx`) — reject conditions,
   statuses, error messages, pagination.
4. If applicable, update the mock (`scripts/mock-server.mjs`) and this doc.
5. Run `npm run typecheck` and `npm run build`.

Recent backend contract changes already reflected here:

- Admin wallet lookup: `GET /manage/user-wallet/{id}` (not `/manage/{id}`).
- Account actions: `POST /manage/inactive-user/{id}` and
  `POST /manage/reactivate-user/{id}`.
- No-wallet and inactive-wallet responses are treated as UI states, not page
  errors.
- Admin logout uses the same `POST /auth/logout` as customers.
- Profile photo endpoints and the demo-accounts config are included above.
- Admins now have `/admin/profile` and can call `GET /auth/me` plus the
  `/user/profile-image` endpoints (`get_current_user_or_admin`).

---

## 12. Commands

```bash
npm run dev        # dev server :5173
npm run build      # tsc -b && vite build  → dist/
npm run typecheck  # tsc -b --noEmit
npm run mock       # mock API :8000 (mirrors the real backend)
```
