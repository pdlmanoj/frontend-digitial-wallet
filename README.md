# Digital Wallet — Frontend

A clean, modern web UI for the [Digital Wallet API](../README.md) built with
**React 19 + TypeScript + Vite + Tailwind CSS + React Router**.

It is deliberately simple: no state-management library, no chart library, no
CSS framework beyond Tailwind. Every screen maps to a real backend endpoint —
nothing is invented. If you are an AI agent (or a future maintainer) planning
changes, read [`AGENTS.md`](./AGENTS.md) first: it documents the exact API
contract, data flow, and conventions you must keep in sync.

## Quick start

Requires **Node 18+** (built with Node 26).

```bash
cd frontend
npm install

# Option A — use the mock API (no Postgres/Redis needed)
npm run mock        # terminal 1 → mock API on http://localhost:8000
npm run dev         # terminal 2 → open http://localhost:5173

# Option B — use the real FastAPI backend
uv run uvicorn apps.main:app --reload   # from repo root, terminal 1
npm run dev                             # terminal 2
```

Seeded mock logins (see `scripts/mock-server.mjs`):

| Email               | Password     | Notes                             |
| ------------------- | ------------ | --------------------------------- |
| `demo@wallet.dev`   | `password123`| Has a wallet with balance, no 2FA |
| `sam@example.com`   | `password123`| 2FA enabled (code `123456`)       |
| `admin@wallet.dev`  | `password123`| **Admin** — sees the Admin section |

## Configuration

Create `frontend/.env` (see `.env.example`) to point at a different backend:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

`VITE_API_BASE_URL` defaults to `http://localhost:8000` and is read in
`src/lib/api.ts`. The backend must allow CORS from the frontend origin — the
repo's `apps/core/config.py` already whitelists `http://localhost:5173`
(see the `cors_origins` setting).

## Screens

| Route           | Screen                                             | Backend endpoints used |
| --------------- | -------------------------------------------------- | ---------------------- |
| `/login`        | Sign in (form-encoded), shows 2FA notice if needed | `POST /auth/login`     |
| `/verify-2fa`   | TOTP code step for 2FA accounts                    | `POST /auth/verify-2fa`|
| `/register`     | Create account (mirrors API validation)            | `POST /user/signup`    |
| `/dashboard`    | Greeting, live balance, wallet status, recent activity | `GET /auth/me`, `GET /wallet/check-balance` |
| `/wallet`       | Single wallet + create wallet form                 | `POST /wallet/create`  |
| `/transactions` | Session activity log (see note below)              | — (local only)         |
| `/deposit`      | Deposit form (simulated gateway)                   | `POST /transaction/deposit` |
| `/withdraw`     | Withdraw form (balance-checked)                    | `POST /transaction/withdraw` |
| `/send`         | Send-by-phone with confirm step                    | `POST /transaction/send-money` |
| `/security`     | 2FA setup/disable (QR) + change password           | `POST /auth/enable-2fa`, `/auth/confirm-2fa`, `/auth/disable-2fa`, `POST /user/change-password` |
| `/profile`      | Read-only account details                          | `GET /auth/me`         |
| `/admin/users`  | (admin) All users with account / wallet status     | `GET /user/users`      |
| `/admin/users/:id` | (admin) User profile + wallet with activate/deactivate | `GET /user/{id}`, `GET /wallet/{id}`, `POST /wallet/activate/{id}`, `POST /wallet/deactivate/{id}` |

## Admin section

Accounts where `GET /auth/me` returns `is_admin: true` get an extra **Admin**
group in the sidebar. Note the API has no way to change a user's admin flag, so
promote a user to admin directly in the database (`users.is_admin`).

Admin routes live in `src/pages/admin/` and are wrapped in
`<RequireAdmin>` (bounces non-admins to the dashboard). Endpoint wrappers for
future admin APIs go in `src/lib/api.ts` — `userApi` and `walletApi` already
carry the admin-only calls (`listAllUsers`, `getUser`, `byUser`, `activate`,
`deactivate`). Add new admin screens under `src/pages/admin/` and register them
in `src/App.tsx` with `<RequireAdmin>`.

Important: in the wallet admin routes the path `:id` is the **user's UUID**, not
a wallet id (see `apps/api/wallet.py`).

## How auth works

1. `POST /auth/login` is sent **URL-encoded** (`username`, `password`) because
   the backend uses FastAPI's `OAuth2PasswordRequestForm`.
2. If the account has 2FA enabled the response has no tokens — only
   `required_2fa_verification: true` plus a short-lived temporary token, which
   the app stores in `sessionStorage["dw.2fa.token"]` and sends as the
   `X-Auth-Token` header to `POST /auth/verify-2fa`.
3. Access + refresh tokens are stored in `localStorage` (`dw.access_token`,
   `dw.refresh_token`) — not cookies, because that's how the API issues them.
4. Every authed request attaches `Authorization: Bearer <access_token>`.
   On a `401` the client tries `POST /auth/refresh` once and retries; if that
   fails it logs the user out (see `src/lib/api.ts`).

## Browser storage keys

| Key                        | Where        | Purpose                                  |
| -------------------------- | ------------ | ---------------------------------------- |
| `dw.access_token`          | localStorage | JWT access token (10 min expiry)         |
| `dw.refresh_token`         | localStorage | JWT refresh token (1 day expiry)         |
| `dw.activity`              | localStorage | Session transaction log                  |
| `dw.2fa.token`             | sessionStorage | Temporary token for the 2FA login step |

## Project structure

```
frontend/
├── index.html                 # Entry HTML (loads /src/main.tsx)
├── vite.config.ts             # Dev server config (port 5173)
├── tailwind.config.js         # Tailwind theme
├── scripts/
│   └── mock-server.mjs        # Mock API mirroring the real backend contract
└── src/
    ├── main.tsx               # React bootstrap
    ├── App.tsx                # Routes
    ├── index.css              # Tailwind + small design-system classes
    ├── types.ts               # TS mirrors of the backend Pydantic schemas
    ├── auth/
    │   └── auth.tsx           # AuthProvider + useAuth() context
    ├── lib/
    │   ├── api.ts             # fetch wrapper, tokens, refresh, error parsing
    │   ├── useWallet.ts       # useWalletBalance() hook
    │   ├── activity.ts        # localStorage session transaction log
    │   └── format.ts          # currency/date/greeting formatters
    ├── components/            # UI kit + layout + shared widgets
    └── pages/                 # One file per route
```

## Commands

```bash
npm run dev        # start dev server on :5173
npm run build      # tsc type-check + production build → dist/
npm run preview    # preview the production build
npm run typecheck  # TypeScript check only
npm run mock       # start the mock API on :8000
```

## Notes and known limitations

These are intentional and reflect the current backend, not bugs:

- **One wallet per user** — the API rejects creating a second wallet, so there
  is no wallet list or "set default" screen.
- **Admin routes** — `/user/users`, `/wallet/{id}` and
  `/wallet/activate/{id}` / `/wallet/deactivate/{id}` are used only in the
  Admin section (see above). Non-admin callers get a `401`.
- **No transaction-history endpoint** — deposits/withdrawals are recorded in
  the API database, but none of them can be listed, so the Transactions page
  tracks what you do in the current browser. The UI says so explicitly.
- **Only `NPR`** is a supported currency.
- **Transaction statuses** are only `pending`, `success`, `failed`.
- **Deposit/withdraw simulate a payment gateway** and randomly succeed or fail.
- **No profile-edit endpoint** — the Profile page is read-only.

Read [`AGENTS.md`](./AGENTS.md) before changing any of this so the docs and the
code stay in sync.