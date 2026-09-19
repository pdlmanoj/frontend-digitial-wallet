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
├── App.tsx                   # <BrowserRouter> + route table
├── index.css                 # Tailwind layers + .card/.input/.label utilities
├── types.ts                  # TS mirrors of backend Pydantic schemas (KEEP IN SYNC)
├── auth/
│   └── auth.tsx              # AuthProvider context; login/verifyTotp/logout/refreshUser
├── lib/
│   ├── api.ts                # fetch wrapper, token store, silent refresh, error parsing
│   ├── useWallet.ts          # useWalletBalance() -> {wallet, loading, error, refresh}
│   ├── activity.ts           # localStorage session transaction log
│   └── format.ts             # formatMoney / formatDate / formatDOB / greeting / etc.
├── components/               # UI kit (ui.tsx), Layout, RequireAuth, RequireAdmin,
│                             #   WalletCard, MoneyForm, TransactionList, badges, AuthShell
└── pages/                    # one component per route (+ admin/ for admin-only screens)
```

## 2. Auth flow (critical)

1. **Login** — `POST /auth/login` is **application/x-www-form-urlencoded**
   (FastAPI `OAuth2PasswordRequestForm`): fields `username` and `password`.
   → `src/pages/Login.tsx`, `authApi.login()` in `src/lib/api.ts`.
2. **2FA gate** — if the account has 2FA, login returns
   `{ is_2fa_enable, token, required_2fa_verification }` with **no tokens**.
   The temporary `token` is stored in `sessionStorage["dw.2fa.token"]` and the
   user is routed to `/verify-2fa`.
3. **Verify 2FA** — `POST /auth/verify-2fa` with header **`X-Auth-Token: <temp token>`**
   and JSON `{ totp }` returns the real access + refresh tokens.
4. **Tokens** — stored in `localStorage` under `dw.access_token` and
   `dw.refresh_token`. No cookies. Access token expires in 10 minutes, refresh
   in 1 day.
5. **Session restore** — on app load, `AuthProvider` calls `GET /auth/me`
   (`authApi.me()`) to validate the stored token and hydrate `user`.
6. **Silent refresh** — `apiRequest()` attaches
   `Authorization: Bearer <access_token>`; on a `401` it attempts
   `POST /auth/refresh` (JSON `{ refresh_token }`), swaps in the new access
   token, and retries the original request once. On refresh failure it clears
   tokens and dispatches the `dw:unauthorized` event, which resets auth state.
   Refresh is guarded against concurrent runs (`refreshInFlight`).

Auth state machine (in `auth/auth.tsx`): `status` is `'loading' |
'authenticated' | 'unauthenticated'`. `RequireAuth` redirects unauthenticated
users to `/login`, preserving `location.state.from`.

## 3. API client (`src/lib/api.ts`)

- `API_BASE_URL` ← `VITE_API_BASE_URL` (default `http://localhost:8000`).
- `apiRequest<T>(path, {method, body, headers, auth, retry, raw})` — the single
  fetch path. `raw: true` returns the `Response` (used for the 2FA QR image).
- Request body is JSON unless it's a `URLSearchParams`/`FormData` instance.
- Error normalization — `extractErrorMessage()` handles every backend shape:
  - HTTPException dict: `{ detail: { error_type, msg } }`
  - HTTPException string: `{ detail: "..." }`
  - Pydantic 422: `{ detail: [ { loc, msg, type }, ... ] }`
  - slowapi 429: `{ error: "Rate limit exceeded: ..." }`
  Throws `ApiError(status, message, body)`. Pages catch it and show `message`.
- Endpoint wrappers are grouped: `authApi`, `walletApi`, `transactionApi`,
  `userApi`. **Add new endpoints here.**
- Rate limits in the backend (login 5/min, refresh 5/min, me 20/min, balance
  20/min, transactions 5/min, change-password 3/min) are NOT retried on 429 —
  the message bubble shows the limit error.

## 4. Wallet flow

- One wallet per account. `useWalletBalance()` calls `GET /wallet/check-balance`;
  a `400` with "No wallet" is treated as `wallet === null` (not an error).
- **Quirk A (request):** `POST /wallet/create` accepts the opening balance
  under the JSON key **`balance`** (Pydantic `validation_alias`), so the form
  sends `{ currency, balance }`. See `src/pages/Wallets.tsx`.
- **Quirk B (response):** `GET /wallet/check-balance` returns the balance
  under the key **`amount`** (the schema field is `amount`), so `WalletBalance`
  in `src/types.ts` uses `amount`. Do not "fix" this silently — confirm with the
  updated backend schema first.
- Wallet activate/deactivate and `/wallet/{id}` are **admin-only** and are used
  by the Admin section (see §5 below).

## 5. Admin flow (admin-only)

An account is an admin when `GET /auth/me` returns **`is_admin: true`** on
`UserProfile` (added to the backend's `UserProfileResponseSchema`). There is no
API to promote a user — set `users.is_admin` in the database.

- The sidebar (`src/components/Layout.tsx`) renders an `Admin` nav group **only**
  for `user.is_admin`.
- Admin routes are wrapped in `<RequireAdmin>` (`src/components/RequireAdmin.tsx`),
  which redirects non-admins to `/dashboard`.
- Admin screens live in `src/pages/admin/` and are registered in `src/App.tsx`.

| Screen | Endpoint | Notes |
| ------ | -------- | ----- |
| `/admin/users` | `GET /user/users` | list of `AdminUser` (profile + `id`) |
| `/admin/users/:id` | `GET /user/{id}` | user profile (no auth dependency in the backend) |
| / | `GET /wallet/{id}` | **`{id}` is the USER's UUID, not a wallet id**; returns `{currency, amount, user_id, is_active}` |
| action | `POST /wallet/activate/{id}` | 400 `wallet.already_activated` if already active |
| action | `POST /wallet/deactivate/{id}` | 400 `wallet.already_deactivated` if already inactive |

- Wallet lookups keyed by user id: `walletApi.byUser(id)`. A `400`
  `wallet.not_found` ("No wallet registrated for this user.") means the user
  has no wallet yet — `AdminUserDetail` treats it as `hasWallet: false`.
- **Pattern for future admin APIs:** add the response type to `src/types.ts`,
  add the wrapper to `userApi`/`walletApi` (or a new `adminApi` group) in
  `src/lib/api.ts`, build the screen in `src/pages/admin/`, guard it with
  `<RequireAdmin>`, and mirror it in `scripts/mock-server.mjs` (which enforces
  `is_admin` via `parseAdmin()`).

## 6. Transaction flows

Deposit / withdraw / send all: validate locally → call endpoint → parse the
returned `msg` → record into the session activity log (`addActivity`) → refresh
balance (`useWalletBalance().refresh()`). Result `status` is derived from the
message text via `statusFromMessage()` (deposit/withdraw randomly succeed/fail
in the backend).

| Screen        | Endpoint                     | Request body                                  | Notes |
| ------------- | ---------------------------- | --------------------------------------------- | ----- |
| `/deposit`    | `POST /transaction/deposit`  | `{ type: "deposit", amount, currency: "NPR" }`| shared `AmountForm` |
| `/withdraw`   | `POST /transaction/withdraw` | `{ type: "withdraw", amount }`                | backend checks balance → `422 insufficient_balance` |
| `/send`       | `POST /transaction/send-money` | `{ receiver_phone_number, amount }`         | two-step confirm; extra fields invalid (`extra="forbid"`) |

- Send-money has a **review/confirm step** (`review` state in
  `src/pages/SendMoney.tsx`): "You are about to send…" before hitting the API.
- Receiver name is parsed from the success message
  (`extractReceiverName`) for the activity note.

### Transaction history / activity log

The backend has **no GET /transaction endpoint**. `src/lib/activity.ts` keeps a
local `localStorage["dw.activity"]` list of `LocalTransaction` objects recorded
from the responses the user actually triggers. The Dashboard and Transactions
page display this with an explicit info note. If the backend adds
a history endpoint, replace this local log with server data (keep the shape in
`src/types.ts` aligned with the new response schema).

## 7. Security flow (2FA + password)

- Enable: `POST /auth/enable-2fa` returns a **PNG image** (raw body → blob URL)
  shown as a QR code; then `POST /auth/confirm-2fa` with `{ totp }`; backend
  replies `{ msg }`. `refreshUser()` updates `user.is_2fa_enable`.
- Disable: `POST /auth/disable-2fa` (empty body).
- Change password: `POST /user/change-password` with
  `{ current_password, new_password }`.
- All in `src/pages/Security.tsx`.

## 8. Types to keep in sync (`src/types.ts`)

`UserProfile` (now includes `is_admin`), `AdminUser`, `AdminWallet`,
`LoginTokenResponse`, `LoginTwoFactorResponse`, `RefreshResponse`,
`WalletBalance`, `CreateWalletRequest`, `MessageResponse`, `LocalTransaction`,
`TxStatus` (`pending|success|failed`), `TxType` (`deposit|withdraw|send`),
`Gender`, `UserStatus`.

## 9. Conventions to follow

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

## 10. When you change the backend — checklist

1. Update `apps/schemas/*.py` → mirror the change in `src/types.ts`.
2. Update/add the wrapper in the right `*Api` group in `src/lib/api.ts`
   (request keys, headers, content-type, auth requirement).
3. Update the screen that uses it (`src/pages/*.tsx`) — reject conditions,
   statuses, error messages.
4. If applicable, update the mock (`scripts/mock-server.mjs`) and this doc.
5. Run `npm run typecheck` and `npm run build`.

## 11. Commands

```bash
npm run dev        # dev server :5173
npm run build      # tsc -b && vite build  → dist/
npm run typecheck  # tsc -b --noEmit
npm run mock       # mock API :8000 (mirrors the real backend)
```