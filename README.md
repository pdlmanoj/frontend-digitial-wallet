# Digital Wallet — Frontend

A clean, modern web UI for the Digital Wallet API built with
**React 19 + TypeScript + Vite + Tailwind CSS + React Router**.

Customers use the wallet at `/login`; administrators use a dedicated admin
portal at `/admin/login`. The two flows are separate and role-checked on the
client after the API resolves the account.

Read [`AGENTS.md`](./AGENTS.md) before changing API contracts or screens — it
documents the exact data flow and conventions.

## Quick start

Requires **Node 18+**.

```bash
npm install

# Option A — mock API (no Postgres/Redis needed)
npm run mock        # terminal 1 → mock API on http://localhost:8000
npm run dev         # terminal 2 → open http://localhost:5173

# Option B — real FastAPI backend
cd ../digital-wallet-api
uv run alembic upgrade head
uv run uvicorn apps.main:app --reload   # terminal 1
cd ../frontend-digital-wallet-api
npm run dev                             # terminal 2
```

Seeded mock logins (see `scripts/mock-server.mjs`):

| Portal | Email | Password | Notes |
| ------ | ----- | -------- | ----- |
| Customer | `demo@wallet.dev` | `password123` | Wallet with balance, no 2FA |
| Customer | `sam@example.com` | `password123` | 2FA enabled (code `123456`) |
| Admin | `admin@wallet.dev` | `password123` | Use `/admin/login` |

The customer and admin login screens display demo credentials for recruiters,
with one-click fill buttons. To show your own backend/database accounts, edit
`src/config/demo.ts` or set `VITE_DEMO_CUSTOMER_EMAIL`,
`VITE_DEMO_CUSTOMER_PASSWORD`, `VITE_DEMO_ADMIN_EMAIL`, and
`VITE_DEMO_ADMIN_PASSWORD` before building. `/login` also has a **Login as
admin** button.

## Configuration

Create `.env` (see `.env.example`) to point at a different backend:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

`VITE_API_BASE_URL` is read at build time in `src/lib/api.ts`. The backend must
allow CORS from the frontend origin (the API's `CORS_ORIGINS` setting).

## Hosting

```bash
npm run build       # production bundle in dist/
npm run preview     # optional local preview of dist/
```

Deploy the contents of `dist/` to any static host (Nginx, Vercel, Netlify,
Cloudflare Pages, S3 + CloudFront, etc.).

- Set `VITE_API_BASE_URL` to your deployed API origin **before** running
  `npm run build` (Vite inlines it).
- Configure the host for SPA routing: serve `index.html` for unknown paths so
  routes like `/admin/users/:id` work on refresh.
- The API must include the deployed frontend origin in `CORS_ORIGINS`.

Example Nginx location:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Screens

| Route | Screen | Backend endpoints |
| ----- | ------ | ----------------- |
| `/login` | Customer sign in | `POST /auth/login` |
| `/admin/login` | Admin sign in (admin accounts only) | `POST /auth/login` |
| `/verify-2fa` | TOTP step shared by both portals | `POST /auth/verify-2fa` |
| `/register` | Create customer account | `POST /user/signup` |
| `/dashboard` | Balance, wallet status, recent transactions | `GET /auth/me`, `GET /wallet/check-balance`, `GET /transaction/recent-transaction` |
| `/wallet` | Single wallet + create form | `GET /wallet/check-balance`, `POST /wallet/create` |
| `/transactions` | Paginated deposit/withdraw history | `GET /transaction/recent-transaction` |
| `/deposit` | Deposit form (simulated gateway) | `POST /transaction/deposit` |
| `/withdraw` | Withdraw form (balance-checked) | `POST /transaction/withdraw` |
| `/send` | Send by phone with confirm step | `POST /transaction/send-money` |
| `/security` | 2FA setup/disable + change password | `POST /auth/enable-2fa`, `/auth/confirm-2fa`, `/auth/disable-2fa`, `POST /user/change-password` |
| `/profile` | Account details + profile photo upload/preview | `GET /auth/me`, `GET /user/profile-image`, `POST /user/profile-image` |
| `/admin` | Admin dashboard / latest accounts | `GET /manage/users` |
| `/admin/users` | Paginated customer list | `GET /manage/users?page=&page_size=` |
| `/admin/users/:id` | User details, wallet controls, account inactivation | `GET /manage/{id}/details`, `GET /manage/user-wallet/{id}`, `POST /manage/inactive-user/{id}`, `POST /manage/reactivate-user/{id}`, `POST /manage/wallet-activate/{id}`, `POST /manage/wallet-deactivate/{id}` |
| `/admin/profile` | Admin account details + profile photo upload/preview | `GET /auth/me`, `GET /user/profile-image`, `POST /user/profile-image` |

## Admin portal

- Admins can use the shared self-service endpoints (`GET /auth/me` and the
  `/user/profile-image` routes) via `get_current_user_or_admin`; other customer
  endpoints remain blocked by `get_current_user`. The frontend keeps a
  `/manage/{id}/details` fallback for older backends.
- An admin token cannot be used on customer routes; `Layout` redirects it to
  `/admin`.
- A customer account cannot use `/admin/login`; a non-admin session is rejected
  before tokens are kept.
- There is no API to promote a user — set `users.is_admin` in the database.
- Admin logout uses the same `POST /auth/logout` endpoint as customers.

## Auth details

1. `POST /auth/login` uses form encoding (`username`, `password`).
2. 2FA accounts receive a short-lived temporary token instead of access/refresh
   tokens. It is sent as `X-Auth-Token` to `POST /auth/verify-2fa`. The intended
   portal is stored in `sessionStorage["dw.login.role"]`.
3. Access/refresh tokens live in `localStorage`. Every authed request sends
   `Authorization: Bearer <access_token>`.
4. On `401`, the client calls `POST /auth/refresh` with `{ token }`, stores the
   new access **and refresh** tokens, and retries once.

## Browser storage keys

| Key | Where | Purpose |
| --- | ----- | ------- |
| `dw.access_token` | localStorage | JWT access token (10 min expiry) |
| `dw.refresh_token` | localStorage | JWT refresh token (1 day expiry) |
| `dw.2fa.token` | sessionStorage | Temporary token for the 2FA login step |
| `dw.login.role` | sessionStorage | Which portal started the 2FA login |

## Commands

```bash
npm run dev        # dev server on :5173
npm run build      # type-check + production build → dist/
npm run preview    # preview the production build
npm run typecheck  # TypeScript check only
npm run mock       # mock API on :8000
```

## Backend notes reflected in the UI

- One wallet per user; creation requires an opening balance (`balance` key).
- Only `NPR` is supported.
- Deposit/withdraw simulate a payment gateway and randomly succeed or fail.
- Transaction history includes deposits and withdrawals (paginated); transfers
  are processed but not stored in the transaction table.
- Admin APIs live under `/manage` and user/wallet ids are USER UUIDs. An
  inactive wallet makes `GET /manage/user-wallet/{id}` return
  `transaction.wallet_not_active`; the admin detail page then offers
  “Activate wallet”.
- Profile photos use `POST /user/profile-image` (multipart `image`) and
  `GET /user/profile-image` (presigned S3 URL valid for 3 minutes). PNG/JPEG
  only, max 2 MB. Available to customers on `/profile` and admins on
  `/admin/profile`. Other profile fields are read-only (no profile-edit
  endpoint).

See [`AGENTS.md`](./AGENTS.md) for the full contract.
