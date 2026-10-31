import http from 'node:http'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Mock Digital Wallet API
// ---------------------------------------------------------------------------
// Stands in for the real FastAPI backend so you can preview the frontend
// without Postgres/Redis. It mirrors the real request/response contract:
//   - /auth/login expects URL-encoded username/password (OAuth2 form)
//   - /wallet/create accepts balance under the JSON key "balance"
//   - /wallet/check-balance returns AvailableBalanceReadSchema (balance/currency/...)
//   - deposit/withdraw randomly succeed or fail; send-money succeeds
//   - /transaction/recent-transaction is paginated
//   - admin routes live under /manage and are paginated where applicable
//
// Start it with:  npm run mock   (listens on http://localhost:8000)
// Point the frontend at it with VITE_API_BASE_URL (it's the default base URL).
// ---------------------------------------------------------------------------

const PORT = process.env.MOCK_PORT || 8000

const users = new Map()
const wallets = new Map()
const transactions = []
let transactionSeq = 0
let twoFactorTotp = '123456' // in the mock, any 6 digits also work
const twoFactorPending = new Map()

function makeReferenceId() {
  transactionSeq += 1
  return `TRAN${Date.now()}${String(transactionSeq).padStart(6, '0')}`
}

function recordTransaction(wallet, type, amount, status = 'success') {
  transactions.unshift({
    id: randomUUID(),
    wallet_id: wallet.id,
    amount: Number(amount),
    type,
    status,
    reference_id: makeReferenceId(),
    created_at: new Date().toISOString(),
  })
}

function paginate(items, page, pageSize) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    pagination: {
      page: safePage,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    },
    results: items.slice(start, start + pageSize),
  }
}

function seed() {
  const demoId = randomUUID()
  users.set('demo@wallet.dev', {
    id: demoId,
    name: 'Demo User',
    email: 'demo@wallet.dev',
    password: 'password123',
    phone_number: '9847000001',
    gender: 'other',
    date_of_birth: '1995-06-15',
    status: 'active',
    is_admin: false,
    is_2fa_enable: false,
  })
  wallets.set('demo@wallet.dev', {
    id: randomUUID(),
    user_id: demoId,
    currency: 'NPR',
    balance: 2500,
    hold_amount: 0,
    is_active: true,
  })

  // A second seeded user with 2FA enabled, so you can preview the 2FA flow.
  const samId = randomUUID()
  users.set('sam@example.com', {
    id: samId,
    name: 'Sam Maina',
    email: 'sam@example.com',
    password: 'password123',
    phone_number: '9847284181',
    gender: 'male',
    date_of_birth: '1992-02-20',
    status: 'active',
    is_admin: false,
    is_2fa_enable: true,
  })
  wallets.set('sam@example.com', {
    id: randomUUID(),
    user_id: samId,
    currency: 'NPR',
    balance: 1250.5,
    hold_amount: 0,
    is_active: true,
  })

  // An admin account — sees the Admin section in the UI.
  const adminId = randomUUID()
  users.set('admin@wallet.dev', {
    id: adminId,
    name: 'System Admin',
    email: 'admin@wallet.dev',
    password: 'password123',
    phone_number: '9847000002',
    gender: 'other',
    date_of_birth: '1990-01-01',
    status: 'active',
    is_admin: true,
    is_2fa_enable: false,
  })
  wallets.set('admin@wallet.dev', {
    id: randomUUID(),
    user_id: adminId,
    currency: 'NPR',
    balance: 100000,
    hold_amount: 0,
    is_active: true,
  })
}
seed()

// Record the seeded opening balances as initial deposits.
for (const wallet of wallets.values()) {
  recordTransaction(wallet, 'deposit', wallet.balance)
}

const baseUrl = `http://127.0.0.1:${PORT}`

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': res.req.headers.origin || '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Auth-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

function sendError(res, status, errorType, msg) {
  sendJson(res, status, { detail: { error_type: errorType, msg } })
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > limit) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function readJson(req) {
  const raw = await readBody(req)
  if (!raw) return {}
  return JSON.parse(raw)
}

async function readForm(req) {
  const raw = await readBody(req)
  const params = new URLSearchParams(raw)
  return Object.fromEntries(params.entries())
}

function readRawBody(req, limit = 3 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) reject(new Error('body too large'))
      else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function parseImageUpload(body, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '')
  const boundary = match?.[1] || match?.[2]
  if (!boundary) return null

  const raw = body.toString('latin1')
  for (const part of raw.split(`--${boundary}`)) {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const headers = part.slice(0, headerEnd)
    if (!/name="image"/i.test(headers)) continue

    let content = part.slice(headerEnd + 4)
    if (content.endsWith('\r\n')) content = content.slice(0, -2)
    const type = /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() || ''
    return { data: Buffer.from(content, 'latin1'), type }
  }
  return null
}

function bearerToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

function makeToken(payload, expiresInS) {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + expiresInS * 1000 }),
  ).toString('base64url')
  return `${Buffer.from('header').toString('base64url')}.${body}.mock`
}

function decodeToken(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  } catch {
    return null
  }
}

function parseAuth(req, { allowAdmin = false } = {}) {
  const token = bearerToken(req)
  if (!token) return { error: 'You must be authenticated to perform this action.' }
  const payload = decodeToken(token)
  if (!payload || typeof payload.email !== 'string' || payload.exp < Date.now()) {
    return { error: 'Token has expired' }
  }
  const user = users.get(payload.email)
  if (!user) return { error: 'User not found.' }
  if (user.is_admin && !allowAdmin) {
    return { error: 'You are not permitted to perfom this action.' }
  }
  return { user }
}

function parseAdmin(req) {
  const auth = parseAuth(req, { allowAdmin: true })
  if (auth.error) return auth
  if (!auth.user.is_admin) {
    return { error: 'You are not permitted to perform this action.' }
  }
  return auth
}

function findUserById(id) {
  return [...users.values()].find((u) => u.id === id) || null
}

function walletForUser(user) {
  return wallets.get(user.email) || null
}

function publicUser(u) {
  const wallet = walletForUser(u)
  const now = new Date().toISOString()
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone_number: u.phone_number,
    gender: u.gender,
    date_of_birth: u.date_of_birth,
    status: u.status,
    is_admin: u.is_admin,
    is_2fa_enable: u.is_2fa_enable,
    wallet: wallet ? { is_active: wallet.is_active } : null,
    created_at: u.created_at || now,
    updated_at: u.updated_at || now,
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, baseUrl)
  const path = url.pathname
  const method = req.method || 'GET'

  if (method === 'OPTIONS') {
    sendJson(res, 200, {})
    return
  }

  // --- health -----------------------------------------------------------
  if (path === '/health-check' && method === 'GET') {
    sendJson(res, 200, { msg: 'Success', app: 'DIGITAL WALLET API', debug: true })
    return
  }

  // --- auth -------------------------------------------------------------
  if (path === '/auth/login' && method === 'POST') {
    const form = await readForm(req)
    const user = users.get(String(form.username || '').trim().toLowerCase())
    if (!user || user.password !== form.password) {
      sendJson(res, 401, {
        detail: { error_type: 'auth.invalid_credentials', msg: 'Invalid username or password' },
      })
      return
    }
    if (user.status === 'inactive') {
      sendJson(res, 401, {
        detail: { error_type: 'auth.inactive_user', msg: 'Your account is inactive. Please contact admin to reactivate your account.' },
      })
      return
    }
    if (user.is_2fa_enable) {
      const temp = makeToken({ email: user.email, twoFactor: true }, 300)
      sendJson(res, 200, { is_2fa_enable: true, token: temp, required_2fa_verification: true })
      return
    }
    sendJson(res, 200, {
      access_token: makeToken({ email: user.email }, 10 * 60),
      refresh_token: makeToken({ email: user.email, refresh: true }, 24 * 3600),
      type: 'bearer',
    })
    return
  }

  if (path === '/auth/refresh' && method === 'POST') {
    const body = await readJson(req)
    const payload = decodeToken(body.token)
    if (!payload || !payload.refresh) {
      sendJson(res, 401, { detail: 'Could not validate refresh token' })
      return
    }
    const user = users.get(payload.email)
    if (!user) {
      sendJson(res, 404, { detail: 'User not found' })
      return
    }
    sendJson(res, 200, {
      access_token: makeToken({ email: user.email }, 10 * 60),
      refresh_token: makeToken({ email: user.email, refresh: true }, 24 * 3600),
      type: 'bearer',
    })
    return
  }

  if (path === '/auth/logout' && method === 'POST') {
    const auth = parseAuth(req, { allowAdmin: true })
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    sendJson(res, 200, { msg: 'Logout Successfully' })
    return
  }

  if (path === '/auth/verify-2fa' && method === 'POST') {
    const pending = decodeToken(req.headers['x-auth-token'])
    const body = await readJson(req)
    const user = pending ? users.get(pending.email) : null
    if (!user) {
      sendJson(res, 401, {
        detail: { error_type: '2FA.user_not_found', msg: "You don't have account with us. Please register to use our app." },
      })
      return
    }
    if (String(body.totp) !== twoFactorTotp) {
      sendJson(res, 401, {
        detail: { error_type: '2FA.totp_invalid', msg: 'Invalid TOTP' },
      })
      return
    }
    sendJson(res, 200, {
      access_token: makeToken({ email: user.email }, 10 * 60),
      refresh_token: makeToken({ email: user.email, refresh: true }, 24 * 3600),
      type: 'bearer',
    })
    return
  }

  if (path === '/auth/me' && method === 'GET') {
    const auth = parseAuth(req, { allowAdmin: true })
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const { user } = auth
    sendJson(res, 200, publicUser(user))
    return
  }

  if (path === '/auth/enable-2fa' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    if (auth.user.is_2fa_enable) {
      sendJson(res, 400, {
        detail: { error_type: '2FA.already_enable', msg: 'You have already activated 2FA for your account.' },
      })
      return
    }
    // A 1x1 transparent PNG so <img> renders something.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    )
    twoFactorPending.set(auth.user.email, true)
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': png.length,
      'Access-Control-Allow-Origin': req.headers.origin || '*',
    })
    res.end(png)
    return
  }

  if (path === '/auth/confirm-2fa' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    if (!twoFactorPending.get(auth.user.email)) {
      sendJson(res, 404, {
        detail: { error_type: '2FA.setup_required', msg: 'Please start the 2FA setup process before confirming your TOTP.' },
      })
      return
    }
    const body = await readJson(req)
    if (String(body.totp) !== twoFactorTotp) {
      sendJson(res, 400, { detail: { error_type: '2FA:totp_invalid', msg: 'Invalid TOTP.' } })
      return
    }
    auth.user.is_2fa_enable = true
    twoFactorPending.delete(auth.user.email)
    sendJson(res, 200, { msg: 'Your 2FA setup completed.' })
    return
  }

  if (path === '/auth/disable-2fa' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    if (!auth.user.is_2fa_enable) {
      sendJson(res, 400, {
        detail: { error_type: '2FA.not_enable', msg: "You don't have 2FA enable for your account." },
      })
      return
    }
    auth.user.is_2fa_enable = false
    sendJson(res, 200, { msg: 'Your 2FA authentication setup disable successfully.' })
    return
  }

  // --- user -------------------------------------------------------------
  if (path === '/user/signup' && method === 'POST') {
    const body = await readJson(req)
    const email = String(body.email).trim().toLowerCase()
    if (users.has(email) || [...users.values()].some((u) => u.phone_number === body.phone_number)) {
      sendError(
        res,
        400,
        'create_user.duplicate_user',
        'It seem you already have an account with us. Please proceed with login.',
      )
      return
    }
    if (String(body.password).length < 8) {
      sendJson(res, 422, {
        detail: [{ loc: ['body', 'password'], msg: 'Password length must be greater than 8 characters.', type: 'value_error' }],
      })
      return
    }
    if (!/^[0-9]{10}$/.test(String(body.phone_number))) {
      sendJson(res, 422, {
        detail: [{ loc: ['body', 'phone_number'], msg: 'Invalid phone number.', type: 'value_error' }],
      })
      return
    }
    users.set(email, {
      id: randomUUID(),
      name: body.name,
      email,
      password: body.password,
      phone_number: String(body.phone_number),
      gender: body.gender,
      date_of_birth: body.date_of_birth,
      status: 'active',
      is_admin: false,
      is_2fa_enable: false,
      profile_image: null,
    })
    sendJson(res, 201, { ...users.get(email), password: undefined })
    return
  }

  if (path === '/user/change-password' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const body = await readJson(req)
    if (body.current_password !== auth.user.password) {
      sendError(res, 400, 'change_password.invalid_current_password', "Your current password doesn't match.")
      return
    }
    if (String(body.new_password).length < 8) {
      sendError(res, 400, 'change_password.password_too_short', 'Password must be greater than 8 characters.')
      return
    }
    if (body.new_password === body.current_password) {
      sendError(res, 400, 'change_password.same_as_current', 'You cannot set current password as new password')
      return
    }
    auth.user.password = body.new_password
    sendJson(res, 200, { msg: 'Password changed successfully' })
    return
  }

  if (path === '/user/profile-image' && method === 'POST') {
    const auth = parseAuth(req, { allowAdmin: true })
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const body = await readRawBody(req)
    const upload = parseImageUpload(body, req.headers['content-type'])
    if (!upload) {
      sendError(res, 400, 'user.profile_image.invalid', 'No image was uploaded.')
      return
    }
    if (!['image/png', 'image/jpeg'].includes(upload.type)) {
      sendError(res, 415, 'user.unsupported_format_provided', 'Only .png or .jpeg format allowed')
      return
    }
    if (upload.data.length > 2 * 1024 * 1024) {
      sendError(res, 413, 'user.file_max_size_exceeded', 'The uploaded image size exceeded max limit of 2 MB.')
      return
    }
    auth.user.profile_image = `data:${upload.type};base64,${upload.data.toString('base64')}`
    sendJson(res, 200, { msg: 'Your profile image uploaded successfully.' })
    return
  }

  if (path === '/user/profile-image' && method === 'GET') {
    const auth = parseAuth(req, { allowAdmin: true })
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    if (!auth.user.profile_image) {
      sendError(res, 404, 'user.profile_image.not_found', 'No profile image found. Please upload an image first.')
      return
    }
    sendJson(res, 200, { image_url: auth.user.profile_image, expires_in: '3 minutes' })
    return
  }

  // --- admin: paginated user list ---------------------------------------
  if (path === '/manage/users' && method === 'GET') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Math.min(Number(url.searchParams.get('page_size') || 5), 50)
    const result = paginate([...users.values()].map(publicUser), page, pageSize)
    sendJson(res, 200, result)
    return
  }

  const userDetailsMatch = path.match(/^\/manage\/([^/]+)\/details$/)
  if (userDetailsMatch && method === 'GET') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const user = findUserById(userDetailsMatch[1])
    if (!user) {
      sendError(res, 404, 'user.not_found', 'User not found')
      return
    }
    sendJson(res, 200, publicUser(user))
    return
  }

  const inactiveMatch = path.match(/^\/manage\/inactive-user\/([^/]+)$/)
  if (inactiveMatch && method === 'POST') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const user = findUserById(inactiveMatch[1])
    if (!user) {
      sendError(res, 404, 'user.not_found', 'User not found')
      return
    }
    if (user.status === 'inactive') {
      sendError(res, 400, 'user.already_inactive', 'User already inactive')
      return
    }
    user.status = 'inactive'
    user.updated_at = new Date().toISOString()
    sendJson(res, 200, { msg: 'User inactivated successfully.' })
    return
  }

  const reactivateMatch = path.match(/^\/manage\/reactivate-user\/([^/]+)$/)
  if (reactivateMatch && method === 'POST') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const user = findUserById(reactivateMatch[1])
    if (!user) {
      sendError(res, 404, 'user.not_found', 'User not found')
      return
    }
    if (user.status !== 'inactive') {
      sendError(res, 400, 'user.already_active', 'User is already active')
      return
    }
    user.status = 'active'
    user.updated_at = new Date().toISOString()
    sendJson(res, 200, { msg: 'User reactivated successfully.' })
    return
  }

  const walletActionMatch = path.match(/^\/manage\/wallet-(activate|deactivate)\/([^/]+)$/)
  if (walletActionMatch && method === 'POST') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const user = findUserById(walletActionMatch[2])
    if (!user) {
      sendError(res, 404, 'user.not_found', 'User not found')
      return
    }
    const wallet = walletForUser(user)
    if (!wallet) {
      sendError(res, 400, 'wallet.not_found', 'No wallet registrated for this user.')
      return
    }
    if (walletActionMatch[1] === 'activate') {
      if (wallet.is_active) {
        sendError(res, 400, 'wallet.already_activated', 'Wallet already activated.')
        return
      }
      wallet.is_active = true
      sendJson(res, 200, { msg: 'User wallet activated successfully.' })
    } else {
      if (!wallet.is_active) {
        sendError(res, 400, 'wallet.already_deactivated', 'Wallet already deactivated.')
        return
      }
      wallet.is_active = false
      sendJson(res, 200, { msg: 'User wallet deactivated successfully.' })
    }
    return
  }

  const walletByUserMatch = path.match(/^\/manage\/user-wallet\/([^/]+)$/)
  if (walletByUserMatch && method === 'GET') {
    const auth = parseAdmin(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const user = findUserById(walletByUserMatch[1])
    if (!user) {
      sendError(res, 404, 'user.not_found', 'User not found')
      return
    }
    const wallet = walletForUser(user)
    if (!wallet) {
      sendError(
        res,
        400,
        'transaction.wallet_not_found',
        "You don't have any wallet associated with your account. Please create an wallet account before proceeding.",
      )
      return
    }
    if (!wallet.is_active) {
      sendError(
        res,
        400,
        'transaction.wallet_not_active',
        "Your wallet account not activated. Can't proceed further.",
      )
      return
    }
    sendJson(res, 200, {
      currency: wallet.currency,
      balance: wallet.balance.toFixed(2),
      user_id: user.id,
      is_active: wallet.is_active,
    })
    return
  }

  // --- wallet -----------------------------------------------------------
  if (path === '/wallet/create' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    if (wallets.has(auth.user.email)) {
      sendError(
        res,
        403,
        'wallet.already_exists',
        "It seems you already have a wallet account with us. You can't recreate new wallet again.",
      )
      return
    }
    const body = await readJson(req)
    const amount = Number(body.balance)
    if (!(amount >= 1)) {
      sendJson(res, 422, {
        detail: [{ loc: ['body', 'balance'], msg: 'Invalid amount.', type: 'value_error' }],
      })
      return
    }
    const currency = body.currency || 'NPR'
    const wallet = {
      id: randomUUID(),
      user_id: auth.user.id,
      currency,
      balance: amount,
      hold_amount: 0,
      is_active: true,
    }
    wallets.set(auth.user.email, wallet)
    recordTransaction(wallet, 'deposit', amount)
    sendJson(res, 200, {
      msg: `Wallet created successfully with initial balance of ${currency} ${amount}.`,
    })
    return
  }

  if (path === '/wallet/check-balance' && method === 'GET') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const wallet = wallets.get(auth.user.email)
    if (!wallet) {
      sendError(res, 400, 'wallet.not_found', 'No wallet registrated for this user.')
      return
    }
    sendJson(res, 200, {
      currency: wallet.currency,
      balance: wallet.balance.toFixed(2),
      hold_amount: wallet.hold_amount.toFixed(2),
      is_active: wallet.is_active,
    })
    return
  }

  // --- transactions -----------------------------------------------------
  if (path === '/transaction/deposit' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const wallet = wallets.get(auth.user.email)
    if (!wallet) {
      sendError(
        res,
        400,
        'transaction.wallet_not_found',
        "You don't have any wallet associated with your account. Please create an wallet account before proceeding.",
      )
      return
    }
    if (!wallet.is_active) {
      sendError(
        res,
        400,
        'transaction.wallet_not_active',
        "Your wallet account not activated. Can't proceed further.",
      )
      return
    }
    const body = await readJson(req)
    const amount = Number(body.amount)
    const success = Math.random() > 0.4
    if (success) {
      wallet.balance += amount
      recordTransaction(wallet, 'deposit', amount, 'success')
      sendJson(res, 200, {
        msg: `Transaction Deposit of ${wallet.currency} ${amount.toFixed(2)} SUCCESS.`,
      })
    } else {
      recordTransaction(wallet, 'deposit', amount, 'failed')
      sendJson(res, 200, {
        msg: `Transaction Deposit of ${wallet.currency} ${amount.toFixed(2)} FAILED due to some issue. Please try again later.`,
      })
    }
    return
  }

  if (path === '/transaction/withdraw' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const wallet = wallets.get(auth.user.email)
    if (!wallet) {
      sendError(res, 400, 'transaction.wallet_not_found', "You don't have any wallet associated with your account.")
      return
    }
    if (!wallet.is_active) {
      sendError(res, 400, 'transaction.wallet_not_active', "Your wallet account not activated. Can't proceed further.")
      return
    }
    const body = await readJson(req)
    const amount = Number(body.amount)
    if (amount > wallet.balance) {
      sendJson(res, 422, {
        detail: { error_type: 'transaction.insufficient_balance', msg: 'Insufficient balance.' },
      })
      return
    }
    const success = Math.random() > 0.4
    if (success) {
      wallet.balance -= amount
      recordTransaction(wallet, 'withdraw', amount, 'success')
      sendJson(res, 200, {
        msg: `The amount of ${wallet.currency} ${amount.toFixed(2)} withdrawn successfully.`,
      })
    } else {
      recordTransaction(wallet, 'withdraw', amount, 'failed')
      sendJson(res, 200, {
        msg: `The amount of ${wallet.currency} ${amount.toFixed(2)} failed due to some issue. Please try again later.`,
      })
    }
    return
  }

  if (path === '/transaction/send-money' && method === 'POST') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const senderWallet = wallets.get(auth.user.email)
    if (!senderWallet) {
      sendError(res, 400, 'transaction.wallet_not_found', "You don't have any wallet associated with your account.")
      return
    }
    const body = await readJson(req)
    const receiver = [...users.values()].find((u) => u.phone_number === String(body.receiver_phone_number))
    if (!receiver) {
      sendJson(res, 422, {
        detail: { error_type: 'transaction.receiver_not_found', msg: "Receiver don't have associate account with us. Can't send money." },
      })
      return
    }
    const receiverWallet = wallets.get(receiver.email)
    if (!receiverWallet) {
      sendError(res, 400, 'transaction.receiver_wallet_not_found', "Receiver don't have any wallet associated with his account.")
      return
    }
    const amount = Number(body.amount)
    if (amount > senderWallet.balance) {
      sendJson(res, 422, {
        detail: { error_type: 'transaction.insufficient_balance', msg: 'Insufficient balance.' },
      })
      return
    }
    senderWallet.balance -= amount
    receiverWallet.balance += amount
    sendJson(res, 200, {
      msg: `Amount of ${senderWallet.currency} ${amount.toFixed(2)} send successfully to ${receiver.name}.`,
    })
    return
  }

  if (path === '/transaction/recent-transaction' && method === 'GET') {
    const auth = parseAuth(req)
    if (auth.error) {
      sendJson(res, 401, { detail: auth.error })
      return
    }
    const wallet = wallets.get(auth.user.email)
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Math.min(Number(url.searchParams.get('page_size') || 5), 50)
    const rows = wallet
      ? transactions
          .filter((tx) => tx.wallet_id === wallet.id)
          .map((tx) => ({
            id: tx.id,
            amount: tx.amount.toFixed(2),
            type: tx.type,
            status: tx.status,
            reference_id: tx.reference_id,
            created_at: tx.created_at,
          }))
      : []
    sendJson(res, 200, paginate(rows, page, pageSize))
    return
  }

  sendJson(res, 404, { detail: { error_type: 'route.not_found', msg: 'Not Found' } })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Digital Wallet API listening on ${baseUrl}`)
  console.log('Logins: demo@wallet.dev / password123  (2FA: sam@example.com / password123, code 123456)')
  console.log('Admin:  admin@wallet.dev / password123  (use /admin/login)')
  console.log('Create your own account, then create a wallet to get started.')
})